import iterateJsdoc from "../iterateJsdoc.js";

/**
 * Determines if deep checking for yield values can be skipped,
 * such as for constructors, abstract functions, or interfaces.
 * @param {import('../iterateJsdoc.js').Utils} utils A reference to the utils used to probe for specific tags.
 * @param {import('../iterateJsdoc.js').Settings} settings The settings used for the current context.
 * @returns {boolean} Returns true if the checking can be skipped.
 */
const canSkip = (
  utils: import("../iterateJsdoc.js").Utils,
  settings: import("../iterateJsdoc.js").Settings,
): boolean => {
  const voidingTags = [
    "abstract",
    "virtual",
    "class",
    "constructor",
    "interface",
  ];

  if (settings.mode === "closure") {
    voidingTags.push("record");
  }

  return (
    utils.hasATag(voidingTags) ||
    utils.isConstructor() ||
    utils.classHasTag("interface") ||
    (settings.mode === "closure" && utils.classHasTag("record"))
  );
};

/**
 * Checks for the presence of a specific tag, returning the preferred name and the tag itself.
 * @param {import('../iterateJsdoc.js').Utils} utils A reference to the utils used to probe for specific tags.
 * @param {import('../iterateJsdoc.js').Report} report A report object used to issue reports.
 * @param {string} tagName The name of the tag to check.
 * @returns {[] | [preferredTagName: string, tag: import('comment-parser').Spec]} Returns the preferred tag name and the tag itself if found.
 */
const checkTagName = (
  utils: import("../iterateJsdoc.js").Utils,
  report: import("../iterateJsdoc.js").Report,
  tagName: string,
): [] | [string, import("comment-parser").Spec] => {
  const preferredTagName = utils.getPreferredTagName({
    tagName,
  }) as string;

  if (!preferredTagName) {
    return [];
  }

  const tags = utils.getTags(preferredTagName);

  if (tags.length === 0) {
    return [];
  }

  if (tags.length > 1) {
    report(`Found more than one @${preferredTagName} declaration.`);
    return [];
  }

  return [preferredTagName, tags[0]];
};

export default iterateJsdoc<{
  context: import("eslint").Rule.RuleContext;
  report: import("../iterateJsdoc.js").Report;
  settings: import("../iterateJsdoc.js").Settings;
  utils: import("../iterateJsdoc.js").Utils;
}>(
  ({ context, report, settings, utils }) => {
    if (canSkip(utils, settings)) {
      return;
    }

    const { next = false, checkGeneratorsOnly = false } =
      context.options[0] || {};

    const [preferredYieldTagName, yieldTag] = checkTagName(
      utils,
      report,
      "yields",
    );

    if (preferredYieldTagName) {
      const shouldReportYields = (): boolean => {
        if (
          (yieldTag as import("comment-parser").Spec).type.trim() === "never"
        ) {
          if (utils.hasYieldValue()) {
            report(
              `JSDoc @${preferredYieldTagName} declaration set with "never" but yield expression is present in the function.`,
            );
          }
          return false;
        }

        if (checkGeneratorsOnly && !utils.isGenerator()) {
          return true;
        }

        return (
          !utils.mayBeUndefinedTypeTag(
            yieldTag as import("comment-parser").Spec,
          ) && !utils.hasYieldValue()
        );
      };

      if (shouldReportYields()) {
        report(
          `JSDoc @${preferredYieldTagName} declaration present but yield expression not available in function.`,
        );
      }
    }

    if (next) {
      const [preferredNextTagName, nextTag] = checkTagName(
        utils,
        report,
        "next",
      );

      if (preferredNextTagName) {
        const shouldReportNext = (): boolean => {
          if (
            (nextTag as import("comment-parser").Spec).type.trim() === "never"
          ) {
            if (utils.hasYieldReturnValue()) {
              report(
                `JSDoc @${preferredNextTagName} declaration set with "never" but yield expression with return value is present in the function.`,
              );
            }
            return false;
          }

          if (checkGeneratorsOnly && !utils.isGenerator()) {
            return true;
          }

          return (
            !utils.mayBeUndefinedTypeTag(
              nextTag as import("comment-parser").Spec,
            ) && !utils.hasYieldReturnValue()
          );
        };

        if (shouldReportNext()) {
          report(
            `JSDoc @${preferredNextTagName} declaration present but yield expression with return value not available in function.`,
          );
        }
      }
    }
  },
  {
    meta: {
      docs: {
        description:
          "Requires a yield statement in the function body if a `@yields` tag is specified in the jsdoc comment.",
        url: "https://github.com/gajus/eslint-plugin-jsdoc/blob/main/docs/rules/require-yields-check.md#repos-sticky-header",
      },
      schema: [
        {
          additionalProperties: false,
          properties: {
            checkGeneratorsOnly: {
              default: false,
              type: "boolean",
            },
            contexts: {
              items: {
                anyOf: [
                  {
                    type: "string",
                  },
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
            next: {
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
