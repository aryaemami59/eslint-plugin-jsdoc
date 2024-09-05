import eslint, { ESLint } from "eslint";
import semver from "semver";
import iterateJsdoc from "../iterateJsdoc.js";

const {
  // @ts-expect-error Older ESLint
  CLIEngine,
} = eslint;

const zeroBasedLineIndexAdjust = -1;
const likelyNestedJSDocIndentSpace = 1;
const preTagSpaceLength = 1;
const firstLinePrefixLength = preTagSpaceLength;
const hasCaptionRegex = /^\s*<caption>([\s\S]*?)<\/caption>/u;

/**
 * Escapes special characters in a string to be used in a regular expression.
 * @param {string} str
 * @returns {string}
 */
const escapeStringRegexp = (str: string): string => {
  return str.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
};

/**
 * Counts occurrences of a character in a string.
 * @param {string} str
 * @param {string} ch
 * @returns {number}
 */
const countChars = (str: string, ch: string): number => {
  return (str.match(new RegExp(escapeStringRegexp(ch), "gu")) || []).length;
};

/** @type {eslint.Linter.RulesRecord} */
const defaultMdRules: eslint.Linter.RulesRecord = {
  "eol-last": 0,
  "import/no-unresolved": 0,
  "import/unambiguous": 0,
  "jsdoc/require-file-overview": 0,
  "jsdoc/require-jsdoc": 0,
  "no-console": 0,
  "no-multiple-empty-lines": 0,
  "no-undef": 0,
  "no-unused-vars": 0,
  "node/no-missing-import": 0,
  "node/no-missing-require": 0,
  "padded-blocks": 0,
};

/** @type {eslint.Linter.RulesRecord} */
const defaultExpressionRules: eslint.Linter.RulesRecord = {
  ...defaultMdRules,
  "chai-friendly/no-unused-expressions": "off",
  "no-empty-function": "off",
  "no-new": "off",
  "no-unused-expressions": "off",
  quotes: ["error", "double"],
  semi: ["error", "never"],
  strict: "off",
};

/**
 * Gets the number of lines and columns in a string.
 * @param {string} text
 * @returns {[number, number]}
 */
const getLinesCols = (text: string): [number, number] => {
  const matchLines = countChars(text, "\n");
  const colDelta = matchLines
    ? text.slice(text.lastIndexOf("\n") + 1).length
    : text.length;

  return [matchLines, colDelta];
};

export default iterateJsdoc(
  ({
    report,
    utils,
    context,
    globalState,
  }: {
    report: (
      message: string,
      fixer: eslint.Rule.ReportFixer | null,
      location?: { column: number; line: number },
    ) => void;
    utils: any;
    context: any;
    globalState: Map<string, any>;
  }) => {
    if (semver.gte(ESLint.version, "8.0.0")) {
      report(
        "This rule does not work for ESLint 8+; you should disable this rule and use the processor mentioned in the docs.",
        null,
        {
          column: 1,
          line: 1,
        },
      );
      return;
    }

    if (!globalState.has("checkExamples-matchingFileName")) {
      globalState.set("checkExamples-matchingFileName", new Map());
    }

    const matchingFileNameMap = globalState.get(
      "checkExamples-matchingFileName",
    ) as Map<string, string>;

    const options = context.options[0] || {};
    let { exampleCodeRegex = null, rejectExampleCodeRegex = null } = options;
    const {
      checkDefaults = false,
      checkParams = false,
      checkProperties = false,
      noDefaultExampleRules = false,
      checkEslintrc = true,
      matchingFileName = null,
      matchingFileNameDefaults = null,
      matchingFileNameParams = null,
      matchingFileNameProperties = null,
      paddedIndent = 0,
      baseConfig = {},
      configFile,
      allowInlineConfig = true,
      reportUnusedDisableDirectives = true,
      captionRequired = false,
    } = options;

    const rulePaths: never[] = [];

    const mdRules = noDefaultExampleRules ? undefined : defaultMdRules;
    const expressionRules = noDefaultExampleRules
      ? undefined
      : defaultExpressionRules;

    if (exampleCodeRegex) {
      exampleCodeRegex = utils.getRegexFromString(exampleCodeRegex);
    }

    if (rejectExampleCodeRegex) {
      rejectExampleCodeRegex = utils.getRegexFromString(rejectExampleCodeRegex);
    }

    const checkSource = ({
      filename,
      defaultFileName,
      rules = expressionRules,
      lines = 0,
      cols = 0,
      skipInit,
      source,
      targetTagName,
      sources = [],
      tag = { line: 0 },
    }: {
      filename: string;
      defaultFileName?: string;
      rules?: eslint.Linter.RulesRecord;
      lines?: number;
      cols?: number;
      skipInit?: boolean;
      source: string;
      targetTagName: string;
      sources?: {
        nonJSPrefacingCols: number;
        nonJSPrefacingLines: number;
        string: string;
      }[];
      tag?: { line: number };
    }) => {
      if (!skipInit) {
        sources.push({
          nonJSPrefacingCols: cols,
          nonJSPrefacingLines: lines,
          string: source,
        });
      }

      const checkRules = function ({
        nonJSPrefacingCols,
        nonJSPrefacingLines,
        string,
      }: {
        nonJSPrefacingCols: number;
        nonJSPrefacingLines: number;
        string: string;
      }) {
        const cliConfig = {
          allowInlineConfig,
          baseConfig,
          configFile,
          reportUnusedDisableDirectives,
          rulePaths,
          rules,
          useEslintrc: checkEslintrc,
        };
        const cliConfigStr = JSON.stringify(cliConfig);

        const src = paddedIndent
          ? string.replace(
              new RegExp(`(^|\n) {${paddedIndent}}(?!$)`, "gu"),
              "\n",
            )
          : string;

        const fileNameMapKey = filename
          ? "a" + cliConfigStr + filename
          : "b" + cliConfigStr + defaultFileName;
        const file = filename || defaultFileName;
        let cliFile;
        if (matchingFileNameMap.has(fileNameMapKey)) {
          cliFile = matchingFileNameMap.get(fileNameMapKey);
        } else {
          const cli = new CLIEngine(cliConfig);
          let config;
          if (filename || checkEslintrc) {
            config = cli.getConfigForFile(file);
          }

          cliFile = new CLIEngine({
            allowInlineConfig,
            baseConfig: { ...baseConfig, ...config },
            configFile,
            reportUnusedDisableDirectives,
            rulePaths,
            rules,
            useEslintrc: false,
          });
          matchingFileNameMap.set(fileNameMapKey, cliFile);
        }

        const {
          results: [{ messages }],
        } = cliFile.executeOnText(src);

        if (!("line" in tag)) {
          tag.line = tag.source[0].number;
        }

        const codeStartLine = (tag.line as number) + nonJSPrefacingLines;
        const codeStartCol = likelyNestedJSDocIndentSpace;

        for (const { message, line, column, severity, ruleId } of messages) {
          const startLine = codeStartLine + line + zeroBasedLineIndexAdjust;
          const startCol =
            codeStartCol +
            (line <= 1
              ? nonJSPrefacingCols + firstLinePrefixLength
              : preTagSpaceLength) +
            column;

          report(
            "@" +
              targetTagName +
              " " +
              (severity === 2 ? "error" : "warning") +
              (ruleId ? " (" + ruleId + ")" : "") +
              ": " +
              message,
            null,
            {
              column: startCol,
              line: startLine,
            },
          );
        }
      };

      for (const targetSource of sources) {
        checkRules(targetSource);
      }
    };

    const getFilenameInfo = (
      filename: string,
      ext: string = "md/*.js",
    ): { defaultFileName: string | undefined; filename: string } => {
      let defaultFileName;
      if (!filename) {
        const jsFileName = context.getFilename();
        if (typeof jsFileName === "string" && jsFileName.includes(".")) {
          defaultFileName = jsFileName.replace(/\.[^.]*$/u, `.${ext}`);
        } else {
          defaultFileName = `dummy.${ext}`;
        }
      }

      return {
        defaultFileName,
        filename,
      };
    };

    if (checkDefaults) {
      const filenameInfo = getFilenameInfo(
        matchingFileNameDefaults,
        "jsdoc-defaults",
      );
      utils.forEachPreferredTag(
        "default",
        (tag: any, targetTagName: string) => {
          if (!tag.description.trim()) {
            return;
          }

          checkSource({
            source: `(${utils.getTagDescription(tag)})`,
            targetTagName,
            ...filenameInfo,
          });
        },
      );
    }

    if (checkParams) {
      const filenameInfo = getFilenameInfo(
        matchingFileNameParams,
        "jsdoc-params",
      );
      utils.forEachPreferredTag("param", (tag: any, targetTagName: string) => {
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
      utils.forEachPreferredTag(
        "property",
        (tag: any, targetTagName: string) => {
          if (!tag.default || !tag.default.trim()) {
            return;
          }

          checkSource({
            source: `(${tag.default})`,
            targetTagName,
            ...filenameInfo,
          });
        },
      );
    }

    const tagName = utils.getPreferredTagName({
      tagName: "example",
    }) as string;
    if (!utils.hasTag(tagName)) {
      return;
    }

    const matchingFilenameInfo = getFilenameInfo(matchingFileName);

    utils.forEachPreferredTag("example", (tag: any, targetTagName: string) => {
      let source = utils.getTagDescription(tag) as string;
      const match = source.match(hasCaptionRegex);

      if (captionRequired && (!match || !match[1].trim())) {
        report("Caption is expected for examples.", null, tag);
      }

      source = source.replace(hasCaptionRegex, "");
      const [lines, cols] = match ? getLinesCols(match[0]) : [0, 0];

      if (
        (exampleCodeRegex && !exampleCodeRegex.test(source)) ||
        (rejectExampleCodeRegex && rejectExampleCodeRegex.test(source))
      ) {
        return;
      }

      const sources: {
        nonJSPrefacingCols: number;
        nonJSPrefacingLines: number;
        string: string;
      }[] = [];
      let skipInit = false;
      if (exampleCodeRegex) {
        let nonJSPrefacingCols = 0;
        let nonJSPrefacingLines = 0;

        let startingIndex = 0;
        let lastStringCount = 0;

        let exampleCode;
        exampleCodeRegex.lastIndex = 0;
        while ((exampleCode = exampleCodeRegex.exec(source)) !== null) {
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
          startingIndex = exampleCodeRegex.lastIndex;
          lastStringCount = countChars(string, "\n");
          if (!exampleCodeRegex.global) {
            break;
          }
        }

        skipInit = true;
      }

      checkSource({
        cols,
        lines,
        rules: mdRules,
        skipInit,
        source,
        sources,
        tag,
        targetTagName,
        ...matchingFilenameInfo,
      });
    });
  },
  {
    iterateAllJsdocs: true,
    meta: {
      docs: {
        description:
          "Ensures that (JavaScript) examples within JSDoc adhere to ESLint rules.",
        url: "https://github.com/gajus/eslint-plugin-jsdoc/blob/main/docs/rules/check-examples.md#repos-sticky-header",
      },
      schema: [
        {
          additionalProperties: false,
          properties: {
            allowInlineConfig: {
              default: true,
              type: "boolean",
            },
            baseConfig: {
              type: "object",
            },
            captionRequired: {
              default: false,
              type: "boolean",
            },
            checkDefaults: {
              default: false,
              type: "boolean",
            },
            checkEslintrc: {
              default: true,
              type: "boolean",
            },
            checkParams: {
              default: false,
              type: "boolean",
            },
            checkProperties: {
              default: false,
              type: "boolean",
            },
            configFile: {
              type: "string",
            },
            exampleCodeRegex: {
              type: "string",
            },
            matchingFileName: {
              type: "string",
            },
            matchingFileNameDefaults: {
              type: "string",
            },
            matchingFileNameParams: {
              type: "string",
            },
            matchingFileNameProperties: {
              type: "string",
            },
            noDefaultExampleRules: {
              default: false,
              type: "boolean",
            },
            paddedIndent: {
              default: 0,
              type: "integer",
            },
            rejectExampleCodeRegex: {
              type: "string",
            },
            reportUnusedDisableDirectives: {
              default: true,
              type: "boolean",
            },
          },
          type: "object",
        },
      ],
      type: "suggestion",
    },
  },
);
