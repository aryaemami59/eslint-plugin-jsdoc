import iterateJsdoc from "../iterateJsdoc.js";

interface ContextObject {
  comment?: string;
  context?: string;
  message?: string;
}

export default iterateJsdoc(
  ({
    context,
    info: { comment },
    report,
    utils,
  }: {
    context: { options: [{ contexts: ContextObject[] }] };
    info: { comment: string };
    report: (message: string, node?: any, fix?: any, data?: any) => void;
    utils: any;
  }) => {
    if (!context.options.length) {
      report("Rule `no-restricted-syntax` is missing a `contexts` option.");
      return;
    }

    const { contexts } = context.options[0];

    const { foundContext, contextStr } = utils.findContext(contexts, comment);

    // We are not on the *particular* matching context/comment, so don't assume
    //   we need reporting
    if (!foundContext) {
      return;
    }

    const message =
      (foundContext as ContextObject)?.message ??
      "Syntax is restricted: {{context}}" +
        (comment ? " with {{comment}}" : "");

    report(
      message,
      null,
      null,
      comment
        ? {
            comment,
            context: contextStr,
          }
        : {
            context: contextStr,
          },
    );
  },
  {
    contextSelected: true,
    meta: {
      docs: {
        description: "Reports when certain comment structures are present.",
        url: "https://github.com/gajus/eslint-plugin-jsdoc/blob/main/docs/rules/no-restricted-syntax.md#repos-sticky-header",
      },
      fixable: "code",
      schema: [
        {
          additionalProperties: false,
          properties: {
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
                      message: {
                        type: "string",
                      },
                    },
                    type: "object",
                  },
                ],
              },
              type: "array",
            },
          },
          required: ["contexts"],
          type: "object",
        },
      ],
      type: "suggestion",
    },
    nonGlobalSettings: true,
  },
);
