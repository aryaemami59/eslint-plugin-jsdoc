import escapeStringRegexp from "escape-string-regexp";
import iterateJsdoc from "../iterateJsdoc.js";

const otherDescriptiveTags = new Set([
  "summary",
  "file",
  "fileoverview",
  "overview",
  "classdesc",
  "todo",
  "deprecated",
  "throws",
  "exception",
  "yields",
  "yield",
]);

/**
 * @param {string} text
 * @returns {string[]}
 */
const extractParagraphs = (text: string): string[] => {
  return text.split(/(?<![;:])\n\n+/u);
};

/**
 * @param {string} text
 * @param {string | RegExp} abbreviationsRegex
 * @returns {string[]}
 */
const extractSentences = (
  text: string,
  abbreviationsRegex: string | RegExp,
): string[] => {
  const txt = text
    .replaceAll(/(?<!^)\{[\s\S]*?\}\s*/gu, "")
    .replace(abbreviationsRegex, "");

  const sentenceEndGrouping = /([.?!])(?:\s+|$)/gu;

  const puncts = [...txt.matchAll(sentenceEndGrouping)].map((sentEnd) => {
    return sentEnd[0];
  });

  return txt.split(/[.?!](?:\s+|$)/u).map((sentence, idx) => {
    return !puncts[idx] && /^\s*$/u.test(sentence)
      ? sentence
      : `${sentence}${puncts[idx] || ""}`;
  });
};

/**
 * @param {string} text
 * @returns {boolean}
 */
const isNewLinePrecededByAPeriod = (text: string): boolean => {
  let lastLineEndsSentence: boolean | undefined;

  const lines = text.split("\n");

  return !lines.some((line) => {
    if (lastLineEndsSentence === false && /^[A-Z][a-z]/u.test(line)) {
      return true;
    }

    lastLineEndsSentence = /[.:?!|]$/u.test(line);

    return false;
  });
};

/**
 * @param {string} str
 * @returns {boolean}
 */
const isCapitalized = (str: string): boolean => {
  return str[0] === str[0].toUpperCase();
};

/**
 * @param {string} str
 * @returns {boolean}
 */
const isTable = (str: string): boolean => {
  return str.charAt(0) === "|";
};

/**
 * @param {string} str
 * @returns {string}
 */
const capitalize = (str: string): string => {
  return str.charAt(0).toUpperCase() + str.slice(1);
};

/**
 * @param {string} description
 * @param {import('../iterateJsdoc.js').Report} reportOrig
 * @param {import('eslint').Rule.Node} jsdocNode
 * @param {string | RegExp} abbreviationsRegex
 * @param {import('eslint').SourceCode} sourceCode
 * @param {import('comment-parser').Spec | { line: number }} tag
 * @param {boolean} newlineBeforeCapsAssumesBadSentenceEnd
 * @returns {boolean}
 */
const validateDescription = (
  description: string,
  reportOrig: any,
  jsdocNode: any,
  abbreviationsRegex: string | RegExp,
  sourceCode: any,
  tag: any,
  newlineBeforeCapsAssumesBadSentenceEnd: boolean,
): boolean => {
  if (!description || /^\n+$/u.test(description)) {
    return false;
  }

  const descriptionNoHeadings = description.replaceAll(
    /^\s*#[^\n]*(\n|$)/gm,
    "",
  );
  const paragraphs = extractParagraphs(descriptionNoHeadings).filter(Boolean);

  return paragraphs.some((paragraph, parIdx) => {
    const sentences = extractSentences(paragraph, abbreviationsRegex);

    const fix = (fixer: any): any => {
      let text = sourceCode.getText(jsdocNode);

      if (!/[.:?!]$/u.test(paragraph)) {
        const line = paragraph.split("\n").filter(Boolean).pop();
        text = text.replace(
          new RegExp(`${escapeStringRegexp(line as string)}$`, "mu"),
          `${line}.`,
        );
      }

      for (const sentence of sentences.filter((sentence_) => {
        return (
          !/^\s*$/u.test(sentence_) &&
          !isCapitalized(sentence_) &&
          !isTable(sentence_)
        );
      })) {
        const beginning = sentence.split("\n")[0];

        if ("tag" in tag && tag.tag) {
          const reg = new RegExp(
            `(@${escapeStringRegexp(tag.tag)}.*)${escapeStringRegexp(beginning)}`,
            "u",
          );
          text = text.replace(reg, (_$0, $1) => $1 + capitalize(beginning));
        } else {
          text = text.replace(
            new RegExp(
              "((?:[.?!]|\\*|\\})\\s*)" + escapeStringRegexp(beginning),
              "u",
            ),
            "$1" + capitalize(beginning),
          );
        }
      }

      return fixer.replaceText(jsdocNode, text);
    };

    const report = (msg: string, fixer: any, tagObj: any): void => {
      if ("line" in tagObj) {
        (tagObj as { line: number }).line += parIdx * 2;
      } else {
        (tagObj as any).source[0].number += parIdx * 2;
      }

      tagObj.column = 0;
      reportOrig(msg, fixer, tagObj);
    };

    if (sentences.some((sentence) => /^[.?!]$/u.test(sentence))) {
      report("Sentences must be more than punctuation.", null, tag);
    }

    if (
      sentences.some(
        (sentence) =>
          !/^\s*$/u.test(sentence) &&
          !isCapitalized(sentence) &&
          !isTable(sentence),
      )
    ) {
      report("Sentences should start with an uppercase character.", fix, tag);
    }

    const paragraphNoAbbreviations = paragraph.replace(abbreviationsRegex, "");

    if (!/(?:[.?!|]|```)\s*$/u.test(paragraphNoAbbreviations)) {
      report("Sentences must end with a period.", fix, tag);
      return true;
    }

    if (
      newlineBeforeCapsAssumesBadSentenceEnd &&
      !isNewLinePrecededByAPeriod(paragraphNoAbbreviations)
    ) {
      report(
        "A line of text is started with an uppercase character, but the preceding line does not end the sentence.",
        null,
        tag,
      );
      return true;
    }

    return false;
  });
};

export default iterateJsdoc(
  ({
    sourceCode,
    context,
    jsdoc,
    report,
    jsdocNode,
    utils,
  }: {
    sourceCode: any;
    context: any;
    jsdoc: any;
    report: any;
    jsdocNode: any;
    utils: any;
  }) => {
    const {
      abbreviations = [],
      newlineBeforeCapsAssumesBadSentenceEnd = false,
    }: {
      abbreviations: string[];
      newlineBeforeCapsAssumesBadSentenceEnd: boolean;
    } = context.options[0] || {};

    const abbreviationsRegex = abbreviations.length
      ? new RegExp(
          "\\b" +
            abbreviations
              .map((abbreviation) => {
                return escapeStringRegexp(
                  abbreviation.replaceAll(/\.$/gu, "") + ".",
                );
              })
              .join("|") +
            "(?:$|\\s)",
          "gu",
        )
      : "";

    let { description } = utils.getDescription();

    const indices = [...description.matchAll(/```[\s\S]*```/gu)]
      .map((match) => {
        const { index } = match;
        const [{ length }] = match;
        return { index, length };
      })
      .reverse();

    for (const { index, length } of indices) {
      description =
        description.slice(0, index) + description.slice(index + length);
    }

    if (
      validateDescription(
        description,
        report,
        jsdocNode,
        abbreviationsRegex,
        sourceCode,
        {
          line: jsdoc.source[0].number + 1,
        },
        newlineBeforeCapsAssumesBadSentenceEnd,
      )
    ) {
      return;
    }

    utils.forEachPreferredTag(
      "description",
      (matchingJsdocTag: any) => {
        const desc =
          `${matchingJsdocTag.name} ${utils.getTagDescription(matchingJsdocTag)}`.trim();
        validateDescription(
          desc,
          report,
          jsdocNode,
          abbreviationsRegex,
          sourceCode,
          matchingJsdocTag,
          newlineBeforeCapsAssumesBadSentenceEnd,
        );
      },
      true,
    );

    const { tagsWithNames } = utils.getTagsByType(jsdoc.tags);
    const tagsWithoutNames = utils.filterTags(
      ({ tag: tagName }: { tag: string }) => {
        return (
          otherDescriptiveTags.has(tagName) ||
          (utils.hasOptionTag(tagName) &&
            !tagsWithNames.some(({ tag }: { tag: string }) => tag === tagName))
        );
      },
    );

    tagsWithNames.some((tag: any) => {
      const desc = utils.getTagDescription(tag).replace(/^- /u, "").trimEnd();
      return validateDescription(
        desc,
        report,
        jsdocNode,
        abbreviationsRegex,
        sourceCode,
        tag,
        newlineBeforeCapsAssumesBadSentenceEnd,
      );
    });

    tagsWithoutNames.some((tag: any) => {
      const desc = `${tag.name} ${utils.getTagDescription(tag)}`.trim();
      return validateDescription(
        desc,
        report,
        jsdocNode,
        abbreviationsRegex,
        sourceCode,
        tag,
        newlineBeforeCapsAssumesBadSentenceEnd,
      );
    });
  },
  {
    iterateAllJsdocs: true,
    meta: {
      docs: {
        description:
          "Requires that block description, explicit `@description`, and `@param`/`@returns` tag descriptions are written in complete sentences.",
        url: "https://github.com/gajus/eslint-plugin-jsdoc/blob/main/docs/rules/require-description-complete-sentence.md#repos-sticky-header",
      },
      fixable: "code",
      schema: [
        {
          additionalProperties: false,
          properties: {
            abbreviations: {
              items: { type: "string" },
              type: "array",
            },
            newlineBeforeCapsAssumesBadSentenceEnd: { type: "boolean" },
            tags: {
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
