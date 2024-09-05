import iterateJsdoc from "../iterateJsdoc.js";

interface TagMap {
  always?: string[];
  any?: string[];
  never?: string[];
}

interface Options {
  tags?: TagMap;
}

interface Context {
  options: [string, Options?];
}

export default iterateJsdoc(
  ({
    context,
    jsdoc,
    utils,
    indent,
  }: {
    context: Context;
    jsdoc: any;
    utils: any;
    indent: string;
  }) => {
    const [defaultRequireValue = "always", { tags: tagMap = {} } = {}] =
      context.options;

    const { source } = jsdoc;

    const always = defaultRequireValue === "always";
    const never = defaultRequireValue === "never";

    let currentTag: string | undefined;

    source.some(
      ({
        number,
        tokens,
      }: {
        number: number;
        tokens: {
          delimiter: string;
          tag: string;
          end: boolean;
          description: string;
          start?: string;
          postDelimiter?: string;
        };
      }) => {
        const { delimiter, tag, end, description } = tokens;

        const neverFix = (): void => {
          tokens.delimiter = "";
          tokens.postDelimiter = "";
        };

        const checkNever = (checkValue: string): boolean => {
          if (
            delimiter &&
            delimiter !== "/**" &&
            ((never && !tagMap.always?.includes(checkValue)) ||
              tagMap.never?.includes(checkValue))
          ) {
            utils.reportJSDoc(
              "Expected JSDoc line to have no prefix.",
              {
                column: 0,
                line: number,
              },
              neverFix,
            );

            return true;
          }

          return false;
        };

        const alwaysFix = (): void => {
          if (!tokens.start) {
            tokens.start = indent + " ";
          }

          tokens.delimiter = "*";
          tokens.postDelimiter = tag || description ? " " : "";
        };

        const checkAlways = (checkValue: string): boolean => {
          if (
            !delimiter &&
            ((always && !tagMap.never?.includes(checkValue)) ||
              tagMap.always?.includes(checkValue))
          ) {
            utils.reportJSDoc(
              "Expected JSDoc line to have the prefix.",
              {
                column: 0,
                line: number,
              },
              alwaysFix,
            );

            return true;
          }

          return false;
        };

        if (tag) {
          currentTag = tag.slice(1); // Remove at sign
        }

        if (end && !tag) {
          return false;
        }

        if (!currentTag) {
          if (tagMap.any?.includes("*description")) {
            return false;
          }

          if (checkNever("*description")) {
            return true;
          }

          if (checkAlways("*description")) {
            return true;
          }

          return false;
        }

        if (tagMap.any?.includes(currentTag)) {
          return false;
        }

        if (checkNever(currentTag)) {
          return true;
        }

        if (checkAlways(currentTag)) {
          return true;
        }

        return false;
      },
    );
  },
  {
    iterateAllJsdocs: true,
    meta: {
      docs: {
        description: "Requires that each JSDoc line starts with an `*`.",
        url: "https://github.com/gajus/eslint-plugin-jsdoc/blob/main/docs/rules/require-asterisk-prefix.md#repos-sticky-header",
      },
      fixable: "code",
      schema: [
        {
          enum: ["always", "never", "any"],
          type: "string",
        },
        {
          additionalProperties: false,
          properties: {
            tags: {
              properties: {
                always: {
                  items: {
                    type: "string",
                  },
                  type: "array",
                },
                any: {
                  items: {
                    type: "string",
                  },
                  type: "array",
                },
                never: {
                  items: {
                    type: "string",
                  },
                  type: "array",
                },
              },
              type: "object",
            },
          },
          type: "object",
        },
      ],
      type: "layout",
    },
  },
);
