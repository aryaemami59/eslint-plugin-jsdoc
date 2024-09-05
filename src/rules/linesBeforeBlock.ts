import { Rule } from "eslint";
import iterateJsdoc from "../iterateJsdoc.js";

export default iterateJsdoc(
  ({ context, jsdocNode, sourceCode, report, utils }) => {
    const {
      lines = 1,
      ignoreSameLine = true,
      excludedTags = ["type"],
    }: {
      lines?: number;
      ignoreSameLine?: boolean;
      excludedTags?: string[];
    } = context.options[0] || {};

    if (utils.hasATag(excludedTags)) {
      return;
    }

    const tokensBefore = sourceCode.getTokensBefore(jsdocNode, {
      includeComments: true,
    });
    const tokenBefore = tokensBefore.slice(-1)[0];
    if (!tokenBefore) {
      return;
    }

    if (
      tokenBefore.loc?.end?.line + lines >=
      (jsdocNode.loc?.start?.line as number)
    ) {
      const startLine = jsdocNode.loc?.start?.line;
      const sameLine = tokenBefore.loc?.end?.line === startLine;

      if (sameLine && ignoreSameLine) {
        return;
      }

      const fix: Rule.ReportFixer = (fixer) => {
        let indent = "";
        if (sameLine) {
          const spaceDiff =
            (jsdocNode.loc?.start?.column as number) -
            (tokenBefore.loc?.end?.column as number);

          indent =
            (jsdocNode as unknown as import("estree").Comment).value
              .match(/^\*\n([ \t]*) \*/)?.[1]
              ?.slice(spaceDiff) || "";

          if (!indent) {
            let tokenPrior = tokenBefore;
            let startColumn: number | undefined;

            while (tokenPrior && tokenPrior?.loc?.start?.line === startLine) {
              startColumn = tokenPrior.loc?.start?.column;
              tokenPrior = tokensBefore.pop();
            }

            indent = " ".repeat(startColumn ? startColumn - 1 : 0);
          }
        }

        return fixer.insertTextAfter(
          tokenBefore,
          "\n".repeat(lines) + (sameLine ? "\n" + indent : ""),
        );
      };

      report(`Required ${lines} line(s) before JSDoc block`, fix);
    }
  },
  {
    iterateAllJsdocs: true,
    meta: {
      fixable: "code",
      docs: {
        description:
          "Enforces minimum number of newlines before JSDoc comment blocks",
        url: "https://github.com/gajus/eslint-plugin-jsdoc/blob/main/docs/rules/lines-before-block.md#repos-sticky-header",
      },
      schema: [
        {
          additionalProperties: false,
          properties: {
            excludedTags: {
              type: "array",
              items: {
                type: "string",
              },
            },
            ignoreSameLine: {
              type: "boolean",
            },
            lines: {
              type: "integer",
            },
          },
          type: "object",
        },
      ],
      type: "suggestion",
    },
  },
);
