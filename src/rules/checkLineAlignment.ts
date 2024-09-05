import { transforms } from "comment-parser";
import alignTransform from "../alignTransform.js";
import iterateJsdoc from "../iterateJsdoc.js";

const { flow: commentFlow } = transforms;

/**
 * Custom spacings configuration for JSDoc alignment.
 */
interface CustomSpacings {
  postDelimiter: number;
  postHyphen: number;
  postName: number;
  postTag: number;
  postType: number;
}

/**
 * Checks if JSDoc tags are not aligned correctly and reports the issue if necessary.
 * @param {import('../iterateJsdoc.js').Utils} utils - Utility functions for JSDoc handling.
 * @param {import('comment-parser').Spec & { line: number }} tag - The JSDoc tag being checked.
 * @param {CustomSpacings} customSpacings - Custom spacing settings for alignment.
 */
const checkNotAlignedPerTag = (
  utils: any,
  tag: any,
  customSpacings: CustomSpacings,
) => {
  const mightHaveNamepath = utils.tagMightHaveNamepath(tag.tag);

  const spacerProps: Array<keyof CustomSpacings> = mightHaveNamepath
    ? ["postDelimiter", "postTag", "postType", "postName"]
    : ["postDelimiter", "postTag", "postType"];

  const contentProps: Array<"tag" | "type" | "name" | "description"> =
    mightHaveNamepath
      ? ["tag", "type", "name", "description"]
      : ["tag", "type", "description"];

  const { tokens } = tag.source[0];

  const followedBySpace = (
    idx: number,
    callbck?: (notRet: boolean, contentProp: string) => void,
  ) => {
    const nextIndex = idx + 1;

    return spacerProps.slice(nextIndex).some((spacerProp, innerIdx) => {
      const contentProp = contentProps[nextIndex + innerIdx];
      const spacePropVal = tokens[spacerProp];
      const ret = spacePropVal;

      if (callbck) {
        callbck(!ret, contentProp);
      }

      return ret && (callbck || !contentProp);
    });
  };

  const postHyphenSpacing = customSpacings?.postHyphen ?? 1;
  const exactHyphenSpacing = new RegExp(
    `^\\s*-\\s{${postHyphenSpacing},${postHyphenSpacing}}(?!\\s)`,
    "u",
  );
  const hasNoHyphen = !/^\s*-(?!$)(?=\s)/u.test(tokens.description);
  const hasExactHyphenSpacing = exactHyphenSpacing.test(tokens.description);

  const ok =
    !spacerProps.some((spacerProp, idx) => {
      const contentProp = contentProps[idx];
      const contentPropVal = tokens[contentProp];
      const spacerPropVal = tokens[spacerProp];
      const spacing = customSpacings?.[spacerProp] || 1;

      return (
        (spacerPropVal.length !== spacing && spacerPropVal.length !== 0) ||
        (spacerPropVal && !contentPropVal && followedBySpace(idx))
      );
    }) &&
    (hasNoHyphen || hasExactHyphenSpacing);

  if (ok) {
    return;
  }

  const fix = () => {
    for (const [idx, spacerProp] of spacerProps.entries()) {
      const contentProp = contentProps[idx];
      const contentPropVal = tokens[contentProp];

      if (contentPropVal) {
        const spacing = customSpacings?.[spacerProp] || 1;
        tokens[spacerProp] = "".padStart(spacing, " ");
        followedBySpace(idx, (hasSpace, contentPrp) => {
          if (hasSpace) {
            tokens[contentPrp] = "";
          }
        });
      } else {
        tokens[spacerProp] = "";
      }
    }

    if (!hasExactHyphenSpacing) {
      const hyphenSpacing = /^\s*-\s+/u;
      tokens.description = tokens.description.replace(
        hyphenSpacing,
        "-" + "".padStart(postHyphenSpacing, " "),
      );
    }

    utils.setTag(tag, tokens);
  };

  utils.reportJSDoc(
    "Expected JSDoc block lines to not be aligned.",
    tag,
    fix,
    true,
  );
};

/**
 * Checks alignment of JSDoc comments and reports issues.
 * @param {object} cfg - Configuration object for alignment checking.
 */
const checkAlignment = ({
  customSpacings,
  indent,
  jsdoc,
  jsdocNode,
  preserveMainDescriptionPostDelimiter,
  report,
  tags,
  utils,
  wrapIndent,
  disableWrapIndent,
}: {
  customSpacings: CustomSpacings;
  indent: string;
  jsdoc: any;
  jsdocNode: any;
  preserveMainDescriptionPostDelimiter: boolean;
  report: (message: string, fixer: (fixer: any) => any) => void;
  tags: string[];
  utils: any;
  wrapIndent: string;
  disableWrapIndent: boolean;
}) => {
  const transform = commentFlow(
    alignTransform({
      customSpacings,
      indent,
      preserveMainDescriptionPostDelimiter,
      tags,
      wrapIndent,
      disableWrapIndent,
    }),
  );
  const transformedJsdoc = transform(jsdoc);

  const comment = "/*" + jsdocNode.value + "*/";

  const formatted = utils.stringify(transformedJsdoc).trimStart();

  if (comment !== formatted) {
    report("Expected JSDoc block lines to be aligned.", (fixer) => {
      return fixer.replaceText(jsdocNode, formatted);
    });
  }
};

export default iterateJsdoc(
  ({
    indent,
    jsdoc,
    jsdocNode,
    report,
    context,
    utils,
  }: {
    indent: string;
    jsdoc: any;
    jsdocNode: any;
    report: (message: string, fixer: any) => void;
    context: { options: any[] };
    utils: any;
  }) => {
    const {
      tags: applicableTags = [
        "param",
        "arg",
        "argument",
        "property",
        "prop",
        "returns",
        "return",
      ],
      preserveMainDescriptionPostDelimiter,
      customSpacings,
      wrapIndent = "",
      disableWrapIndent = false,
    } = context.options[1] || {};

    if (context.options[0] === "always") {
      if (!jsdocNode.value.includes("\n")) {
        return;
      }

      checkAlignment({
        customSpacings,
        indent,
        jsdoc,
        jsdocNode,
        preserveMainDescriptionPostDelimiter,
        report,
        tags: applicableTags,
        utils,
        wrapIndent,
        disableWrapIndent,
      });

      return;
    }

    const foundTags = utils.getPresentTags(applicableTags);
    if (context.options[0] !== "any") {
      for (const tag of foundTags) {
        checkNotAlignedPerTag(utils, tag, customSpacings);
      }
    }

    for (const tag of foundTags) {
      if (tag.source.length > 1) {
        let idx = 0;
        for (const { tokens } of tag.source.slice(1)) {
          idx++;

          if (!tokens.description || tokens.type || tokens.name) {
            continue;
          }

          if (
            !disableWrapIndent &&
            tokens.postDelimiter.slice(1) !== wrapIndent
          ) {
            utils.reportJSDoc(
              "Expected wrap indent",
              { line: tag.source[0].number + idx },
              () => {
                tokens.postDelimiter =
                  tokens.postDelimiter.charAt(0) + wrapIndent;
              },
            );
            return;
          }
        }
      }
    }
  },
  {
    iterateAllJsdocs: true,
    meta: {
      docs: {
        description: "Reports invalid alignment of JSDoc block lines.",
        url: "https://github.com/gajus/eslint-plugin-jsdoc/blob/main/docs/rules/check-line-alignment.md#repos-sticky-header",
      },
      fixable: "whitespace",
      schema: [
        {
          enum: ["always", "never", "any"],
          type: "string",
        },
        {
          additionalProperties: false,
          properties: {
            customSpacings: {
              additionalProperties: false,
              properties: {
                postDelimiter: { type: "integer" },
                postHyphen: { type: "integer" },
                postName: { type: "integer" },
                postTag: { type: "integer" },
                postType: { type: "integer" },
              },
            },
            preserveMainDescriptionPostDelimiter: {
              default: false,
              type: "boolean",
            },
            tags: {
              items: { type: "string" },
              type: "array",
            },
            wrapIndent: { type: "string" },
            disableWrapIndent: { type: "boolean" },
          },
          type: "object",
        },
      ],
      type: "layout",
    },
  },
);
