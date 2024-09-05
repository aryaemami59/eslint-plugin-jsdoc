import iterateJsdoc from "../iterateJsdoc.js";

/**
 * We can skip checking for a throws value, in case the documentation is inherited
 * or the method is either a constructor or an abstract method.
 * @param {import('../iterateJsdoc.js').Utils} utils A reference to the utils used to probe if a tag is present or not.
 * @returns {boolean} True in case deep checking can be skipped; otherwise false.
 */
const canSkip = (utils: import("../iterateJsdoc.js").Utils): boolean => {
  return (
    utils.hasATag([
      "abstract", // Abstract methods are incomplete, no need to document throws
      "virtual",
      "type", // The designated type can document @throws
    ]) || utils.avoidDocs()
  );
};

export default iterateJsdoc<{
  utils: import("../iterateJsdoc.js").Utils;
  report: (message: string, fix?: any, tag?: any) => void;
}>(
  ({ report, utils }) => {
    // A preflight check. We do not need to run a deep check for abstract functions.
    if (canSkip(utils)) {
      return;
    }

    const tagName = utils.getPreferredTagName({
      tagName: "throws",
    });

    if (!tagName) {
      return;
    }

    const tags = utils.getTags(tagName);
    const iteratingFunction = utils.isIteratingFunction();

    const [tag] = tags;
    const missingThrowsTag = typeof tag === "undefined" || tag === null;

    const shouldReport = (): boolean => {
      if (!missingThrowsTag) {
        if (
          tag.type.trim() === "never" &&
          iteratingFunction &&
          utils.hasThrowValue()
        ) {
          report(
            `JSDoc @${tagName} declaration set to "never" but throw value found.`,
          );
        }
        return false;
      }
      return iteratingFunction && utils.hasThrowValue();
    };

    if (shouldReport()) {
      report(`Missing JSDoc @${tagName} declaration.`);
    }
  },
  {
    contextDefaults: true,
    meta: {
      docs: {
        description: "Requires that throw statements are documented.",
        url: "https://github.com/gajus/eslint-plugin-jsdoc/blob/main/docs/rules/require-throws.md#repos-sticky-header",
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
          },
          type: "object",
        },
      ],
      type: "suggestion",
    },
  },
);
