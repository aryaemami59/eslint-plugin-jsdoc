import iterateJsdoc from "../iterateJsdoc.js";

/**
 * We can skip checking for a yield value if the documentation is inherited
 * or the method has a constructor or abstract tag.
 *
 * In either of these cases, the yield value is optional or not defined.
 * @param {import('../iterateJsdoc.js').Utils} utils A reference to the utils used to probe if a tag is present or not.
 * @returns {boolean} True in case deep checking can be skipped; otherwise false.
 */
const canSkip = (utils: import("../iterateJsdoc.js").Utils): boolean => {
  return (
    utils.hasATag([
      "abstract",
      "virtual",
      "class",
      "constructor",
      "type",
      "interface",
    ]) || utils.avoidDocs()
  );
};

/**
 * @param {import('../iterateJsdoc.js').Utils} utils
 * @param {import('../iterateJsdoc.js').Report} report
 * @param {string} tagName
 * @returns {[preferredTagName?: string, missingTag?: boolean]}
 */
const checkTagName = (
  utils: import("../iterateJsdoc.js").Utils,
  report: import("../iterateJsdoc.js").Report,
  tagName: string,
): [string?, boolean?] => {
  const preferredTagName = utils.getPreferredTagName({
    tagName,
  }) as string;

  if (!preferredTagName) {
    return [];
  }

  const tags = utils.getTags(preferredTagName);

  if (tags.length > 1) {
    report(`Found more than one @${preferredTagName} declaration.`);
  }

  const [tag] = tags;
  const missingTag = typeof tag === "undefined" || tag === null;

  return [preferredTagName, missingTag];
};

export default iterateJsdoc<{
  report: import("../iterateJsdoc.js").Report;
  utils: import("../iterateJsdoc.js").Utils;
  context: import("eslint").Rule.RuleContext;
}>(
  ({ report, utils, context }) => {
    const {
      next = false,
      nextWithGeneratorTag = false,
      forceRequireNext = false,
      forceRequireYields = false,
      withGeneratorTag = true,
    } = context.options[0] || {};

    if (canSkip(utils)) {
      return;
    }

    const iteratingFunction = utils.isIteratingFunction();

    const [preferredYieldTagName, missingYieldTag] = checkTagName(
      utils,
      report,
      "yields",
    );

    if (preferredYieldTagName) {
      const shouldReportYields = (): boolean => {
        if (!missingYieldTag) return false;

        return (
          (withGeneratorTag && utils.hasTag("generator")) ||
          (forceRequireYields && iteratingFunction && utils.isGenerator()) ||
          (iteratingFunction && utils.isGenerator() && utils.hasYieldValue())
        );
      };

      if (shouldReportYields()) {
        report(`Missing JSDoc @${preferredYieldTagName} declaration.`);
      }
    }

    if (next || nextWithGeneratorTag || forceRequireNext) {
      const [preferredNextTagName, missingNextTag] = checkTagName(
        utils,
        report,
        "next",
      );
      if (!preferredNextTagName) return;

      const shouldReportNext = (): boolean => {
        if (!missingNextTag) return false;

        return (
          (nextWithGeneratorTag && utils.hasTag("generator")) ||
          ((next || forceRequireNext) &&
            iteratingFunction &&
            utils.isGenerator() &&
            utils.hasYieldReturnValue())
        );
      };

      if (shouldReportNext()) {
        report(`Missing JSDoc @${preferredNextTagName} declaration.`);
      }
    }
  },
  {
    contextDefaults: true,
    meta: {
      docs: {
        description: "Requires yields to be documented.",
        url: "https://github.com/gajus/eslint-plugin-jsdoc/blob/main/docs/rules/require-yields.md#repos-sticky-header",
      },
      schema: [
        {
          additionalProperties: false,
          properties: {
            contexts: {
              items: {
                anyOf: [
                  { type: "string" },
                  {
                    additionalProperties: false,
                    properties: {
                      comment: { type: "string" },
                      context: { type: "string" },
                    },
                    type: "object",
                  },
                ],
              },
              type: "array",
            },
            exemptedBy: {
              items: { type: "string" },
              type: "array",
            },
            forceRequireNext: { default: false, type: "boolean" },
            forceRequireYields: { default: false, type: "boolean" },
            next: { default: false, type: "boolean" },
            nextWithGeneratorTag: { default: false, type: "boolean" },
            withGeneratorTag: { default: true, type: "boolean" },
          },
          type: "object",
        },
      ],
      type: "suggestion",
    },
  },
);
