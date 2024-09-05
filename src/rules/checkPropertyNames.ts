import iterateJsdoc from "../iterateJsdoc.js";

/**
 * Validates if property names are duplicated in the JSDoc block.
 * @param {string} targetTagName - The target tag name (e.g., "property").
 * @param {boolean} enableFixer - Whether to enable fixer functionality.
 * @param {import('comment-parser').Block} jsdoc - The JSDoc block being validated.
 * @param {import('../iterateJsdoc.js').Utils} utils - Utility functions for working with JSDoc.
 * @returns {boolean} - Returns true if there is an error, otherwise false.
 */
const validatePropertyNames = (
  targetTagName: string,
  enableFixer: boolean,
  jsdoc: import("comment-parser").Block,
  utils: import("../iterateJsdoc.js").Utils,
): boolean => {
  const propertyTags = Object.entries(jsdoc.tags).filter(
    ([, tag]) => tag.tag === targetTagName,
  );

  return propertyTags.some(([, tag], index) => {
    let tagsIndex: number;

    const dupeTagInfo = propertyTags.find(([tgsIndex, tg], idx) => {
      tagsIndex = Number(tgsIndex);
      return tg.name === tag.name && idx !== index;
    });

    if (dupeTagInfo) {
      utils.reportJSDoc(
        `Duplicate @${targetTagName} "${tag.name}"`,
        dupeTagInfo[1],
        enableFixer
          ? () => {
              utils.removeTag(tagsIndex);
            }
          : null,
      );

      return true;
    }

    return false;
  });
};

/**
 * Validates deeply nested property names in JSDoc blocks.
 * @param {string} targetTagName - The target tag name (e.g., "property").
 * @param {Array<{ idx: number; name: string; type: string }>} jsdocPropertyNames - List of property names from the JSDoc.
 * @param {import('comment-parser').Block} jsdoc - The JSDoc block.
 * @param {(message: string, fixer: null, tag: any) => void} report - Function to report issues.
 * @returns {boolean} - Returns true if there is an error, otherwise false.
 */
const validatePropertyNamesDeep = (
  targetTagName: string,
  jsdocPropertyNames: { idx: number; name: string; type: string }[],
  jsdoc: import("comment-parser").Block,
  report: (message: string, fixer: null, tag: any) => void,
): boolean => {
  let lastRealProperty: string | undefined;

  return jsdocPropertyNames.some(({ name: jsdocPropertyName, idx }) => {
    const isPropertyPath = jsdocPropertyName.includes(".");

    if (isPropertyPath) {
      if (!lastRealProperty) {
        report(
          `@${targetTagName} path declaration ("${jsdocPropertyName}") appears before any real property.`,
          null,
          jsdoc.tags[idx],
        );
        return true;
      }

      let pathRootNodeName = jsdocPropertyName.slice(
        0,
        jsdocPropertyName.indexOf("."),
      );

      if (pathRootNodeName.endsWith("[]")) {
        pathRootNodeName = pathRootNodeName.slice(0, -2);
      }

      if (pathRootNodeName !== lastRealProperty) {
        report(
          `@${targetTagName} path declaration ("${jsdocPropertyName}") root node name ("${pathRootNodeName}") ` +
            `does not match previous real property name ("${lastRealProperty}").`,
          null,
          jsdoc.tags[idx],
        );
        return true;
      }
    } else {
      lastRealProperty = jsdocPropertyName;
    }

    return false;
  });
};

export default iterateJsdoc(
  ({
    context,
    jsdoc,
    report,
    utils,
  }: {
    context: { options: any[] };
    jsdoc: import("comment-parser").Block;
    report: (message: string, fixer: any, tag?: any) => void;
    utils: import("../iterateJsdoc.js").Utils;
  }) => {
    const { enableFixer = false } = context.options[0] || {};

    const jsdocPropertyNamesDeep = utils.getJsdocTagsDeep("property");
    if (!jsdocPropertyNamesDeep || !jsdocPropertyNamesDeep.length) {
      return;
    }

    const targetTagName = utils.getPreferredTagName({ tagName: "property" });

    const isError = validatePropertyNames(
      targetTagName,
      enableFixer,
      jsdoc,
      utils,
    );

    if (isError) {
      return;
    }

    validatePropertyNamesDeep(
      targetTagName,
      jsdocPropertyNamesDeep,
      jsdoc,
      report,
    );
  },
  {
    iterateAllJsdocs: true,
    meta: {
      docs: {
        description:
          "Ensures that property names in JSDoc are not duplicated on the same block and that nested properties have defined roots.",
        url: "https://github.com/gajus/eslint-plugin-jsdoc/blob/main/docs/rules/check-property-names.md#repos-sticky-header",
      },
      fixable: "code",
      schema: [
        {
          additionalProperties: false,
          properties: {
            enableFixer: {
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
