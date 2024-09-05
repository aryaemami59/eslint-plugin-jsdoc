import type { Rule } from "eslint";
import exportParser from "../exportParser.js";
import type { Context, Settings, Utils } from "../iterateJsdoc.js";
import iterateJsdoc from "../iterateJsdoc.js";

/**
 * We can skip checking for a return value, in case the documentation is inherited
 * or the method is either a constructor or an abstract method.
 *
 * In either of these cases, the return value is optional or not defined.
 * @param utils - A reference to the utils used to probe if a tag is present or not.
 * @returns True if deep checking can be skipped; otherwise, false.
 */
const canSkip = (utils: Utils): boolean => {
  return (
    utils.hasATag([
      // Inheritdoc implies that all documentation is inherited
      // see https://jsdoc.app/tags-inheritdoc.html
      //
      // Abstract methods are by definition incomplete,
      // so it is not an error if it declares a return value but does not implement it.
      "abstract",
      "virtual",

      // Constructors do not have a return value by definition (https://jsdoc.app/tags-class.html)
      // So we can bail out here, too.
      "class",
      "constructor",

      // Return type is specified by type in @type
      "type",

      // This seems to imply a class as well
      "interface",
    ]) || utils.avoidDocs()
  );
};

export default iterateJsdoc(
  ({
    info: { comment },
    node,
    report,
    settings,
    utils,
    context,
  }: {
    info: { comment: string };
    node: any;
    report: (message: string) => void;
    settings: Settings;
    utils: Utils;
    context: Context;
  }) => {
    const {
      contexts,
      enableFixer = false,
      forceRequireReturn = false,
      forceReturnsWithAsync = false,
      publicOnly = false,
    } = context.options[0] || {};

    // A preflight check. We do not need to run a deep check
    // in case the @returns comment is optional or undefined.
    if (canSkip(utils)) {
      return;
    }

    let forceRequireReturnContext: boolean | undefined;
    if (contexts) {
      const { foundContext } = utils.findContext(contexts, comment);
      if (typeof foundContext === "object") {
        forceRequireReturnContext = foundContext.forceRequireReturn;
      }
    }

    const tagName = utils.getPreferredTagName({
      tagName: "returns",
    }) as string;
    if (!tagName) {
      return;
    }

    const tags = utils.getTags(tagName);

    if (tags.length > 1) {
      report(`Found more than one @${tagName} declaration.`);
    }

    const iteratingFunction = utils.isIteratingFunction();

    // In case the code returns something, we expect a return value in JSDoc.
    const [tag] = tags;
    const missingReturnTag = typeof tag === "undefined" || tag === null;

    const shouldReport = (): boolean => {
      if (!missingReturnTag) {
        return false;
      }

      if (publicOnly) {
        type RequireJsdocOpts = {
          ancestorsOnly: boolean;
          esm: boolean;
          initModuleExports: boolean;
          initWindow: boolean;
        };

        const opt: RequireJsdocOpts = {
          ancestorsOnly: Boolean(
            (publicOnly && publicOnly["ancestorsOnly"]) ?? false,
          ),
          esm: Boolean((publicOnly && publicOnly["esm"]) ?? true),
          initModuleExports: Boolean((publicOnly && publicOnly["cjs"]) ?? true),
          initWindow: Boolean((publicOnly && publicOnly["window"]) ?? false),
        };

        /* c8 ignore next -- Fallback to deprecated method */
        const { sourceCode = context.getSourceCode() } = context;
        const exported = exportParser.isUncommentedExport(
          node as Rule.Node,
          sourceCode,
          opt,
          settings,
        );

        if (!exported) {
          return false;
        }
      }

      if (
        (forceRequireReturn || forceRequireReturnContext) &&
        (iteratingFunction || utils.isVirtualFunction())
      ) {
        return true;
      }

      const isAsync =
        (!iteratingFunction && utils.hasTag("async")) ||
        (iteratingFunction && utils.isAsync());

      if (forceReturnsWithAsync && isAsync) {
        return true;
      }

      return (
        iteratingFunction &&
        utils.hasValueOrExecutorHasNonEmptyResolveValue(forceReturnsWithAsync)
      );
    };

    if (shouldReport()) {
      utils.reportJSDoc(
        `Missing JSDoc @${tagName} declaration.`,
        null,
        enableFixer
          ? () => {
              utils.addTag(tagName);
            }
          : null,
      );
    }
  },
  {
    contextDefaults: true,
    meta: {
      docs: {
        description: "Requires that returns are documented.",
        url: "https://github.com/gajus/eslint-plugin-jsdoc/blob/main/docs/rules/require-returns.md#repos-sticky-header",
      },
      fixable: "code",
      schema: [
        {
          additionalProperties: false,
          properties: {
            checkConstructors: {
              default: false,
              type: "boolean",
            },
            checkGetters: {
              default: true,
              type: "boolean",
            },
            contexts: {
              items: {
                anyOf: [
                  {
                    type: "string",
                  },
                  {
                    additionalProperties: false,
                    properties: {
                      comment: {
                        type: "string",
                      },
                      context: {
                        type: "string",
                      },
                      forceRequireReturn: {
                        type: "boolean",
                      },
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
            exemptedBy: {
              items: {
                type: "string",
              },
              type: "array",
            },
            forceRequireReturn: {
              default: false,
              type: "boolean",
            },
            forceReturnsWithAsync: {
              default: false,
              type: "boolean",
            },
            publicOnly: {
              oneOf: [
                {
                  default: false,
                  type: "boolean",
                },
                {
                  additionalProperties: false,
                  default: {},
                  properties: {
                    ancestorsOnly: {
                      type: "boolean",
                    },
                    cjs: {
                      type: "boolean",
                    },
                    esm: {
                      type: "boolean",
                    },
                    window: {
                      type: "boolean",
                    },
                  },
                  type: "object",
                },
              ],
            },
          },
          type: "object",
        },
      ],
      type: "suggestion",
    },
  },
);
