import escapeStringRegexp from "escape-string-regexp";
import iterateJsdoc from "../iterateJsdoc.js";

// https://babeljs.io/docs/en/babel-plugin-transform-react-jsx/
const jsxTagNames = new Set([
  "jsx",
  "jsxFrag",
  "jsxImportSource",
  "jsxRuntime",
]);

const typedTagsAlwaysUnnecessary = new Set([
  "augments",
  "callback",
  "class",
  "enum",
  "implements",
  "private",
  "property",
  "protected",
  "public",
  "readonly",
  "this",
  "type",
  "typedef",
]);

const typedTagsNeedingName = new Set(["template"]);

const typedTagsUnnecessaryOutsideDeclare = new Set([
  "abstract",
  "access",
  "class",
  "constant",
  "constructs",
  "default",
  "enum",
  "export",
  "exports",
  "function",
  "global",
  "inherits",
  "instance",
  "interface",
  "member",
  "memberof",
  "memberOf",
  "method",
  "mixes",
  "mixin",
  "module",
  "name",
  "namespace",
  "override",
  "property",
  "requires",
  "static",
  "this",
]);

export default iterateJsdoc(
  ({
    sourceCode,
    jsdoc,
    report,
    utils,
    context,
    node,
    settings,
    jsdocNode,
  }: {
    sourceCode: any;
    jsdoc: import("comment-parser").Block;
    report: (message: string, fixer: any, tag?: any) => void;
    utils: any;
    context: {
      options: Array<{
        definedTags?: string[];
        enableFixer?: boolean;
        jsxTags?: boolean;
        typed?: boolean;
      }>;
    };
    node: import("estree").Node | null;
    settings: any;
    jsdocNode: any;
  }) => {
    const {
      definedTags = [],
      enableFixer = true,
      jsxTags,
      typed,
    } = context.options[0] || {};

    let definedPreferredTags: (string | undefined)[] = [];
    const { tagNamePreference, structuredTags } = settings;
    const definedStructuredTags = Object.keys(structuredTags);
    const definedNonPreferredTags = Object.keys(tagNamePreference);

    if (definedNonPreferredTags.length) {
      definedPreferredTags = Object.values(tagNamePreference)
        .map((preferredTag) => {
          if (typeof preferredTag === "string") {
            return preferredTag;
          }

          if (!preferredTag) {
            return undefined;
          }

          if (typeof preferredTag !== "object") {
            utils.reportSettings(
              "Invalid `settings.jsdoc.tagNamePreference`. Values must be falsy, a string, or an object.",
            );
          }

          return preferredTag.replacement;
        })
        .filter(Boolean);
    }

    const isInAmbientContext = (subNode: import("estree").Node): boolean => {
      return subNode.type === "Program"
        ? context.getFilename().endsWith(".d.ts")
        : Boolean(
            (
              subNode as import("@typescript-eslint/types").TSESTree.VariableDeclaration
            ).declare || isInAmbientContext(subNode.parent!),
          );
    };

    const tagIsRedundantWhenTyped = (
      jsdocTag: import("comment-parser").Spec,
    ): boolean => {
      if (!typedTagsUnnecessaryOutsideDeclare.has(jsdocTag.tag)) {
        return false;
      }

      if (jsdocTag.tag === "default") {
        return false;
      }

      if (node === null) {
        return false;
      }

      if (
        context.getFilename().endsWith(".d.ts") &&
        ["Program", null, undefined].includes(node?.parent?.type)
      ) {
        return false;
      }

      if (isInAmbientContext(node as import("estree").Node)) {
        return false;
      }

      return true;
    };

    const reportWithTagRemovalFixer = (
      message: string,
      jsdocTag: import("comment-parser").Spec,
      tagIndex: number,
      additionalTagChanges?: Partial<import("comment-parser").Tokens>,
    ): void => {
      utils.reportJSDoc(
        message,
        jsdocTag,
        enableFixer
          ? () => {
              if (jsdocTag.description.trim()) {
                utils.changeTag(jsdocTag, {
                  postType: "",
                  type: "",
                  ...additionalTagChanges,
                });
              } else {
                utils.removeTag(tagIndex, {
                  removeEmptyBlock: true,
                });
              }
            }
          : null,
        true,
      );
    };

    const checkTagForTypedValidity = (
      jsdocTag: import("comment-parser").Spec,
      tagIndex: number,
    ): boolean => {
      if (typedTagsAlwaysUnnecessary.has(jsdocTag.tag)) {
        reportWithTagRemovalFixer(
          `'@${jsdocTag.tag}' is redundant when using a type system.`,
          jsdocTag,
          tagIndex,
          {
            postTag: "",
            tag: "",
          },
        );
        return true;
      }

      if (tagIsRedundantWhenTyped(jsdocTag)) {
        reportWithTagRemovalFixer(
          `'@${jsdocTag.tag}' is redundant outside of ambient (\`declare\`/\`.d.ts\`) contexts when using a type system.`,
          jsdocTag,
          tagIndex,
        );
        return true;
      }

      if (typedTagsNeedingName.has(jsdocTag.tag) && !jsdocTag.name) {
        reportWithTagRemovalFixer(
          `'@${jsdocTag.tag}' without a name is redundant when using a type system.`,
          jsdocTag,
          tagIndex,
        );
        return true;
      }

      return false;
    };

    for (let tagIndex = 0; tagIndex < jsdoc.tags.length; tagIndex += 1) {
      const jsdocTag = jsdoc.tags[tagIndex];
      const tagName = jsdocTag.tag;

      if (jsxTags && jsxTagNames.has(tagName)) {
        continue;
      }

      if (typed && checkTagForTypedValidity(jsdocTag, tagIndex)) {
        continue;
      }

      const validTags = [
        ...definedTags,
        ...(definedPreferredTags as string[]),
        ...definedNonPreferredTags,
        ...definedStructuredTags,
        ...(typed ? Array.from(typedTagsNeedingName) : []),
      ];

      if (utils.isValidTag(tagName, validTags)) {
        let preferredTagName = utils.getPreferredTagName({
          allowObjectReturn: true,
          defaultMessage: `Blacklisted tag found (\`@${tagName}\`)`,
          tagName,
        });

        if (!preferredTagName) {
          continue;
        }

        let message;
        if (typeof preferredTagName === "object") {
          ({ message, replacement: preferredTagName } = preferredTagName as {
            message: string;
            replacement?: string;
          });
        }

        if (!message) {
          message = `Invalid JSDoc tag (preference). Replace "${tagName}" JSDoc tag with "${preferredTagName}".`;
        }

        if (preferredTagName !== tagName) {
          report(
            message,
            (fixer) => {
              const replacement = sourceCode
                .getText(jsdocNode)
                .replace(
                  new RegExp(`@${escapeStringRegexp(tagName)}\\b`, "u"),
                  `@${preferredTagName}`,
                );

              return fixer.replaceText(jsdocNode, replacement);
            },
            jsdocTag,
          );
        }
      } else {
        report(`Invalid JSDoc tag name "${tagName}".`, null, jsdocTag);
      }
    }
  },
  {
    iterateAllJsdocs: true,
    meta: {
      docs: {
        description: "Reports invalid block tag names.",
        url: "https://github.com/gajus/eslint-plugin-jsdoc/blob/main/docs/rules/check-tag-names.md#repos-sticky-header",
      },
      fixable: "code",
      schema: [
        {
          additionalProperties: false,
          properties: {
            definedTags: {
              items: {
                type: "string",
              },
              type: "array",
            },
            enableFixer: {
              type: "boolean",
            },
            jsxTags: {
              type: "boolean",
            },
            typed: {
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
