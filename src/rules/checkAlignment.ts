import { Rule } from "eslint";
import iterateJsdoc from "../iterateJsdoc.js";

/**
 * Trims leading whitespace characters from the start of a string.
 * @param {string} string
 * @returns {string}
 */
const trimStart = (string: string): string => {
  return string.replace(/^\s+/u, "");
};

export default iterateJsdoc(
  ({
    sourceCode,
    jsdocNode,
    report,
    indent,
  }: {
    sourceCode: any;
    jsdocNode: any;
    report: (
      message: string,
      fixer: Rule.ReportFixer,
      location?: { line: number },
    ) => void;
    indent: string;
  }) => {
    // `indent` is whitespace from line 1 (`/**`), so slice and account for "/".
    const indentLevel = indent.length + 1;
    const sourceLines = sourceCode
      .getText(jsdocNode)
      .split("\n")
      .slice(1)
      .map((line: string) => {
        return line.split("*")[0];
      })
      .filter((line: string) => {
        return !trimStart(line).length;
      });

    const fix: Rule.ReportFixer = (fixer) => {
      const replacement = sourceCode
        .getText(jsdocNode)
        .split("\n")
        .map((line: string, index: number) => {
          // Ignore the first line and all lines not starting with `*`
          const ignored = !index || trimStart(line.split("*")[0]).length;

          return ignored ? line : `${indent} ${trimStart(line)}`;
        })
        .join("\n");

      return fixer.replaceText(jsdocNode, replacement);
    };

    sourceLines.some((line: string, lineNum: number) => {
      if (line.length !== indentLevel) {
        report("Expected JSDoc block to be aligned.", fix, {
          line: lineNum + 1,
        });

        return true;
      }

      return false;
    });
  },
  {
    iterateAllJsdocs: true,
    meta: {
      docs: {
        description: "Reports invalid alignment of JSDoc block asterisks.",
        url: "https://github.com/gajus/eslint-plugin-jsdoc/blob/main/docs/rules/check-alignment.md#repos-sticky-header",
      },
      fixable: "code",
      type: "layout",
    },
  },
);
