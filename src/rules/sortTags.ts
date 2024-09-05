import defaultTagOrder from "../defaultTagOrder.js";
import iterateJsdoc from "../iterateJsdoc.js";

// eslint-disable-next-line complexity -- Temporary
export default iterateJsdoc(
  ({ context, jsdoc, utils }) => {
    const {
      linesBetween = 1,
      tagSequence = defaultTagOrder,
      alphabetizeExtras = false,
      reportTagGroupSpacing = true,
      reportIntraTagGroupSpacing = true,
    } = context.options[0] || {};

    const tagList = tagSequence.flatMap((obj) => obj.tags);

    const otherPos = tagList.indexOf("-other");
    const endPos = otherPos > -1 ? otherPos : tagList.length;

    let ongoingCount = 0;
    for (const [idx, tag] of (
      jsdoc.tags as (import("@es-joy/jsdoccomment").JsdocTagWithInline & {
        originalIndex: number;
        originalLine: number;
      })[]
    ).entries()) {
      tag.originalIndex = idx;
      ongoingCount += tag.source.length;
      tag.originalLine = ongoingCount;
    }

    let firstChangedTagLine: number | undefined;
    let firstChangedTagIndex: number | undefined;

    const sortedTags = JSON.parse(
      JSON.stringify(jsdoc.tags),
    ) as (import("comment-parser").Spec & {
      originalIndex: number;
      originalLine: number;
    })[];

    sortedTags.sort(
      ({ tag: tagNew }, { originalIndex, originalLine, tag: tagOld }) => {
        if (tagNew === tagOld) {
          return 0;
        }

        const checkOrSetFirstChanged = () => {
          if (!firstChangedTagLine || originalLine < firstChangedTagLine) {
            firstChangedTagLine = originalLine;
            firstChangedTagIndex = originalIndex;
          }
        };

        const newPos = tagList.indexOf(tagNew);
        const oldPos = tagList.indexOf(tagOld);

        const preferredNewPos = newPos === -1 ? endPos : newPos;
        const preferredOldPos = oldPos === -1 ? endPos : oldPos;

        if (preferredNewPos < preferredOldPos) {
          checkOrSetFirstChanged();
          return -1;
        }

        if (preferredNewPos > preferredOldPos) {
          return 1;
        }

        if (!alphabetizeExtras || newPos >= 0) {
          return 0;
        }

        if (tagNew < tagOld) {
          checkOrSetFirstChanged();
          return -1;
        }

        return 1;
      },
    );

    if (firstChangedTagLine === undefined) {
      const lastTagsOfGroup: import("comment-parser").Spec[] = [];
      const badLastTagsOfGroup: [import("comment-parser").Spec, number][] = [];

      const countTagEmptyLines = (
        tag: import("comment-parser").Spec,
      ): number => {
        return tag.source.reduce(
          (acc, { tokens: { description, name, type, end, tag: tg } }) => {
            const empty = !tg && !type && !name && !description;
            return empty ? acc + Number(empty && !end) : 0;
          },
          0,
        );
      };

      let idx = 0;
      for (const { tags } of tagSequence) {
        let innerIdx: number;
        let currentTag: import("comment-parser").Spec;
        let lastTag: import("comment-parser").Spec | undefined;

        do {
          currentTag = jsdoc.tags[idx];
          if (!currentTag) {
            idx++;
            break;
          }

          innerIdx = tags.indexOf(currentTag.tag);

          if (
            innerIdx === -1 &&
            (!tags.includes("-other") ||
              tagSequence.some(({ tags: tgs }) => tgs.includes(currentTag.tag)))
          ) {
            idx++;
            break;
          }

          lastTag = currentTag;
          idx++;
        } while (true);

        idx--;

        if (lastTag) {
          lastTagsOfGroup.push(lastTag);
          const ct = countTagEmptyLines(lastTag);
          if (ct !== linesBetween && jsdoc.tags[idx]) {
            badLastTagsOfGroup.push([lastTag, ct]);
          }
        }
      }

      if (reportTagGroupSpacing && badLastTagsOfGroup.length) {
        const fixer = (tg: import("comment-parser").Spec) => {
          return () => {
            for (const [currIdx, { tokens }] of jsdoc.source.entries()) {
              if (tokens.tag !== "@" + tg.tag) {
                continue;
              }

              let newIdx = currIdx;
              const emptyLine = () => ({
                number: 0,
                source: "",
                tokens: utils.seedTokens({
                  delimiter: "*",
                  start: jsdoc.source[newIdx - 1].tokens.start,
                }),
              });

              let existingEmptyLines = 0;
              while (true) {
                const nextTokens = jsdoc.source[++newIdx]?.tokens;
                if (!nextTokens) {
                  return;
                }

                if (nextTokens.tag) {
                  const lineDiff = linesBetween - existingEmptyLines;
                  if (lineDiff > 0) {
                    const lines = Array.from({ length: lineDiff }, () =>
                      emptyLine(),
                    );
                    jsdoc.source.splice(newIdx, 0, ...lines);
                  } else {
                    jsdoc.source.splice(newIdx + lineDiff, -lineDiff);
                  }

                  break;
                }

                const empty =
                  !nextTokens.type &&
                  !nextTokens.name &&
                  !nextTokens.description;

                if (empty) {
                  existingEmptyLines++;
                } else {
                  existingEmptyLines = 0;
                }
              }

              break;
            }

            for (const [srcIdx, src] of jsdoc.source.entries()) {
              src.number = srcIdx;
            }
          };
        };

        for (const [tg] of badLastTagsOfGroup) {
          utils.reportJSDoc(
            "Tag groups do not have the expected whitespace",
            tg,
            fixer(tg),
          );
        }

        return;
      }

      if (!reportIntraTagGroupSpacing) {
        return;
      }

      for (const [tagIdx, tag] of jsdoc.tags.entries()) {
        if (!jsdoc.tags[tagIdx + 1] || lastTagsOfGroup.includes(tag)) {
          continue;
        }

        const ct = countTagEmptyLines(tag);
        if (ct) {
          const fixer = () => {
            let foundFirstTag = false;
            let currentTag: string | undefined;

            for (const [
              currIdx,
              {
                tokens: { description, name, type, end, tag: tg },
              },
            ] of jsdoc.source.entries()) {
              if (tg) {
                foundFirstTag = true;
                currentTag = tg;
              }

              if (!foundFirstTag) {
                continue;
              }

              if (currentTag && !tg && !type && !name && !description && !end) {
                let nextIdx = currIdx;
                let ignore = true;

                if (
                  lastTagsOfGroup.some(
                    (lastTagOfGroup) => currentTag === "@" + lastTagOfGroup.tag,
                  )
                ) {
                  while (true) {
                    const nextTokens = jsdoc.source[++nextIdx]?.tokens;
                    if (!nextTokens) {
                      break;
                    }

                    if (!nextTokens.tag) {
                      continue;
                    }

                    if (nextTokens.tag === currentTag) {
                      ignore = false;
                    }
                  }
                } else {
                  while (true) {
                    const nextTokens = jsdoc.source[++nextIdx]?.tokens;
                    if (!nextTokens || nextTokens.end) {
                      break;
                    }

                    if (nextTokens.tag) {
                      ignore = false;
                      break;
                    }
                  }
                }

                if (!ignore) {
                  jsdoc.source.splice(currIdx, 1);
                  for (const [srcIdx, src] of jsdoc.source.entries()) {
                    src.number = srcIdx;
                  }
                }
              }
            }
          };

          utils.reportJSDoc(
            "Intra-group tags have unexpected whitespace",
            tag,
            fixer,
          );
        }
      }

      return;
    }

    const firstLine = utils.getFirstLine();

    const fix = () => {
      const itemsToMoveRange = Array.from({
        length: jsdoc.tags.length - firstChangedTagIndex!,
      }).keys();
      const unchangedPriorTagDescriptions = jsdoc.tags
        .slice(0, firstChangedTagIndex!)
        .reduce((ct, { source }) => {
          return ct + source.length - 1;
        }, 0);

      const initialOffset =
        firstLine + firstChangedTagIndex! + unchangedPriorTagDescriptions;

      for (const idx of itemsToMoveRange) {
        utils.removeTag(idx + firstChangedTagIndex!);
      }

      const changedTags = sortedTags.slice(firstChangedTagIndex!);
      let extraTagCount = 0;

      for (const idx of itemsToMoveRange) {
        const changedTag = changedTags[idx];

        utils.addTag(changedTag.tag, extraTagCount + initialOffset + idx, {
          ...changedTag.source[0].tokens,
          end: "",
        });

        for (const { tokens } of changedTag.source.slice(1)) {
          if (!tokens.end) {
            utils.addLine(extraTagCount + initialOffset + idx + 1, {
              ...tokens,
              end: "",
            });
            extraTagCount++;
          }
        }
      }
    };

    utils.reportJSDoc(
      `Tags are not in the prescribed order: ${tagList.join(", ") || "(alphabetical)"}`,
      jsdoc.tags[firstChangedTagIndex!],
      fix,
      true,
    );
  },
  {
    iterateAllJsdocs: true,
    meta: {
      docs: {
        description:
          "Sorts tags by a specified sequence according to tag name.",
        url: "https://github.com/gajus/eslint-plugin-jsdoc/blob/main/docs/rules/sort-tags.md#repos-sticky-header",
      },
      fixable: "code",
      schema: [
        {
          additionalProperties: false,
          properties: {
            alphabetizeExtras: {
              type: "boolean",
            },
            linesBetween: {
              type: "integer",
            },
            reportIntraTagGroupSpacing: {
              type: "boolean",
            },
            reportTagGroupSpacing: {
              type: "boolean",
            },
            tagSequence: {
              items: {
                properties: {
                  tags: {
                    items: {
                      type: "string",
                    },
                    type: "array",
                  },
                },
                type: "object",
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
