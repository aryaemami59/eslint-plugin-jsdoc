import iterateJsdoc from "../iterateJsdoc.js";

/**
 * Type for tags configuration in options
 */
type TagsConfig = null | "any" | Record<string, "always" | "never">;

export default iterateJsdoc(
  ({ sourceCode, utils, report, context, jsdoc, jsdocNode }) => {
    const [mainCircumstance, { tags = null as TagsConfig } = {}] =
      context.options;

    /**
     * Checks if the description of a JSDoc tag starts with a hyphen, based on the given circumstance
     *
     * @param jsdocTag - JSDoc tag object
     * @param targetTagName - Target tag name
     * @param circumstance - Circumstance to check for ("always" or "never")
     */
    const checkHyphens = (
      jsdocTag: import("@es-joy/jsdoccomment").JsdocTagWithInline,
      targetTagName: string,
      circumstance: "always" | "never" = mainCircumstance as "always" | "never",
    ): void => {
      const always = !circumstance || circumstance === "always";
      const desc = utils.getTagDescription(jsdocTag).trim();

      if (!desc) {
        return;
      }

      const startsWithHyphen = /^\s*-/.test(desc);

      if (always && !startsWithHyphen) {
        report(
          `There must be a hyphen before @${targetTagName} description.`,
          (fixer) => {
            const lineIndex = jsdocTag.line;
            const sourceLines = sourceCode.getText(jsdocNode).split("\n");
            const description = desc.split("\n")[0];
            const descriptionIndex =
              sourceLines[lineIndex].lastIndexOf(description);

            const replacementLine =
              sourceLines[lineIndex].slice(0, descriptionIndex) +
              "- " +
              description;
            sourceLines.splice(lineIndex, 1, replacementLine);
            const replacement = sourceLines.join("\n");

            return fixer.replaceText(jsdocNode, replacement);
          },
          jsdocTag,
        );
      } else if (!always && startsWithHyphen) {
        let lines = 0;
        for (const { tokens } of jsdocTag.source) {
          if (tokens.description) {
            break;
          }
          lines++;
        }

        utils.reportJSDoc(
          `There must be no hyphen before @${targetTagName} description.`,
          {
            line: jsdocTag.source[0].number + lines,
          },
          () => {
            for (const { tokens } of jsdocTag.source) {
              if (tokens.description) {
                tokens.description = tokens.description.replace(/^\s*-\s*/, "");
                break;
              }
            }
          },
          true,
        );
      }
    };

    // Apply check for "param" tags
    utils.forEachPreferredTag("param", checkHyphens);

    // Apply check for other tags if provided in config
    if (tags) {
      const tagEntries = Object.entries(tags);
      for (const [tagName, circumstance] of tagEntries) {
        if (tagName === "*") {
          const preferredParamTag = utils.getPreferredTagName({
            tagName: "param",
          });
          for (const { tag } of jsdoc.tags) {
            if (
              tag === preferredParamTag ||
              tagEntries.some(([tagNme]) => tagNme !== "*" && tagNme === tag)
            ) {
              continue;
            }

            utils.forEachPreferredTag(tag, (jsdocTag, targetTagName) => {
              checkHyphens(
                jsdocTag,
                targetTagName,
                circumstance as "always" | "never",
              );
            });
          }
          continue;
        }

        utils.forEachPreferredTag(tagName, (jsdocTag, targetTagName) => {
          checkHyphens(
            jsdocTag,
            targetTagName,
            circumstance as "always" | "never",
          );
        });
      }
    }
  },
  {
    iterateAllJsdocs: true,
    meta: {
      docs: {
        description: "Requires a hyphen before the `@param` description.",
        url: "https://github.com/gajus/eslint-plugin-jsdoc/blob/main/docs/rules/require-hyphen-before-param-description.md#repos-sticky-header",
      },
      fixable: "code",
      schema: [
        {
          enum: ["always", "never"],
          type: "string",
        },
        {
          additionalProperties: false,
          properties: {
            tags: {
              anyOf: [
                {
                  patternProperties: {
                    ".*": {
                      enum: ["always", "never"],
                      type: "string",
                    },
                  },
                  type: "object",
                },
                {
                  enum: ["any"],
                  type: "string",
                },
              ],
            },
          },
          type: "object",
        },
      ],
      type: "layout",
    },
  },
);
