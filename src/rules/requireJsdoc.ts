import { getSettings } from "../iterateJsdoc.js";
import { enforcedContexts, getContextObject } from "../jsdocUtils.js";

/**
 * Options schema for the rule configuration.
 */
interface RequireJsdocOpts {
  ancestorsOnly: boolean;
  esm: boolean;
  initModuleExports: boolean;
  initWindow: boolean;
}

/**
 * ESLint or TypeScript node type.
 */
type ESLintOrTSNode =
  | import("eslint").Rule.Node
  | import("@typescript-eslint/types").TSESTree.Node;

/** JSON schema for the options. */
const OPTIONS_SCHEMA: import("json-schema").JSONSchema4 = {
  additionalProperties: false,
  properties: {
    checkConstructors: {
      default: true,
      type: "boolean",
    },
    checkGetters: {
      anyOf: [
        {
          type: "boolean",
        },
        {
          enum: ["no-setter"],
          type: "string",
        },
      ],
      default: true,
    },
    checkSetters: {
      anyOf: [
        {
          type: "boolean",
        },
        {
          enum: ["no-getter"],
          type: "string",
        },
      ],
      default: true,
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
              context: {
                type: "string",
              },
              inlineCommentBlock: {
                type: "boolean",
              },
              minLineCount: {
                type: "integer",
              },
            },
            type: "object",
          },
        ],
      },
      type: "array",
    },
    enableFixer: {
      default: true,
      type: "boolean",
    },
    exemptEmptyConstructors: {
      default: false,
      type: "boolean",
    },
    exemptEmptyFunctions: {
      default: false,
      type: "boolean",
    },
    fixerMessage: {
      default: "",
      type: "string",
    },
    minLineCount: {
      type: "integer",
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
    require: {
      additionalProperties: false,
      default: {},
      properties: {
        ArrowFunctionExpression: {
          default: false,
          type: "boolean",
        },
        ClassDeclaration: {
          default: false,
          type: "boolean",
        },
        ClassExpression: {
          default: false,
          type: "boolean",
        },
        FunctionDeclaration: {
          default: true,
          type: "boolean",
        },
        FunctionExpression: {
          default: false,
          type: "boolean",
        },
        MethodDefinition: {
          default: false,
          type: "boolean",
        },
      },
      type: "object",
    },
  },
  type: "object",
};

/**
 * Get option value from the context or baseObject
 *
 * @param context - ESLint rule context
 * @param baseObject - Base object from schema
 * @param option - Option name
 * @param key - Property key
 * @returns Boolean value or undefined
 */
const getOption = (
  context: import("eslint").Rule.RuleContext,
  baseObject: import("json-schema").JSONSchema4Object,
  option: string,
  key: string,
): boolean | undefined => {
  if (
    context.options[0] &&
    option in context.options[0] &&
    (typeof context.options[0][option] === "boolean" ||
      key in context.options[0][option])
  ) {
    return context.options[0][option][key];
  }

  return baseObject.properties?.[key]?.default as boolean | undefined;
};

/**
 * Get options from context and settings
 *
 * @param context - ESLint rule context
 * @param settings - Settings for JSDoc comments
 * @returns Parsed options object
 */
const getOptions = (
  context: import("eslint").Rule.RuleContext,
  settings: import("../iterateJsdoc.js").Settings,
) => {
  const {
    publicOnly,
    contexts = settings.contexts || [],
    exemptEmptyConstructors = true,
    exemptEmptyFunctions = false,
    enableFixer = true,
    fixerMessage = "",
    minLineCount = undefined,
  } = context.options[0] || {};

  return {
    contexts,
    enableFixer,
    exemptEmptyConstructors,
    exemptEmptyFunctions,
    fixerMessage,
    minLineCount,
    publicOnly: ((baseObj: import("json-schema").JSONSchema4Object) => {
      if (!publicOnly) {
        return false;
      }

      const properties: Record<string, boolean | undefined> = {};
      for (const prop of Object.keys(baseObj.properties || {})) {
        const opt = getOption(context, baseObj, "publicOnly", prop);
        properties[prop] = opt;
      }

      return properties;
    })(
      (
        OPTIONS_SCHEMA.properties
          ?.publicOnly as import("json-schema").JSONSchema4Object
      )?.oneOf?.[1],
    ),
    require: ((baseObj: import("json-schema").JSONSchema4Object) => {
      const properties: Record<string, boolean | undefined> = {};
      for (const prop of Object.keys(baseObj.properties || {})) {
        const opt = getOption(context, baseObj, "require", prop);
        properties[prop] = opt;
      }

      return properties;
    })(
      OPTIONS_SCHEMA.properties
        ?.require as import("json-schema").JSONSchema4Object,
    ),
  };
};

/** ESLint rule module */
const ruleModule: import("eslint").Rule.RuleModule = {
  create(context) {
    const { sourceCode = context.getSourceCode() } = context;
    const settings = getSettings(context);
    if (!settings) {
      return {};
    }

    const opts = getOptions(context, settings);

    const {
      require: requireOption,
      contexts,
      exemptEmptyFunctions,
      exemptEmptyConstructors,
      enableFixer,
      fixerMessage,
      minLineCount,
    } = opts;

    const publicOnly = opts.publicOnly as Record<string, boolean | undefined>;

    /**
     * Check and report missing JSDoc
     */
    const checkJsDoc: import("../iterateJsdoc.js").CheckJsdoc = (
      info,
      _handler,
      node,
    ) => {
      // Logic for checking and reporting JSDoc comments
    };

    /**
     * Checks if a given property exists in options or contexts
     */
    const hasOption = (prop: string): boolean => {
      return (
        requireOption[prop] ||
        contexts.some((ctxt) =>
          typeof ctxt === "object" ? ctxt.context === prop : ctxt === prop,
        )
      );
    };

    return {
      ...getContextObject(enforcedContexts(context, [], settings), checkJsDoc),
      ArrowFunctionExpression(node) {
        if (hasOption("ArrowFunctionExpression")) {
          checkJsDoc({ isFunctionContext: true }, null, node);
        }
      },
      ClassDeclaration(node) {
        if (hasOption("ClassDeclaration")) {
          checkJsDoc({ isFunctionContext: false }, null, node);
        }
      },
      // Additional node checks...
    };
  },
  meta: {
    docs: {
      category: "Stylistic Issues",
      description: "Require JSDoc comments",
      recommended: true,
      url: "https://github.com/gajus/eslint-plugin-jsdoc/blob/main/docs/rules/require-jsdoc.md#repos-sticky-header",
    },
    fixable: "code",
    messages: {
      missingJsDoc: "Missing JSDoc comment.",
    },
    schema: [OPTIONS_SCHEMA],
    type: "suggestion",
  },
};

export default ruleModule;
