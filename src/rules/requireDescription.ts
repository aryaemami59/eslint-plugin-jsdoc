import iterateJsdoc from "../iterateJsdoc.js";

/**
 * @param {string} description
 * @returns {number}
 */
const checkDescription = (description: string): number => {
  return description.trim().split("\n").filter(Boolean).length;
};

export default iterateJsdoc(
  ({
    jsdoc,
    report,
    utils,
    context,
  }: {
    jsdoc: any;
    report: (message: string, fix?: any, tag?: any) => void;
    utils: any;
    context: any;
  }) => {
    if (utils.avoidDocs()) {
      return;
    }

    const {
      descriptionStyle = "body",
    }: {
      descriptionStyle?: "body" | "tag" | "any";
    } = context.options[0] || {};

    let targetTagName = utils.getPreferredTagName({
      skipReportingBlockedTag: descriptionStyle !== "tag",
      tagName: "description",
    });

    if (!targetTagName) {
      return;
    }

    const isBlocked =
      typeof targetTagName === "object" &&
      "blocked" in targetTagName &&
      targetTagName.blocked;
    if (isBlocked) {
      targetTagName = (targetTagName as { blocked: true; tagName: string })
        .tagName;
    }

    if (descriptionStyle !== "tag") {
      const { description } = utils.getDescription();
      if (checkDescription(description || "")) {
        return;
      }

      if (descriptionStyle === "body") {
        const descTags = utils.getPresentTags(["desc", "description"]);
        if (descTags.length) {
          const [{ tag: tagName }] = descTags;
          report(
            `Remove the @${tagName} tag to leave a plain block description or add additional description text above the @${tagName} line.`,
          );
        } else {
          report("Missing JSDoc block description.");
        }
        return;
      }
    }

    const functionExamples = isBlocked
      ? []
      : jsdoc.tags.filter(({ tag }: { tag: string }) => tag === targetTagName);

    if (!functionExamples.length) {
      report(
        descriptionStyle === "any"
          ? `Missing JSDoc block description or @${targetTagName} declaration.`
          : `Missing JSDoc @${targetTagName} declaration.`,
      );
      return;
    }

    for (const example of functionExamples) {
      if (
        !checkDescription(`${example.name} ${utils.getTagDescription(example)}`)
      ) {
        report(`Missing JSDoc @${targetTagName} description.`, null, example);
      }
    }
  },
  {
    contextDefaults: true,
    meta: {
      docs: {
        description: "Requires that all functions have a description.",
        url: "https://github.com/gajus/eslint-plugin-jsdoc/blob/main/docs/rules/require-description.md#repos-sticky-header",
      },
      schema: [
        {
          additionalProperties: false,
          properties: {
            checkConstructors: {
              default: true,
              type: "boolean",
            },
            checkGetters: {
              default: true,
              type: "boolean",
            },
            checkSetters: {
              default: true,
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
                      comment: {
                        type: "string",
                      },
                      context: {
                        type: "string",
                      },
                    },
                    type: "object",
                  },
                ],
              },
              type: "array",
            },
            descriptionStyle: {
              enum: ["body", "tag", "any"],
              type: "string",
            },
            exemptedBy: {
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
