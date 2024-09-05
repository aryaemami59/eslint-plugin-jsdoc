import { parse, traverse, tryParse } from "@es-joy/jsdoccomment";
import iterateJsdoc from "../iterateJsdoc.js";

const inlineTags = new Set(["link", "linkcode", "linkplain", "tutorial"]);

const jsdocTypePrattKeywords = new Set(["typeof", "readonly", "import", "is"]);

const asExpression = /as\s+/u;

const suppressTypes = new Set([
  "accessControls",
  "checkDebuggerStatement",
  "checkPrototypalTypes",
  "checkRegExp",
  "checkTypes",
  "checkVars",
  "closureDepMethodUsageChecks",
  "const",
  "constantProperty",
  "deprecated",
  "duplicate",
  "es5Strict",
  "externsValidation",
  "extraProvide",
  "extraRequire",
  "globalThis",
  "invalidCasts",
  "lateProvide",
  "legacyGoogScopeRequire",
  "lintChecks",
  "messageConventions",
  "misplacedTypeAnnotation",
  "missingOverride",
  "missingPolyfill",
  "missingProperties",
  "missingProvide",
  "missingRequire",
  "missingSourcesWarnings",
  "moduleLoad",
  "nonStandardJsDocs",
  "partialAlias",
  "polymer",
  "reportUnknownTypes",
  "strictMissingProperties",
  "strictModuleDepCheck",
  "strictPrimitiveOperators",
  "suspiciousCode",
  "switch",
  "transitionalSuspiciousCodeWarnings",
  "undefinedNames",
  "undefinedVars",
  "underscore",
  "unknownDefines",
  "untranspilableFeatures",
  "unusedLocalVariables",
  "unusedPrivateMembers",
  "useOfGoogProvide",
  "uselessCode",
  "visibility",
  "with",
]);

/**
 * @param {string} path
 * @returns {boolean}
 */
const tryParsePathIgnoreError = (path: string): boolean => {
  try {
    tryParse(path);
    return true;
  } catch {
    // Keep the original error for including the whole type
  }
  return false;
};

// eslint-disable-next-line complexity
export default iterateJsdoc(
  ({ jsdoc, report, utils, context, settings }) => {
    const { allowEmptyNamepaths = false } = context.options[0] || {};
    const { mode } = settings;

    for (const tag of jsdoc.tags) {
      /**
       * @param {string} namepath
       * @param {string} [tagName]
       * @returns {boolean}
       */
      const validNamepathParsing = (
        namepath: string,
        tagName?: string,
      ): boolean => {
        if (
          tryParsePathIgnoreError(namepath) ||
          jsdocTypePrattKeywords.has(namepath)
        ) {
          return true;
        }

        let handled = false;

        if (tagName) {
          switch (tagName) {
            case "requires":
            case "module": {
              if (!namepath.startsWith("module:")) {
                handled = tryParsePathIgnoreError(`module:${namepath}`);
              }
              break;
            }
            case "memberof":
            case "memberof!": {
              const endChar = namepath.slice(-1);
              if (["#", ".", "~"].includes(endChar)) {
                handled = tryParsePathIgnoreError(namepath.slice(0, -1));
              }
              break;
            }
            case "borrows": {
              const startChar = namepath.charAt(0);
              if (["#", ".", "~"].includes(startChar)) {
                handled = tryParsePathIgnoreError(namepath.slice(1));
              }
            }
          }
        }

        if (!handled) {
          report(`Syntax error in namepath: ${namepath}`, null, tag);
          return false;
        }
        return true;
      };

      /**
       * @param {string} type
       * @returns {boolean}
       */
      const validTypeParsing = (type: string): boolean => {
        let parsedTypes;
        try {
          parsedTypes =
            mode === "permissive" ? tryParse(type) : parse(type, mode);
        } catch {
          report(`Syntax error in type: ${type}`, null, tag);
          return false;
        }

        if (mode === "closure" || mode === "typescript") {
          traverse(parsedTypes, (node) => {
            const { type: typ } = node;
            if (
              (typ === "JsdocTypeObjectField" || typ === "JsdocTypeKeyValue") &&
              node.right?.type === "JsdocTypeNullable" &&
              node.right?.meta?.position === "suffix"
            ) {
              report(`Syntax error in type: ${node.right.type}`, null, tag);
            }
          });
        }
        return true;
      };

      if (tag.problems.length) {
        const msg = tag.problems
          .reduce((str, { message }) => {
            return str + "; " + message;
          }, "")
          .slice(2);
        report(`Invalid name: ${msg}`, null, tag);
        continue;
      }

      if (tag.tag === "import") {
        continue;
      }

      if (tag.tag === "borrows") {
        const thisNamepath = /** @type {string} */ utils
          .getTagDescription(tag)
          .replace(asExpression, "")
          .trim();

        if (
          !asExpression.test(
            /** @type {string} */ utils.getTagDescription(tag),
          ) ||
          !thisNamepath
        ) {
          report(
            `@borrows must have an "as" expression. Found "${utils.getTagDescription(tag)}"`,
            null,
            tag,
          );
          continue;
        }

        if (validNamepathParsing(thisNamepath, "borrows")) {
          const thatNamepath = tag.name;
          validNamepathParsing(thatNamepath);
        }
        continue;
      }

      if (tag.tag === "suppress" && mode === "closure") {
        let parsedTypes;
        try {
          parsedTypes = tryParse(tag.type);
        } catch {
          // Ignore
        }

        if (parsedTypes) {
          traverse(parsedTypes, (node) => {
            let type;
            if ("value" in node && typeof node.value === "string") {
              type = node.value;
            }

            if (type !== undefined && !suppressTypes.has(type)) {
              report(`Syntax error in suppress type: ${type}`, null, tag);
            }
          });
        }
      }

      const otherModeMaps =
        /** @type {import('../jsdocUtils.js').ParserMode[]} */ [
          "jsdoc",
          "typescript",
          "closure",
          "permissive",
        ]
          .filter((mde) => mde !== mode)
          .map((mde) => utils.getTagStructureForMode(mde));

      const tagMightHaveNamePosition = utils.tagMightHaveNamePosition(
        tag.tag,
        otherModeMaps,
      );
      if (tagMightHaveNamePosition !== true && tag.name) {
        const modeInfo =
          tagMightHaveNamePosition === false ? "" : ` in "${mode}" mode`;
        report(`@${tag.tag} should not have a name${modeInfo}.`, null, tag);
        continue;
      }

      const mightHaveTypePosition = utils.tagMightHaveTypePosition(
        tag.tag,
        otherModeMaps,
      );
      if (mightHaveTypePosition !== true && tag.type) {
        const modeInfo =
          mightHaveTypePosition === false ? "" : ` in "${mode}" mode`;
        report(
          `@${tag.tag} should not have a bracketed type${modeInfo}.`,
          null,
          tag,
        );
        continue;
      }

      const tagMustHaveNamePosition = utils.tagMustHaveNamePosition(
        tag.tag,
        otherModeMaps,
      );
      if (
        tagMustHaveNamePosition !== false &&
        !tag.name &&
        !allowEmptyNamepaths &&
        !["param", "arg", "argument", "property", "prop"].includes(tag.tag) &&
        (tag.tag !== "see" || !utils.getTagDescription(tag).includes("{@link"))
      ) {
        const modeInfo =
          tagMustHaveNamePosition === true ? "" : ` in "${mode}" mode`;
        report(
          `Tag @${tag.tag} must have a name/namepath${modeInfo}.`,
          null,
          tag,
        );
        continue;
      }

      const mustHaveTypePosition = utils.tagMustHaveTypePosition(
        tag.tag,
        otherModeMaps,
      );
      if (mustHaveTypePosition !== false && !tag.type) {
        const modeInfo =
          mustHaveTypePosition === true ? "" : ` in "${mode}" mode`;
        report(`Tag @${tag.tag} must have a type${modeInfo}.`, null, tag);
        continue;
      }

      const tagMissingRequiredTypeOrNamepath =
        utils.tagMissingRequiredTypeOrNamepath(tag, otherModeMaps);
      if (tagMissingRequiredTypeOrNamepath !== false && !allowEmptyNamepaths) {
        const modeInfo =
          tagMissingRequiredTypeOrNamepath === true ? "" : ` in "${mode}" mode`;
        report(
          `Tag @${tag.tag} must have either a type or namepath${modeInfo}.`,
          null,
          tag,
        );
        continue;
      }

      const hasTypePosition =
        mightHaveTypePosition === true && Boolean(tag.type);
      if (hasTypePosition) {
        validTypeParsing(tag.type);
      }

      const hasNameOrNamepathPosition =
        (tagMustHaveNamePosition !== false ||
          utils.tagMightHaveNamepath(tag.tag)) &&
        Boolean(tag.name);

      if (hasNameOrNamepathPosition) {
        if (mode !== "jsdoc" && tag.tag === "template") {
          for (const namepath of utils.parseClosureTemplateTag(tag)) {
            validNamepathParsing(namepath);
          }
        } else {
          validNamepathParsing(tag.name, tag.tag);
        }
      }

      for (const inlineTag of tag.inlineTags) {
        if (
          inlineTags.has(inlineTag.tag) &&
          !inlineTag.text &&
          !inlineTag.namepathOrURL
        ) {
          report(`Inline tag "${inlineTag.tag}" missing content`, null, tag);
        }
      }
    }

    for (const inlineTag of jsdoc.inlineTags) {
      if (
        inlineTags.has(inlineTag.tag) &&
        !inlineTag.text &&
        !inlineTag.namepathOrURL
      ) {
        report(`Inline tag "${inlineTag.tag}" missing content`);
      }
    }
  },
  {
    iterateAllJsdocs: true,
    meta: {
      docs: {
        description:
          "Requires all types to be valid JSDoc or Closure compiler types without syntax errors.",
        url: "https://github.com/gajus/eslint-plugin-jsdoc/blob/main/docs/rules/valid-types.md#repos-sticky-header",
      },
      schema: [
        {
          additionalProperties: false,
          properties: {
            allowEmptyNamepaths: {
              default: false,
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