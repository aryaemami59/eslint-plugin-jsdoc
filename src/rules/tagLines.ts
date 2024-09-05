import iterateJsdoc from "../iterateJsdoc.js";

export default iterateJsdoc(
  ({ context, jsdoc, utils }) => {
    const [
      alwaysNever = "never",
      {
        count = 1,
        endLines = 0,
        startLines = 0,
        applyToEndTag = true,
        tags = {},
      } = {},
    ] = context.options as [
      string?,
      {
        count?: number;
        endLines?: number;
        startLines?: number;
        applyToEndTag?: boolean;
        tags?: Record<
          string,
          { count?: number; lines?: "always" | "never" | "any" }
        >;
      },
    ];

    jsdoc.tags.some((tg, tagIdx) => {
      let lastTag: string | undefined;

      let lastEmpty: number | null = null;
      let reportIndex: number | null = null;
      let emptyLinesCount = 0;
      for (const [
        idx,
        {
          tokens: { tag, name, type, description, end },
        },
      ] of tg.source.entries()) {
        if (description) {
          reportIndex = null;
        }

        if (
          lastTag &&
          ["any", "always"].includes(tags[lastTag.slice(1)]?.lines || "")
        ) {
          continue;
        }

        const empty = !tag && !name && !type && !description;
        if (
          empty &&
          !end &&
          (alwaysNever === "never" ||
            (lastTag && tags[lastTag.slice(1)]?.lines === "never"))
        ) {
          reportIndex = idx;
          continue;
        }

        if (!end) {
          if (empty) {
            emptyLinesCount++;
          } else {
            emptyLinesCount = 0;
          }
          lastEmpty = empty ? idx : null;
        }

        lastTag = tag;
      }

      if (
        typeof endLines === "number" &&
        lastEmpty !== null &&
        tagIdx === jsdoc.tags.length - 1
      ) {
        const lineDiff = endLines - emptyLinesCount;

        if (lineDiff < 0) {
          const fixer = () => {
            utils.removeTag(tagIdx, {
              tagSourceOffset: lastEmpty! + lineDiff + 1,
            });
          };

          utils.reportJSDoc(
            `Expected ${endLines} trailing lines`,
            { line: tg.source[lastEmpty].number + lineDiff + 1 },
            fixer,
          );
        } else if (lineDiff > 0) {
          const fixer = () => {
            utils.addLines(tagIdx, lastEmpty!, endLines - emptyLinesCount);
          };

          utils.reportJSDoc(
            `Expected ${endLines} trailing lines`,
            { line: tg.source[lastEmpty].number },
            fixer,
          );
        }

        return true;
      }

      if (reportIndex !== null) {
        const fixer = () => {
          utils.removeTag(tagIdx, { tagSourceOffset: reportIndex });
        };

        utils.reportJSDoc(
          "Expected no lines between tags",
          { line: tg.source[0].number + 1 },
          fixer,
        );

        return true;
      }

      return false;
    });

    (applyToEndTag ? jsdoc.tags : jsdoc.tags.slice(0, -1)).some(
      (tg, tagIdx) => {
        const lines: { idx: number; number: number }[] = [];

        let currentTag: string | undefined;
        let tagSourceIdx = 0;
        for (const [
          idx,
          {
            number,
            tokens: { tag, name, type, description, end },
          },
        ] of tg.source.entries()) {
          if (description) {
            lines.splice(0, lines.length);
            tagSourceIdx = idx;
          }

          if (tag) {
            currentTag = tag;
          }

          if (!tag && !name && !type && !description && !end) {
            lines.push({ idx, number });
          }
        }

        const currentTg = currentTag && tags[currentTag.slice(1)];
        const tagCount = currentTg?.count;

        const defaultAlways =
          alwaysNever === "always" &&
          currentTg?.lines !== "never" &&
          currentTg?.lines !== "any" &&
          lines.length < count;

        let overrideAlways: boolean | undefined;
        let fixCount = count;
        if (!defaultAlways) {
          fixCount = typeof tagCount === "number" ? tagCount : count;
          overrideAlways =
            currentTg?.lines === "always" && lines.length < fixCount;
        }

        if (defaultAlways || overrideAlways) {
          const fixer = () => {
            utils.addLines(
              tagIdx,
              lines[lines.length - 1]?.idx || tagSourceIdx + 1,
              fixCount - lines.length,
            );
          };

          const line =
            lines[lines.length - 1]?.number || tg.source[tagSourceIdx].number;
          utils.reportJSDoc(
            `Expected ${fixCount} line${fixCount === 1 ? "" : "s"} between tags but found ${lines.length}`,
            { line },
            fixer,
          );

          return true;
        }

        return false;
      },
    );

    if (typeof startLines === "number") {
      if (!jsdoc.tags.length) {
        return;
      }

      const { description, lastDescriptionLine } = utils.getDescription();
      if (!/\S/u.test(description)) {
        return;
      }

      const trailingLines = description.match(/\n+$/u)?.[0]?.length;
      const trailingDiff = (trailingLines ?? 0) - startLines;
      if (trailingDiff > 0) {
        utils.reportJSDoc(
          `Expected only ${startLines} line after block description`,
          { line: lastDescriptionLine - trailingDiff },
          () => {
            utils.setBlockDescription((info, seedTokens, descLines) => {
              return descLines.slice(0, -trailingDiff).map((desc) => ({
                number: 0,
                source: "",
                tokens: seedTokens({
                  ...info,
                  description: desc,
                  postDelimiter: desc.trim() ? info.postDelimiter : "",
                }),
              }));
            });
          },
        );
      } else if (trailingDiff < 0) {
        utils.reportJSDoc(
          `Expected ${startLines} lines after block description`,
          { line: lastDescriptionLine },
          () => {
            utils.setBlockDescription((info, seedTokens, descLines) => {
              return [
                ...descLines,
                ...Array.from({ length: -trailingDiff }, () => ""),
              ].map((desc) => ({
                number: 0,
                source: "",
                tokens: seedTokens({
                  ...info,
                  description: desc,
                  postDelimiter: desc.trim() ? info.postDelimiter : "",
                }),
              }));
            });
          },
        );
      }
    }
  },
  {
    iterateAllJsdocs: true,
    meta: {
      docs: {
        description: "Enforces lines (or no lines) between tags.",
        url: "https://github.com/gajus/eslint-plugin-jsdoc/blob/main/docs/rules/tag-lines.md#repos-sticky-header",
      },
      fixable: "code",
      schema: [
        {
          enum: ["always", "any", "never"],
          type: "string",
        },
        {
          additionalProperties: false,
          properties: {
            applyToEndTag: { type: "boolean" },
            count: { type: "integer" },
            endLines: { anyOf: [{ type: "integer" }, { type: "null" }] },
            startLines: { anyOf: [{ type: "integer" }, { type: "null" }] },
            tags: {
              patternProperties: {
                ".*": {
                  additionalProperties: false,
                  properties: {
                    count: { type: "integer" },
                    lines: { enum: ["always", "never", "any"], type: "string" },
                  },
                },
              },
              type: "object",
            },
          },
          type: "object",
        },
      ],
      type: "suggestion",
    },
  },
);
