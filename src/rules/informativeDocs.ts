import { areDocsInformative } from "are-docs-informative";
import iterateJsdoc from "../iterateJsdoc.js";

interface Options {
  aliases: { [key: string]: string[] };
  excludedTags: string[];
  uselessWords: string[];
}

const defaultAliases = {
  a: ["an", "our"],
};

const defaultUselessWords = ["a", "an", "i", "in", "of", "s", "the"];

/**
 * @param {import('eslint').Rule.Node|import('@typescript-eslint/types').TSESTree.Node|null|undefined} node
 * @returns {string[]}
 */
const getNamesFromNode = (node: any): string[] => {
  switch (node?.type) {
    case "AccessorProperty":
    case "MethodDefinition":
    case "PropertyDefinition":
    case "TSAbstractAccessorProperty":
    case "TSAbstractMethodDefinition":
    case "TSAbstractPropertyDefinition":
      return [
        ...getNamesFromNode((node.parent as any).parent),
        ...getNamesFromNode(node.key),
      ];

    case "ExportDefaultDeclaration":
    case "ExportNamedDeclaration":
      return getNamesFromNode((node as any).declaration);

    case "ClassDeclaration":
    case "ClassExpression":
    case "FunctionDeclaration":
    case "FunctionExpression":
    case "TSModuleDeclaration":
    case "TSMethodSignature":
    case "TSDeclareFunction":
    case "TSEnumDeclaration":
    case "TSEnumMember":
    case "TSInterfaceDeclaration":
    case "TSTypeAliasDeclaration":
      return getNamesFromNode(node.id);

    case "Identifier":
      return [node.name];

    case "Property":
      return getNamesFromNode(node.key);

    case "VariableDeclaration":
      return getNamesFromNode(node.declarations[0]);

    case "VariableDeclarator":
      return [
        ...getNamesFromNode(node.id),
        ...getNamesFromNode(node.init),
      ].filter(Boolean);

    default:
      return [];
  }
};

export default iterateJsdoc(
  ({ context, jsdoc, node, report, utils }) => {
    const {
      aliases = defaultAliases,
      excludedTags = [],
      uselessWords = defaultUselessWords,
    }: Options = context.options[0] || {};

    const nodeNames = getNamesFromNode(node);

    /**
     * @param {string} text
     * @param {string} extraName
     * @returns {boolean}
     */
    const descriptionIsRedundant = (
      text: string,
      extraName: string = "",
    ): boolean => {
      const textTrimmed = text.trim();
      return (
        Boolean(textTrimmed) &&
        !areDocsInformative(
          textTrimmed,
          [extraName, ...nodeNames].filter(Boolean).join(" "),
          {
            aliases,
            uselessWords,
          },
        )
      );
    };

    const { description, lastDescriptionLine } = utils.getDescription();
    let descriptionReported = false;

    for (const tag of jsdoc.tags) {
      if (excludedTags.includes(tag.tag)) {
        continue;
      }

      if (descriptionIsRedundant(tag.description, tag.name)) {
        utils.reportJSDoc(
          "This tag description only repeats the name it describes.",
          tag,
        );
      }

      descriptionReported ||=
        tag.description === description &&
        (tag as any).line === lastDescriptionLine;
    }

    if (!descriptionReported && descriptionIsRedundant(description)) {
      report("This description only repeats the name it describes.");
    }
  },
  {
    iterateAllJsdocs: true,
    meta: {
      docs: {
        description:
          "This rule reports doc comments that only restate their attached name.",
        url: "https://github.com/gajus/eslint-plugin-jsdoc/blob/main/docs/rules/informative-docs.md#repos-sticky-header",
      },
      schema: [
        {
          additionalProperties: false,
          properties: {
            aliases: {
              patternProperties: {
                ".*": {
                  items: {
                    type: "string",
                  },
                  type: "array",
                },
              },
            },
            excludedTags: {
              items: {
                type: "string",
              },
              type: "array",
            },
            uselessWords: {
              items: {
                type: "string",
              },
              type: "array",
            },
          },
          type: "object",
        },
      ],
      type: "suggestion",
    },
  },
);