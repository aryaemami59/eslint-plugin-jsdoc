import {
  getJSDocComment,
  parse as parseType,
  traverse,
  tryParse as tryParseType,
} from "@es-joy/jsdoccomment";
import { AST, Rule, SourceCode } from "eslint";
import { Import } from "parse-imports";
import { dirname, join } from "path";
import { createSyncFn } from "synckit";
import { fileURLToPath } from "url";
import iterateJsdoc, { parseComment } from "../iterateJsdoc.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const pathName = join(__dirname, "../import-worker.mjs");

const extraTypes = [
  "null",
  "undefined",
  "void",
  "string",
  "boolean",
  "object",
  "function",
  "symbol",
  "number",
  "bigint",
  "NaN",
  "Infinity",
  "any",
  "*",
  "never",
  "unknown",
  "const",
  "this",
  "true",
  "false",
  "Array",
  "Object",
  "RegExp",
  "Date",
  "Function",
];

const typescriptGlobals = [
  "Awaited",
  "Partial",
  "Required",
  "Readonly",
  "Record",
  "Pick",
  "Omit",
  "Exclude",
  "Extract",
  "NonNullable",
  "Parameters",
  "ConstructorParameters",
  "ReturnType",
  "InstanceType",
  "ThisParameterType",
  "OmitThisParameter",
  "ThisType",
  "Uppercase",
  "Lowercase",
  "Capitalize",
  "Uncapitalize",
];

/**
 * Removes pseudo types from the end of a string.
 * @param {string | false | undefined} [str]
 * @returns {undefined | string | false}
 */
const stripPseudoTypes = (str?: string | false): string | false | undefined => {
  return str && str.replace(/(?:\.|<>|\.<>|\[\])$/u, "");
};

export default iterateJsdoc(
  ({
    context,
    node,
    report,
    settings,
    sourceCode,
    utils,
  }: {
    context: Rule.RuleContext;
    node: AST.Node;
    report: Rule.ReportFixer;
    settings: any;
    sourceCode: SourceCode;
    utils: any;
  }) => {
    const { scopeManager } = sourceCode;
    const globalScope = scopeManager.globalScope;

    const {
      definedTypes = [],
      disableReporting = false,
      markVariablesAsUsed = true,
    } = context.options[0] || {};

    let definedPreferredTypes: (string | undefined)[] = [];
    const { preferredTypes, structuredTags, mode } = settings;

    if (Object.keys(preferredTypes).length) {
      definedPreferredTypes = Object.values(preferredTypes)
        .map((preferredType: any) => {
          if (typeof preferredType === "string") {
            return stripPseudoTypes(preferredType);
          }

          if (!preferredType) {
            return undefined;
          }

          if (typeof preferredType !== "object") {
            utils.reportSettings(
              "Invalid `settings.jsdoc.preferredTypes`. Values must be falsy, a string, or an object.",
            );
          }

          return stripPseudoTypes(preferredType.replacement);
        })
        .filter(Boolean);
    }

    const comments = sourceCode
      .getAllComments()
      .filter((comment) => /^\*\s/u.test(comment.value))
      .map((commentNode) => parseComment(commentNode, ""));

    const typedefDeclarations = comments
      .flatMap((doc) =>
        doc.tags.filter(({ tag }) => utils.isNamepathDefiningTag(tag)),
      )
      .map((tag) => tag.name);

    const importTags =
      settings.mode === "typescript"
        ? comments
            .flatMap((doc) => {
              return doc.tags.filter(({ tag }) => tag === "import");
            })
            .flatMap((tag) => {
              const { type, name, description } = tag;
              const typePart = type ? `{${type}} ` : "";
              const imprt =
                "import " +
                (description
                  ? `${typePart}${name} ${description}`
                  : `${typePart}${name}`);

              const getImports = createSyncFn(pathName);
              const imports: Import[] = getImports(imprt);
              if (!imports) return null;

              return imports.flatMap(({ importClause }) => {
                const { default: dflt, named, namespace } = importClause || {};
                const types: string[] = [];
                if (dflt) types.push(dflt);
                if (namespace) types.push(namespace);
                if (named) named.forEach(({ binding }) => types.push(binding));
                return types;
              });
            })
            .filter(Boolean)
        : [];

    const ancestorNodes: AST.Node[] = [];
    let currentNode: AST.Node | null = node;
    while (currentNode?.parent) {
      ancestorNodes.push(currentNode);
      currentNode = currentNode.parent;
    }

    const getTemplateTags = (ancestorNode: AST.Node) => {
      const commentNode = getJSDocComment(sourceCode, ancestorNode, settings);
      if (!commentNode) return [];
      const jsdoc = parseComment(commentNode, "");
      return jsdoc.tags.filter((tag) => tag.tag === "template");
    };

    const templateTags = ancestorNodes.length
      ? ancestorNodes.flatMap(getTemplateTags)
      : utils.getPresentTags(["template"]);
    const closureGenericTypes = templateTags.flatMap((tag) =>
      utils.parseClosureTemplateTag(tag),
    );

    const cjsOrESMScope = globalScope.childScopes[0]?.block?.type === "Program";

    const allDefinedTypes = new Set(
      globalScope.variables
        .map(({ name }) => name)
        .concat(
          cjsOrESMScope
            ? globalScope.childScopes.flatMap(({ variables }) =>
                variables.map(({ name }) => name),
              )
            : [],
        )
        .concat(extraTypes)
        .concat(typedefDeclarations)
        .concat(importTags)
        .concat(definedTypes)
        .concat(definedPreferredTypes as string[])
        .concat(
          settings.mode === "jsdoc"
            ? []
            : (settings.mode === "typescript" ? typescriptGlobals : []).concat(
                closureGenericTypes,
              ),
        ),
    );

    const tagToParsedType = (
      propertyName: "type" | "name" | "namepathOrURL",
    ) => {
      return (tag: any) => {
        try {
          const potentialType = tag[propertyName];
          return {
            parsedType:
              mode === "permissive"
                ? tryParseType(potentialType as string)
                : parseType(potentialType as string, mode),
            tag,
          };
        } catch {
          return undefined;
        }
      };
    };

    const typeTags = utils
      .filterTags(
        ({ tag }) =>
          tag !== "import" &&
          utils.tagMightHaveTypePosition(tag) &&
          (tag !== "suppress" || settings.mode !== "closure"),
      )
      .map(tagToParsedType("type"));
    const namepathReferencingTags = utils
      .filterTags(({ tag }) => utils.isNamepathReferencingTag(tag))
      .map(tagToParsedType("name"));
    const namepathOrUrlReferencingTags = utils
      .filterAllTags(({ tag }) => utils.isNamepathOrUrlReferencingTag(tag))
      .map(tagToParsedType("namepathOrURL"));

    const tagsWithTypes = [
      ...typeTags,
      ...namepathReferencingTags,
      ...namepathOrUrlReferencingTags,
    ].filter(Boolean);

    for (const { tag, parsedType } of tagsWithTypes) {
      traverse(parsedType, (nde: any) => {
        const { type, value } = nde;
        if (type === "JsdocTypeName") {
          const structuredTypes = structuredTags[tag.tag]?.type;
          if (
            !allDefinedTypes.has(value) &&
            (!Array.isArray(structuredTypes) ||
              !structuredTypes.includes(value))
          ) {
            if (!disableReporting) {
              report(`The type '${value}' is undefined.`, null, tag);
            }
          } else if (markVariablesAsUsed && !extraTypes.includes(value)) {
            if (sourceCode.markVariableAsUsed) {
              sourceCode.markVariableAsUsed(value);
            } else {
              context.markVariableAsUsed(value);
            }
          }
        }
      });
    }
  },
  {
    iterateAllJsdocs: true,
    meta: {
      docs: {
        description: "Checks that types in JSDoc comments are defined.",
        url: "https://github.com/gajus/eslint-plugin-jsdoc/blob/main/docs/rules/no-undefined-types.md#repos-sticky-header",
      },
      schema: [
        {
          additionalProperties: false,
          properties: {
            definedTypes: {
              items: {
                type: "string",
              },
              type: "array",
            },
            disableReporting: {
              type: "boolean",
            },
            markVariablesAsUsed: {
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
