import iterateJsdoc from "../iterateJsdoc.js";

/**
 * Masks excluded content by replacing it with blank lines.
 * @param {string} str - The content string.
 * @param {string[]} excludeTags - Tags to exclude from the content.
 * @returns {string} - The content with excluded sections masked.
 */
const maskExcludedContent = (str: string, excludeTags: string[]): string => {
  const regContent = new RegExp(
    `([ \\t]+\\*)[ \\t]@(?:${excludeTags.join("|")})(?=[ \\n])([\\w|\\W]*?\\n)(?=[ \\t]*\\*(?:[ \\t]*@\\w+\\s|\\/))`,
    "gu",
  );

  return str.replace(regContent, (_match, margin, code) => {
    return (margin + "\n").repeat((code.match(/\n/gu) || []).length);
  });
};

/**
 * Masks code blocks by replacing them with blank lines.
 * @param {string} str - The content string.
 * @returns {string} - The content with code blocks masked.
 */
const maskCodeBlocks = (str: string): string => {
  const regContent =
    /([ \t]+\*)[ \t]```[^\n]*?([\w|\W]*?\n)(?=[ \t]*\*(?:[ \t]*(?:```|@\w+\s)|\/))/gu;

  return str.replaceAll(regContent, (_match, margin, code) => {
    return (margin + "\n").repeat((code.match(/\n/gu) || []).length);
  });
};

export default iterateJsdoc(
  ({
    sourceCode,
    jsdocNode,
    report,
    context,
  }: {
    sourceCode: any;
    jsdocNode: any;
    report: (message: string, fixer: null, location: { line: number }) => void;
    context: { options: Array<{ excludeTags?: string[] }> };
  }) => {
    const options = context.options[0] || {};
    const { excludeTags = ["example"] } = options;

    const reg = /^(?:\/?\**|[ \t]*)\*[ \t]{2}/gmu;
    const textWithoutCodeBlocks = maskCodeBlocks(sourceCode.getText(jsdocNode));
    const text = excludeTags.length
      ? maskExcludedContent(textWithoutCodeBlocks, excludeTags)
      : textWithoutCodeBlocks;

    if (reg.test(text)) {
      const lineBreaks = text.slice(0, reg.lastIndex).match(/\n/gu) || [];
      report("There must be no indentation.", null, {
        line: lineBreaks.length,
      });
    }
  },
  {
    iterateAllJsdocs: true,
    meta: {
      docs: {
        description: "Reports invalid padding inside JSDoc blocks.",
        url: "https://github.com/gajus/eslint-plugin-jsdoc/blob/main/docs/rules/check-indentation.md#repos-sticky-header",
      },
      schema: [
        {
          additionalProperties: false,
          properties: {
            excludeTags: {
              items: {
                pattern: "^\\S+$",
                type: "string",
              },
              type: "array",
            },
          },
          type: "object",
        },
      ],
      type: "layout",
    },
  },
);
