import {
  getDecorator,
  getFollowingComment,
  getNonJsdocComment,
  getReducedASTNode,
} from "@es-joy/jsdoccomment";
import { getSettings } from "../iterateJsdoc.js";
import {
  enforcedContexts,
  getContextObject,
  getIndent,
} from "../jsdocUtils.js";

/** @type {import('eslint').Rule.RuleModule} */
export default {
  create(context) {
    /**
     * @typedef {import('eslint').AST.Token | import('estree').Comment | {
     *   type: import('eslint').AST.TokenType|"Line"|"Block"|"Shebang",
     *   range: [number, number],
     *   value: string
     * }} Token
     */

    /**
     * @callback AddComment
     * @param {boolean | undefined} inlineCommentBlock
     * @param {Token} comment
     * @param {string} indent
     * @param {number} lines
     * @param {import('eslint').Rule.RuleFixer} fixer
     */

    const { sourceCode = context.getSourceCode() } = context;
    const settings = getSettings(context);
    if (!settings) {
      return {};
    }

    const {
      contexts = settings.contexts || [],
      contextsAfter = [] as string[],
      contextsBeforeAndAfter = [
        "VariableDeclarator",
        "TSPropertySignature",
        "PropertyDefinition",
      ],
      enableFixer = true,
      enforceJsdocLineStyle = "multi",
      lineOrBlockStyle = "both",
      allowedPrefixes = [
        "@ts-",
        "istanbul ",
        "c8 ",
        "v8 ",
        "eslint",
        "prettier-",
      ],
    } = context.options[0] ?? {};

    let reportingNonJsdoc = false;

    /**
     * @param {string} messageId
     * @param {import('estree').Comment | Token} comment
     * @param {import('eslint').Rule.Node} node
     * @param {import('eslint').Rule.ReportFixer} fixer
     */
    const report = (messageId: string, comment: any, node: any, fixer: any) => {
      const loc = {
        start: {
          line: comment.loc?.start?.line ?? 1,
          column: 0,
        },
        end: {
          line: comment.loc?.end?.line ?? 1,
          column: 0,
        },
      };

      context.report({
        messageId,
        loc,
        node,
        fix: enableFixer ? fixer : null,
      });
    };

    /**
     * @param {import('eslint').Rule.Node} node
     * @param {Token} comment
     * @param {AddComment} addComment
     * @param {import('../iterateJsdoc.js').Context[]} ctxts
     */
    const getFixer = (
      node: any,
      comment: any,
      addComment: AddComment,
      ctxts: any[],
    ) => {
      return (fixer: any) => {
        const lines =
          settings.minLines === 0 && settings.maxLines >= 1
            ? 1
            : settings.minLines;
        let baseNode = getReducedASTNode(node, sourceCode);

        const decorator = getDecorator(baseNode);
        if (decorator) {
          baseNode = decorator;
        }

        const indent = getIndent({
          text: sourceCode.getText(baseNode),
          baseIndent: baseNode.loc.start.column,
        });

        const { inlineCommentBlock } =
          ctxts.find((contxt) => contxt.context === node.type) || {};

        return addComment(inlineCommentBlock, comment, indent, lines, fixer);
      };
    };

    /**
     * @param {Token} comment
     * @param {import('eslint').Rule.Node} node
     * @param {AddComment} addComment
     * @param {import('../iterateJsdoc.js').Context[]} ctxts
     */
    const reportings = (
      comment: any,
      node: any,
      addComment: AddComment,
      ctxts: any[],
    ) => {
      const fixer = getFixer(node, comment, addComment, ctxts);

      if (comment.type === "Block" && lineOrBlockStyle !== "line") {
        report("blockCommentsJsdocStyle", comment, node, fixer);
        return;
      }

      if (comment.type === "Line" && lineOrBlockStyle !== "block") {
        report("lineCommentsJsdocStyle", comment, node, fixer);
      }
    };

    const checkNonJsdoc = (_info: any, _handler: any, node: any) => {
      const comment = getNonJsdocComment(sourceCode, node, settings);

      if (
        !comment ||
        allowedPrefixes.some((prefix) =>
          comment.value.trimStart().startsWith(prefix),
        )
      ) {
        return;
      }

      reportingNonJsdoc = true;

      const addComment: AddComment = (
        inlineCommentBlock,
        comment,
        indent,
        lines,
        fixer,
      ) => {
        const insertion =
          (inlineCommentBlock || enforceJsdocLineStyle === "single"
            ? `/** ${comment.value.trim()} `
            : `/**\n${indent}* ${comment.value.trimEnd()}\n${indent}`) +
          `*/${"\n".repeat((lines || 1) - 1)}`;

        return fixer.replaceText(comment, insertion);
      };

      reportings(comment, node, addComment, contexts);
    };

    const checkNonJsdocAfter = (node: any, ctxts: any[]) => {
      const comment = getFollowingComment(sourceCode, node);

      if (
        !comment ||
        comment.value.startsWith("*") ||
        allowedPrefixes.some((prefix) =>
          comment.value.trimStart().startsWith(prefix),
        )
      ) {
        return;
      }

      const addComment: AddComment = (
        inlineCommentBlock,
        comment,
        indent,
        lines,
        fixer,
      ) => {
        const insertion =
          (inlineCommentBlock || enforceJsdocLineStyle === "single"
            ? `/** ${comment.value.trim()} `
            : `/**\n${indent}* ${comment.value.trimEnd()}\n${indent}`) +
          `*/${"\n".repeat((lines || 1) - 1)}${lines ? `\n${indent.slice(1)}` : " "}`;

        return [
          fixer.remove(comment),
          fixer.insertTextBefore(
            node.type === "VariableDeclarator" ? node.parent : node,
            insertion,
          ),
        ];
      };

      reportings(comment, node, addComment, ctxts);
    };

    return {
      ...getContextObject(
        enforcedContexts(context, true, settings),
        checkNonJsdoc,
      ),
      ...getContextObject(contextsAfter, (_info, _handler, node) => {
        checkNonJsdocAfter(node, contextsAfter);
      }),
      ...getContextObject(contextsBeforeAndAfter, (_info, _handler, node) => {
        checkNonJsdoc({}, null, node);
        if (!reportingNonJsdoc) {
          checkNonJsdocAfter(node, contextsBeforeAndAfter);
        }
      }),
    };
  },
  meta: {
    fixable: "code",

    messages: {
      blockCommentsJsdocStyle: "Block comments should be JSDoc-style.",
      lineCommentsJsdocStyle: "Line comments should be JSDoc-style.",
    },

    docs: {
      description:
        "Converts non-JSDoc comments preceding or following nodes into JSDoc ones",
      url: "https://github.com/gajus/eslint-plugin-jsdoc/blob/main/docs/rules/convert-to-jsdoc-comments.md#repos-sticky-header",
    },
    schema: [
      {
        additionalProperties: false,
        properties: {
          allowedPrefixes: {
            type: "array",
            items: { type: "string" },
          },
          contexts: {
            items: {
              anyOf: [
                { type: "string" },
                {
                  additionalProperties: false,
                  properties: {
                    context: { type: "string" },
                    inlineCommentBlock: { type: "boolean" },
                  },
                  type: "object",
                },
              ],
            },
            type: "array",
          },
          contextsAfter: {
            items: {
              anyOf: [
                { type: "string" },
                {
                  additionalProperties: false,
                  properties: {
                    context: { type: "string" },
                    inlineCommentBlock: { type: "boolean" },
                  },
                  type: "object",
                },
              ],
            },
            type: "array",
          },
          contextsBeforeAndAfter: {
            items: {
              anyOf: [
                { type: "string" },
                {
                  additionalProperties: false,
                  properties: {
                    context: { type: "string" },
                    inlineCommentBlock: { type: "boolean" },
                  },
                  type: "object",
                },
              ],
            },
            type: "array",
          },
          enableFixer: {
            type: "boolean",
          },
          enforceJsdocLineStyle: {
            type: "string",
            enum: ["multi", "single"],
          },
          lineOrBlockStyle: {
            type: "string",
            enum: ["block", "line", "both"],
          },
        },
        type: "object",
      },
    ],
    type: "suggestion",
  },
};
