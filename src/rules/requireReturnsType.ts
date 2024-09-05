import iterateJsdoc from "../iterateJsdoc.js";

export default iterateJsdoc<{
  report: (message: string, fix?: any, tag?: any) => void;
  utils: {
    forEachPreferredTag: (
      tagName: string,
      callback: (jsdocTag: { type?: string }, targetTagName: string) => void,
    ) => void;
  };
}>(
  ({ report, utils }) => {
    utils.forEachPreferredTag("returns", (jsdocTag, targetTagName) => {
      if (!jsdocTag.type) {
        report(`Missing JSDoc @${targetTagName} type.`, null, jsdocTag);
      }
    });
  },
  {
    contextDefaults: true,
    meta: {
      docs: {
        description: "Requires that `@returns` tag has a `type` value.",
        url: "https://github.com/gajus/eslint-plugin-jsdoc/blob/main/docs/rules/require-returns-type.md#repos-sticky-header",
      },
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
                    },
                    type: "object",
                  },
                ],
              },
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
