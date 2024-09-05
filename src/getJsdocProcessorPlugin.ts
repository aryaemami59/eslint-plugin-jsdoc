// Todo: Support TS by fenced block type

import { parseComment } from "@es-joy/jsdoccomment";
import { Linter } from "eslint";
import * as espree from "espree";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  forEachPreferredTag,
  getPreferredTagName,
  getRegexFromString,
  getTagDescription,
  hasTag,
} from "./jsdocUtils.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

const { version } = JSON.parse(
  readFileSync(join(__dirname, "../package.json"), "utf-8"),
);

// const zeroBasedLineIndexAdjust = -1;
const likelyNestedJSDocIndentSpace = 1;
const preTagSpaceLength = 1;

// If a space is present, we should ignore it
const firstLinePrefixLength = preTagSpaceLength;

const hasCaptionRegex = /^\s*<caption>([\s\S]*?)<\/caption>/u;

const escapeStringRegexp = (str: string): string => {
  return str.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
};

const countChars = (str: string, ch: string): number => {
  return (str.match(new RegExp(escapeStringRegexp(ch), "gu")) || []).length;
};

const getLinesCols = (text: string): [number, number] => {
  const matchLines = countChars(text, "\n");

  const colDelta = matchLines
    ? text.slice(text.lastIndexOf("\n") + 1).length
    : text.length;

  return [matchLines, colDelta];
};

type Integer = number;

interface JsdocProcessorOptions {
  captionRequired?: boolean;
  paddedIndent?: Integer;
  checkDefaults?: boolean;
  checkParams?: boolean;
  checkExamples?: boolean;
  checkProperties?: boolean;
  matchingFileName?: string;
  matchingFileNameDefaults?: string;
  matchingFileNameParams?: string;
  matchingFileNameProperties?: string;
  exampleCodeRegex?: string;
  rejectExampleCodeRegex?: string;
  sourceType?: "script" | "module";
  parser?: Linter.ESTreeParser | Linter.NonESTreeParser;
}

export const getJsdocProcessorPlugin = (
  options: JsdocProcessorOptions = {},
) => {
  const {
    exampleCodeRegex = null,
    rejectExampleCodeRegex = null,
    checkExamples = true,
    checkDefaults = false,
    checkParams = false,
    checkProperties = false,
    matchingFileName = null,
    matchingFileNameDefaults = null,
    matchingFileNameParams = null,
    matchingFileNameProperties = null,
    paddedIndent = 0,
    captionRequired = false,
    sourceType = "module",
    parser = undefined,
  } = options;

  let exampleCodeRegExp: RegExp | undefined;
  let rejectExampleCodeRegExp: RegExp | undefined;

  if (exampleCodeRegex) {
    exampleCodeRegExp = getRegexFromString(exampleCodeRegex);
  }

  if (rejectExampleCodeRegex) {
    rejectExampleCodeRegExp = getRegexFromString(rejectExampleCodeRegex);
  }

  const otherInfo: {
    targetTagName: string;
    ext: string;
    codeStartLine: number;
    codeStartCol: number;
    nonJSPrefacingCols: number;
    commentLineCols: [number, number];
  }[] = [];

  let extraMessages: Linter.LintMessage[] = [];

  const getTextsAndFileNames = (
    jsdoc: any, // Replace with appropriate type
    jsFileName: string,
    commentLineCols: [number, number],
  ): { text: string; filename: string | null | undefined }[] => {
    const textsAndFileNames: {
      text: string;
      filename: string | null | undefined;
    }[] = [];

    const checkSource = ({
      filename,
      ext,
      defaultFileName,
      lines = 0,
      cols = 0,
      skipInit,
      source,
      targetTagName,
      sources = [],
      tag = {
        line: 0,
      },
    }: {
      filename: string | null;
      ext: string;
      defaultFileName: string | undefined;
      lines?: Integer;
      cols?: Integer;
      skipInit?: boolean;
      source: string;
      targetTagName: string;
      sources?: {
        nonJSPrefacingCols: Integer;
        nonJSPrefacingLines: Integer;
        string: string;
      }[];
      tag: { line: Integer };
    }) => {
      if (!skipInit) {
        sources.push({
          nonJSPrefacingCols: cols,
          nonJSPrefacingLines: lines,
          string: source,
        });
      }

      const addSourceInfo = ({
        nonJSPrefacingCols,
        nonJSPrefacingLines,
        string,
      }: {
        nonJSPrefacingCols: Integer;
        nonJSPrefacingLines: Integer;
        string: string;
      }) => {
        const src = paddedIndent
          ? string.replace(
              new RegExp(`(^|\n) {${paddedIndent}}(?!$)`, "gu"),
              "\n",
            )
          : string;

        const file = filename || defaultFileName;

        if (!("line" in tag)) {
          tag.line = tag.source[0].number;
        }

        const codeStartLine = tag.line + nonJSPrefacingLines;
        const codeStartCol = likelyNestedJSDocIndentSpace;

        textsAndFileNames.push({
          text: src,
          filename: file,
        });
        otherInfo.push({
          targetTagName,
          ext,
          codeStartLine,
          codeStartCol,
          nonJSPrefacingCols,
          commentLineCols,
        });
      };

      for (const targetSource of sources) {
        addSourceInfo(targetSource);
      }
    };

    const getFilenameInfo = (
      filename: string | null,
      ext = "md/*.js",
    ): {
      defaultFileName: string | undefined;
      filename: string | null;
      ext: string;
    } => {
      let defaultFileName;
      if (!filename) {
        if (typeof jsFileName === "string" && jsFileName.includes(".")) {
          defaultFileName = jsFileName.replace(/\.[^.]*$/u, `.${ext}`);
        } else {
          defaultFileName = `dummy.${ext}`;
        }
      }

      return {
        ext,
        defaultFileName,
        filename,
      };
    };

    if (checkDefaults) {
      const filenameInfo = getFilenameInfo(
        matchingFileNameDefaults,
        "jsdoc-defaults",
      );
      forEachPreferredTag(jsdoc, "default", (tag, targetTagName) => {
        if (!tag.description.trim()) {
          return;
        }

        checkSource({
          source: `(${getTagDescription(tag)})`,
          targetTagName,
          ...filenameInfo,
        });
      });
    }

    if (checkParams) {
      const filenameInfo = getFilenameInfo(
        matchingFileNameParams,
        "jsdoc-params",
      );
      forEachPreferredTag(jsdoc, "param", (tag, targetTagName) => {
        if (!tag.default || !tag.default.trim()) {
          return;
        }

        checkSource({
          source: `(${tag.default})`,
          targetTagName,
          ...filenameInfo,
        });
      });
    }

    if (checkProperties) {
      const filenameInfo = getFilenameInfo(
        matchingFileNameProperties,
        "jsdoc-properties",
      );
      forEachPreferredTag(jsdoc, "property", (tag, targetTagName) => {
        if (!tag.default || !tag.default.trim()) {
          return;
        }

        checkSource({
          source: `(${tag.default})`,
          targetTagName,
          ...filenameInfo,
        });
      });
    }

    if (!checkExamples) {
      return textsAndFileNames;
    }

    const tagName = getPreferredTagName(jsdoc, {
      tagName: "example",
    });
    if (!hasTag(jsdoc, tagName)) {
      return textsAndFileNames;
    }

    const matchingFilenameInfo = getFilenameInfo(matchingFileName);

    forEachPreferredTag(jsdoc, "example", (tag, targetTagName) => {
      let source = getTagDescription(tag);
      const match = source.match(hasCaptionRegex);

      if (captionRequired && (!match || !match[1].trim())) {
        extraMessages.push({
          line: 1 + commentLineCols[0] + (tag.line ?? tag.source[0].number),
          column: commentLineCols[1] + 1,
          severity: 2,
          message: `@${targetTagName} error - Caption is expected for examples.`,
          ruleId: "jsdoc/example-missing-caption",
        });
        return;
      }

      source = source.replace(hasCaptionRegex, "");
      const [lines, cols] = match ? getLinesCols(match[0]) : [0, 0];

      if (
        (exampleCodeRegex && !exampleCodeRegExp?.test(source)) ||
        (rejectExampleCodeRegex && rejectExampleCodeRegExp?.test(source))
      ) {
        return;
      }

      const sources: {
        nonJSPrefacingCols: Integer;
        nonJSPrefacingLines: Integer;
        string: string;
      }[] = [];
      let skipInit = false;
      if (exampleCodeRegex) {
        let nonJSPrefacingCols = 0;
        let nonJSPrefacingLines = 0;

        let startingIndex = 0;
        let lastStringCount = 0;

        let exampleCode;
        exampleCodeRegExp!.lastIndex = 0;
        while ((exampleCode = exampleCodeRegExp!.exec(source)) !== null) {
          const { index, "0": n0, "1": n1 } = exampleCode;

          const preMatch = source.slice(startingIndex, index);

          const [preMatchLines, colDelta] = getLinesCols(preMatch);

          let nonJSPreface;
          let nonJSPrefaceLineCount;
          if (n1) {
            const idx = n0.indexOf(n1);
            nonJSPreface = n0.slice(0, idx);
            nonJSPrefaceLineCount = countChars(nonJSPreface, "\n");
          } else {
            nonJSPreface = "";
            nonJSPrefaceLineCount = 0;
          }

          nonJSPrefacingLines +=
            lastStringCount + preMatchLines + nonJSPrefaceLineCount;

          if (nonJSPrefaceLineCount) {
            const charsInLastLine = nonJSPreface.slice(
              nonJSPreface.lastIndexOf("\n") + 1,
            ).length;
            nonJSPrefacingCols += charsInLastLine;
          } else {
            nonJSPrefacingCols += colDelta + nonJSPreface.length;
          }

          const string = n1 || n0;
          sources.push({
            nonJSPrefacingCols,
            nonJSPrefacingLines,
            string,
          });
          startingIndex = exampleCodeRegExp!.lastIndex;
          lastStringCount = countChars(string, "\n");
          if (!exampleCodeRegExp!.global) {
            break;
          }
        }

        skipInit = true;
      }

      checkSource({
        cols,
        lines,
        skipInit,
        source,
        sources,
        tag,
        targetTagName,
        ...matchingFilenameInfo,
      });
    });

    return textsAndFileNames;
  };

  return {
    meta: {
      name: "eslint-plugin-jsdoc/processor",
      version,
    },
    processors: {
      examples: {
        meta: {
          name: "eslint-plugin-jsdoc/preprocessor",
          version,
        },
        preprocess(text: string, filename: string) {
          try {
            let ast;

            try {
              ast = parser
                ? parser.parseForESLint(text, {
                    ecmaVersion: "latest",
                    sourceType,
                    comment: true,
                  }).ast
                : espree.parse(text, {
                    ecmaVersion: "latest",
                    sourceType,
                    comment: true,
                  });
            } catch (err) {
              return [text];
            }

            const commentLineCols: [number, number][] = [];
            const jsdocComments = (ast.comments ?? [])
              .filter((comment) => /^\*\s/u.test(comment.value))
              .map((comment) => {
                const [start] = comment.range ?? [];
                const textToStart = text.slice(0, start);

                const [lines, cols] = getLinesCols(textToStart);
                commentLineCols.push([lines, cols]);
                return parseComment(comment);
              });

            return [
              text,
              ...jsdocComments
                .flatMap((jsdoc, idx) =>
                  getTextsAndFileNames(jsdoc, filename, commentLineCols[idx]),
                )
                .filter(Boolean),
            ];
          } catch (err) {
            console.log("err", filename, err);
          }
        },

        postprocess(
          [jsMessages, ...messages]: Linter.LintMessage[][],
          filename: string,
        ) {
          messages.forEach((message, idx) => {
            const {
              targetTagName,
              codeStartLine,
              codeStartCol,
              nonJSPrefacingCols,
              commentLineCols,
            } = otherInfo[idx];

            message.forEach((msg) => {
              const {
                message,
                ruleId,
                severity,
                fatal,
                line,
                column,
                endColumn,
                endLine,
              } = msg;

              const [codeCtxLine, codeCtxColumn] = commentLineCols;
              const startLine = codeCtxLine + codeStartLine + line;
              const startCol =
                1 +
                codeCtxColumn +
                codeStartCol +
                (line <= 1
                  ? nonJSPrefacingCols + firstLinePrefixLength
                  : preTagSpaceLength) +
                column;

              msg.message =
                "@" +
                targetTagName +
                " " +
                (severity === 2 ? "error" : "warning") +
                (ruleId ? " (" + ruleId + ")" : "") +
                ": " +
                (fatal ? "Fatal: " : "") +
                message;
              msg.line = startLine;
              msg.column = startCol;
              msg.endLine = endLine ? startLine + endLine : startLine;
              msg.endColumn = endColumn
                ? startCol - column + endColumn
                : startCol;
            });
          });

          const ret = [...jsMessages].concat(...messages, ...extraMessages);
          extraMessages = [];
          return ret;
        },
        supportsAutofix: true,
      },
    },
  };
};
