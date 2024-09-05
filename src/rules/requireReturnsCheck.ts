import type { TSESTree } from "@typescript-eslint/types";
import type { Settings, Utils } from "../iterateJsdoc.js";
import iterateJsdoc from "../iterateJsdoc.js";

/**
 * Determines if the check can be skipped based on tags or settings.
 * @param utils - JSDoc utils for checking tags and constructors.
 * @param settings - JSDoc settings, including mode.
 * @returns Whether the check can be skipped.
 */
const canSkip = (utils: Utils, settings: Settings): boolean => {
  const voidingTags = [
    "abstract",
    "virtual",
    "class",
    "constructor",
    "interface",
  ];

  if (settings.mode === "closure") {
    // Structural Interface in GCC terms, equivalent to @interface tag as far as this rule is concerned
    voidingTags.push("record");
  }

  return (
    utils.hasATag(voidingTags) ||
    utils.isConstructor() ||
    utils.classHasTag("interface") ||
    (settings.mode === "closure" && utils.classHasTag("record"))
  );
};

// eslint-disable-next-line complexity -- Temporary
export default iterateJsdoc<{
  context: {
    options: Array<{
      exemptAsync?: boolean;
      exemptGenerators?: boolean;
      reportMissingReturnForUndefinedTypes?: boolean;
    }>;
  };
  node: TSESTree.Node;
  report: (message: string) => void;
  settings: Settings;
  utils: Utils;
}>(
  ({ context, node, report, settings, utils }) => {
    const {
      exemptAsync = true,
      exemptGenerators = settings.mode === "typescript",
      reportMissingReturnForUndefinedTypes = false,
    } = context.options[0] || {};

    if (canSkip(utils, settings)) {
      return;
    }

    if (exemptAsync && utils.isAsync()) {
      return;
    }

    const tagName = utils.getPreferredTagName({
      tagName: "returns",
    }) as string;

    if (!tagName) {
      return;
    }

    const tags = utils.getTags(tagName);

    if (tags.length === 0) {
      return;
    }

    if (tags.length > 1) {
      report(`Found more than one @${tagName} declaration.`);
      return;
    }

    const [tag] = tags;
    const type = tag.type.trim();

    // https://www.typescriptlang.org/docs/handbook/release-notes/typescript-3-7.html#assertion-functions
    if (/asserts\s/u.test(type)) {
      return;
    }

    const returnNever = type === "never";

    if (returnNever && utils.hasValueOrExecutorHasNonEmptyResolveValue(false)) {
      report(
        `JSDoc @${tagName} declaration set with "never" but return expression is present in function.`,
      );
      return;
    }

    // In case a return value is declared in JSDoc, we also expect one in the code.
    if (
      !returnNever &&
      (reportMissingReturnForUndefinedTypes ||
        !utils.mayBeUndefinedTypeTag(tag)) &&
      ((tag.type === "" &&
        !utils.hasValueOrExecutorHasNonEmptyResolveValue(exemptAsync)) ||
        (tag.type !== "" &&
          !utils.hasValueOrExecutorHasNonEmptyResolveValue(
            exemptAsync,
            true,
          ))) &&
      Boolean(
        !exemptGenerators ||
          !node ||
          !("generator" in node) ||
          !(node as TSESTree.FunctionDeclaration).generator,
      )
    ) {
      report(
        `JSDoc @${tagName} declaration present but return expression not available in function.`,
      );
    }
  },
  {
    meta: {
      docs: {
        description:
          "Requires a return statement in function body if a `@returns` tag is specified in JSDoc comment.",
        url: "https://github.com/gajus/eslint-plugin-jsdoc/blob/main/docs/rules/require-returns-check.md#repos-sticky-header",
      },
      schema: [
        {
          additionalProperties: false,
          properties: {
            exemptAsync: {
              default: true,
              type: "boolean",
            },
            exemptGenerators: {
              type: "boolean",
            },
            reportMissingReturnForUndefinedTypes: {
              default: false,
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
