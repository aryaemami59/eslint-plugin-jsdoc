import {
  parse as parseType,
  traverse,
  tryParse as tryParseType,
} from "@es-joy/jsdoccomment";
import iterateJsdoc from "../iterateJsdoc.js";

export default iterateJsdoc<{
  context: any;
  utils: {
    getTags: (tagName: string) => Array<{ name: string; type?: string }>;
    getPreferredTagName: (options: { tagName: string }) => string | null;
  };
  node: any;
  settings: { mode: "permissive" | string };
  report: (message: string, fix?: any, tag?: any) => void;
}>(
  ({ context, utils, node, settings, report }) => {
    const { requireSeparateTemplates = false } = context.options[0] || {};

    const { mode } = settings;

    const usedNames = new Set<string>();
    const templateTags = utils.getTags("template");
    const templateNames = templateTags.flatMap(({ name }) =>
      name.split(/,\s*/),
    );

    for (const tag of templateTags) {
      const { name } = tag;
      const names = name.split(/,\s*/);
      if (requireSeparateTemplates && names.length > 1) {
        report(`Missing separate @template for ${names[1]}`, null, tag);
      }
    }

    const checkTypeParams = (
      aliasDeclaration:
        | import("@typescript-eslint/types").TSESTree.FunctionDeclaration
        | import("@typescript-eslint/types").TSESTree.ClassDeclaration
        | import("@typescript-eslint/types").TSESTree.TSInterfaceDeclaration
        | import("@typescript-eslint/types").TSESTree.TSTypeAliasDeclaration,
    ) => {
      const { params } = aliasDeclaration.typeParameters ?? { params: [] };
      for (const {
        name: { name },
      } of params) {
        usedNames.add(name);
      }
      for (const usedName of usedNames) {
        if (!templateNames.includes(usedName)) {
          report(`Missing @template ${usedName}`);
        }
      }
    };

    const handleTypes = () => {
      const nde = node as import("@typescript-eslint/types").TSESTree.Node;
      if (!nde) return;

      switch (nde.type) {
        case "ExportDefaultDeclaration":
          switch (nde.declaration?.type) {
            case "ClassDeclaration":
            case "FunctionDeclaration":
            case "TSInterfaceDeclaration":
              checkTypeParams(nde.declaration);
              break;
          }
          break;
        case "ExportNamedDeclaration":
          switch (nde.declaration?.type) {
            case "ClassDeclaration":
            case "FunctionDeclaration":
            case "TSTypeAliasDeclaration":
            case "TSInterfaceDeclaration":
              checkTypeParams(nde.declaration);
              break;
          }
          break;
        case "ClassDeclaration":
        case "FunctionDeclaration":
        case "TSTypeAliasDeclaration":
        case "TSInterfaceDeclaration":
          checkTypeParams(nde);
          break;
      }
    };

    const usedNameToTag = new Map<string, { name: string; type?: string }>();

    const checkForUsedTypes = (potentialTag: {
      name: string;
      type?: string;
    }) => {
      let parsedType;
      try {
        parsedType =
          mode === "permissive"
            ? tryParseType(potentialTag.type as string)
            : parseType(potentialTag.type as string, mode);
      } catch {
        return;
      }

      traverse(parsedType, (nde) => {
        const { type, value } = nde as { type: string; value: string };
        if (type === "JsdocTypeName" && /^[A-Z]$/.test(value)) {
          usedNames.add(value);
          if (!usedNameToTag.has(value)) {
            usedNameToTag.set(value, potentialTag);
          }
        }
      });
    };

    const checkTagsAndTemplates = (tagNames: string[]) => {
      for (const tagName of tagNames) {
        const preferredTagName = utils.getPreferredTagName({ tagName });
        const matchingTags = utils.getTags(preferredTagName as string);
        for (const matchingTag of matchingTags) {
          checkForUsedTypes(matchingTag);
        }
      }

      for (const usedName of usedNames) {
        if (!templateNames.includes(usedName)) {
          report(
            `Missing @template ${usedName}`,
            null,
            usedNameToTag.get(usedName),
          );
        }
      }
    };

    const callbackTags = utils.getTags("callback");
    const functionTags = utils.getTags("function");
    if (callbackTags.length || functionTags.length) {
      checkTagsAndTemplates(["param", "returns"]);
      return;
    }

    const typedefTags = utils.getTags("typedef");
    if (!typedefTags.length || typedefTags.length >= 2) {
      handleTypes();
      return;
    }

    const potentialTypedef = typedefTags[0];
    checkForUsedTypes(potentialTypedef);

    checkTagsAndTemplates(["property"]);
  },
  {
    iterateAllJsdocs: true,
    meta: {
      docs: {
        description: "Requires template tags for each generic type parameter",
        url: "https://github.com/gajus/eslint-plugin-jsdoc/blob/main/docs/rules/require-template.md#repos-sticky-header",
      },
      schema: [
        {
          additionalProperties: false,
          properties: {
            requireSeparateTemplates: {
              type: "boolean",
            },
          },
          type: "object",
        },
      ],
      type: "suggestion",
    },
  },
);
