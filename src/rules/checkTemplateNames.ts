import {
  parse as parseType,
  traverse,
  tryParse as tryParseType,
} from "@es-joy/jsdoccomment";
import iterateJsdoc from "../iterateJsdoc.js";

export default iterateJsdoc(
  ({
    context,
    utils,
    node,
    settings,
    report,
  }: {
    context: any;
    utils: any;
    node: import("@typescript-eslint/types").TSESTree.Node | null;
    settings: { mode: string };
    report: (message: string, fixer: null, tag: any) => void;
  }) => {
    const { mode } = settings;

    const templateTags = utils.getTags("template");

    const usedNames = new Set<string>();

    /**
     * Checks for used types in the given potential type string.
     * @param {string} potentialType - The type string to check.
     */
    const checkForUsedTypes = (potentialType: string) => {
      let parsedType;
      try {
        parsedType =
          mode === "permissive"
            ? tryParseType(potentialType)
            : parseType(potentialType, mode);
      } catch {
        return;
      }

      traverse(parsedType, (nde) => {
        const { type, value } =
          nde as import("jsdoc-type-pratt-parser").NameResult;
        if (type === "JsdocTypeName" && /^[A-Z]$/.test(value)) {
          usedNames.add(value);
        }
      });
    };

    const checkParamsAndReturnsTags = () => {
      const paramName = utils.getPreferredTagName({
        tagName: "param",
      }) as string;
      const paramTags = utils.getTags(paramName);
      for (const paramTag of paramTags) {
        checkForUsedTypes(paramTag.type);
      }

      const returnsName = utils.getPreferredTagName({
        tagName: "returns",
      }) as string;
      const returnsTags = utils.getTags(returnsName);
      for (const returnsTag of returnsTags) {
        checkForUsedTypes(returnsTag.type);
      }
    };

    const checkTemplateTags = () => {
      for (const tag of templateTags) {
        const { name } = tag;
        const names = name.split(/,\s*/);
        for (const name of names) {
          if (!usedNames.has(name)) {
            report(`@template ${name} not in use`, null, tag);
          }
        }
      }
    };

    /**
     * Checks parameters for the given declaration.
     * @param {import('@typescript-eslint/types').TSESTree.FunctionDeclaration |
     *   import('@typescript-eslint/types').TSESTree.ClassDeclaration |
     *   import('@typescript-eslint/types').TSESTree.TSInterfaceDeclaration |
     *   import('@typescript-eslint/types').TSESTree.TSTypeAliasDeclaration} aliasDeclaration - The declaration to check.
     * @param {boolean} [checkParamsAndReturns] - Whether to check params and returns.
     */
    const checkParameters = (
      aliasDeclaration:
        | import("@typescript-eslint/types").TSESTree.FunctionDeclaration
        | import("@typescript-eslint/types").TSESTree.ClassDeclaration
        | import("@typescript-eslint/types").TSESTree.TSInterfaceDeclaration
        | import("@typescript-eslint/types").TSESTree.TSTypeAliasDeclaration,
      checkParamsAndReturns?: boolean,
    ) => {
      const { params } = aliasDeclaration.typeParameters ?? { params: [] };
      for (const {
        name: { name },
      } of params) {
        usedNames.add(name);
      }
      if (checkParamsAndReturns) {
        checkParamsAndReturnsTags();
      }

      checkTemplateTags();
    };

    const handleTypeAliases = () => {
      if (!node) {
        return;
      }
      switch (node.type) {
        case "ExportDefaultDeclaration":
        case "ExportNamedDeclaration":
          switch (node.declaration?.type) {
            case "FunctionDeclaration":
              checkParameters(node.declaration, true);
              break;
            case "ClassDeclaration":
            case "TSTypeAliasDeclaration":
            case "TSInterfaceDeclaration":
              checkParameters(node.declaration);
              break;
          }
          break;
        case "FunctionDeclaration":
          checkParameters(node, true);
          break;
        case "ClassDeclaration":
        case "TSTypeAliasDeclaration":
        case "TSInterfaceDeclaration":
          checkParameters(node);
          break;
      }
    };

    const callbackTags = utils.getTags("callback");
    const functionTags = utils.getTags("function");
    if (callbackTags.length || functionTags.length) {
      checkParamsAndReturnsTags();
      checkTemplateTags();
      return;
    }

    const typedefTags = utils.getTags("typedef");
    if (!typedefTags.length || typedefTags.length >= 2) {
      handleTypeAliases();
      return;
    }

    const potentialTypedefType = typedefTags[0].type;
    checkForUsedTypes(potentialTypedefType);

    const propertyName = utils.getPreferredTagName({
      tagName: "property",
    }) as string;
    const propertyTags = utils.getTags(propertyName);
    for (const propertyTag of propertyTags) {
      checkForUsedTypes(propertyTag.type);
    }

    for (const tag of templateTags) {
      const { name } = tag;
      const names = name.split(/,\s*/);
      for (const name of names) {
        if (!usedNames.has(name)) {
          report(`@template ${name} not in use`, null, tag);
        }
      }
    }
  },
  {
    iterateAllJsdocs: true,
    meta: {
      docs: {
        description:
          "Checks that any `@template` names are actually used in the connected `@typedef` or type alias.",
        url: "https://github.com/gajus/eslint-plugin-jsdoc/blob/main/docs/rules/check-template-names.md#repos-sticky-header",
      },
      schema: [],
      type: "suggestion",
    },
  },
);
