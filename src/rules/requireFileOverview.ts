import iterateJsdoc from "../iterateJsdoc.js";

interface TagOptions {
  initialCommentsOnly?: boolean;
  mustExist?: boolean;
  preventDuplicates?: boolean;
}

interface TagsOptions {
  [key: string]: TagOptions;
}

interface StateObject {
  globalTags?: Record<string, unknown>;
  hasDuplicates?: Record<string, boolean>;
  hasTag?: Record<string, boolean>;
  hasNonCommentBeforeTag?: Record<string, boolean>;
  hasNonComment?: number;
}

const defaultTags: TagsOptions = {
  file: {
    initialCommentsOnly: true,
    mustExist: true,
    preventDuplicates: true,
  },
};

const setDefaults = (state: StateObject): void => {
  if (!state.globalTags) {
    state.globalTags = {};
    state.hasDuplicates = {};
    state.hasTag = {};
    state.hasNonCommentBeforeTag = {};
  }
};

export default iterateJsdoc(
  ({
    jsdocNode,
    state,
    utils,
    context,
  }: {
    jsdocNode: any;
    state: StateObject;
    utils: any;
    context: any;
  }) => {
    const { tags = defaultTags }: { tags?: TagsOptions } =
      context.options[0] || {};

    setDefaults(state);

    for (const tagName of Object.keys(tags)) {
      const targetTagName = utils.getPreferredTagName({
        tagName,
      }) as string;

      const hasTag = Boolean(targetTagName && utils.hasTag(targetTagName));

      state.hasTag![tagName] = hasTag || state.hasTag![tagName];

      const hasDuplicate = state.hasDuplicates![tagName];

      if (hasDuplicate === false) {
        state.hasDuplicates![tagName] = hasTag;
      } else if (!hasDuplicate && hasTag) {
        state.hasDuplicates![tagName] = false;
        state.hasNonCommentBeforeTag![tagName] =
          state.hasNonComment && state.hasNonComment < jsdocNode.range[0];
      }
    }
  },
  {
    exit({
      context,
      state,
      utils,
    }: {
      context: any;
      state: StateObject;
      utils: any;
    }) {
      setDefaults(state);
      const { tags = defaultTags }: { tags?: TagsOptions } =
        context.options[0] || {};

      for (const [
        tagName,
        {
          mustExist = false,
          preventDuplicates = false,
          initialCommentsOnly = false,
        },
      ] of Object.entries(tags)) {
        const obj = utils.getPreferredTagNameObject({
          tagName,
        });
        if (obj && typeof obj === "object" && "blocked" in obj) {
          utils.reportSettings(
            `\`settings.jsdoc.tagNamePreference\` cannot block @${obj.tagName} for the \`require-file-overview\` rule`,
          );
        } else {
          const targetTagName =
            (obj && typeof obj === "object" && obj.replacement) || obj;
          if (mustExist && !state.hasTag![tagName]) {
            utils.reportSettings(`Missing @${targetTagName}`);
          }

          if (preventDuplicates && state.hasDuplicates![tagName]) {
            utils.reportSettings(`Duplicate @${targetTagName}`);
          }

          if (initialCommentsOnly && state.hasNonCommentBeforeTag![tagName]) {
            utils.reportSettings(
              `@${targetTagName} should be at the beginning of the file`,
            );
          }
        }
      }
    },
    iterateAllJsdocs: true,
    meta: {
      docs: {
        description:
          "Checks that all files have one `@file`, `@fileoverview`, or `@overview` tag at the beginning of the file.",
        url: "https://github.com/gajus/eslint-plugin-jsdoc/blob/main/docs/rules/require-file-overview.md#repos-sticky-header",
      },
      schema: [
        {
          additionalProperties: false,
          properties: {
            tags: {
              patternProperties: {
                ".*": {
                  additionalProperties: false,
                  properties: {
                    initialCommentsOnly: {
                      type: "boolean",
                    },
                    mustExist: {
                      type: "boolean",
                    },
                    preventDuplicates: {
                      type: "boolean",
                    },
                  },
                  type: "object",
                },
              },
              type: "object",
            },
          },
          type: "object",
        },
      ],
      type: "suggestion",
    },
    nonComment({ state, node }: { state: StateObject; node: any }) {
      if (!state.hasNonComment) {
        state.hasNonComment = node.range[0];
      }
    },
  },
);
