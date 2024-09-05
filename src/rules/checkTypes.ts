import { parse, stringify, traverse, tryParse } from "@es-joy/jsdoccomment";
import iterateJsdoc from "../iterateJsdoc.js";

const strictNativeTypes = [
  "undefined",
  "null",
  "boolean",
  "number",
  "bigint",
  "string",
  "symbol",
  "object",
  "Array",
  "Function",
  "Date",
  "RegExp",
];

/**
 * Adjusts the parent type node `meta` for generic matches (or type node
 * `type` for `JsdocTypeAny`) and sets the type node `value`.
 * @param {string} type The actual type
 * @param {string} preferred The preferred type
 * @param {boolean} isGenericMatch
 * @param {string} typeNodeName
 * @param {import('jsdoc-type-pratt-parser').NonRootResult} node
 * @param {import('jsdoc-type-pratt-parser').NonRootResult|undefined} parentNode
 * @returns {void}
 */
const adjustNames = (
  type: string,
  preferred: string,
  isGenericMatch: boolean,
  typeNodeName: string,
  node: import("jsdoc-type-pratt-parser").NonRootResult,
  parentNode: import("jsdoc-type-pratt-parser").NonRootResult | undefined,
): void => {
  let ret = preferred;
  if (isGenericMatch) {
    const parentMeta = (
      parentNode as import("jsdoc-type-pratt-parser").GenericResult
    ).meta;
    if (preferred === "[]") {
      parentMeta.brackets = "square";
      parentMeta.dot = false;
      ret = "Array";
    } else {
      const dotBracketEnd = preferred.match(/\.(?:<>)?$/u);
      if (dotBracketEnd) {
        parentMeta.brackets = "angle";
        parentMeta.dot = true;
        ret = preferred.slice(0, -dotBracketEnd[0].length);
      } else {
        const bracketEnd = preferred.endsWith("<>");
        if (bracketEnd) {
          parentMeta.brackets = "angle";
          parentMeta.dot = false;
          ret = preferred.slice(0, -2);
        } else if (
          parentMeta?.brackets === "square" &&
          (typeNodeName === "[]" || typeNodeName === "Array")
        ) {
          parentMeta.brackets = "angle";
          parentMeta.dot = false;
        }
      }
    }
  } else if (type === "JsdocTypeAny") {
    node.type = "JsdocTypeName";
  }

  (node as import("jsdoc-type-pratt-parser").NameResult).value = ret.replace(
    /(?:\.|<>|\.<>|\[\])$/u,
    "",
  );

  if (!ret) {
    (node as import("jsdoc-type-pratt-parser").NameResult).value = typeNodeName;
  }
};

/**
 * @param {boolean} [upperCase]
 * @returns {string}
 */
const getMessage = (upperCase?: boolean): string => {
  return (
    "Use object shorthand or index signatures instead of " +
    "`" +
    (upperCase ? "O" : "o") +
    "bject`, e.g., `{[key: string]: string}`"
  );
};

export default iterateJsdoc(
  ({
    jsdocNode,
    sourceCode,
    report,
    utils,
    settings,
    context,
  }: {
    jsdocNode: any;
    sourceCode: any;
    report: (
      message: string,
      fixer: any,
      tag?: any,
      additionalContext?: any,
    ) => void;
    utils: any;
    settings: {
      preferredTypes: Record<
        string,
        string | { message: string; replacement: string } | false
      >;
      structuredTags: Record<string, { type: string[] }>;
      mode: string;
    };
    context: {
      options: Array<{
        noDefaults?: boolean;
        unifyParentAndChildTypeChecks?: boolean;
        exemptTagContexts?: Array<{ tag: string; types: true | string[] }>;
      }>;
    };
  }) => {
    const jsdocTagsWithPossibleType = utils.filterTags((tag: any) => {
      return Boolean(utils.tagMightHaveTypePosition(tag.tag));
    });

    const {
      preferredTypes: preferredTypesOriginal,
      structuredTags,
      mode,
    } = settings;

    const injectObjectPreferredTypes = !(
      "Object" in preferredTypesOriginal ||
      "object" in preferredTypesOriginal ||
      "object.<>" in preferredTypesOriginal ||
      "Object.<>" in preferredTypesOriginal ||
      "object<>" in preferredTypesOriginal
    );

    const info = {
      message: getMessage(),
      replacement: false,
    };

    const infoUC = {
      message: getMessage(true),
      replacement: false,
    };

    const typeToInject =
      mode === "typescript"
        ? {
            Object: "object",
            "object.<>": info,
            "Object.<>": infoUC,
            "object<>": info,
            "Object<>": infoUC,
          }
        : {
            Object: "object",
            "object.<>": "Object<>",
            "Object.<>": "Object<>",
            "object<>": "Object<>",
          };

    const preferredTypes = {
      ...(injectObjectPreferredTypes ? typeToInject : {}),
      ...preferredTypesOriginal,
    };

    const {
      noDefaults,
      unifyParentAndChildTypeChecks,
      exemptTagContexts = [],
    } = context.options[0] || {};

    const getPreferredTypeInfo = (
      _type: string,
      typeNodeName: string,
      parentNode: import("jsdoc-type-pratt-parser").NonRootResult | undefined,
      property: string | undefined,
    ): [boolean, string, boolean] => {
      let hasMatchingPreferredType = false;
      let isGenericMatch = false;
      let typeName = typeNodeName;

      const isNameOfGeneric =
        parentNode !== undefined &&
        parentNode.type === "JsdocTypeGeneric" &&
        property === "left";
      if (unifyParentAndChildTypeChecks || isNameOfGeneric) {
        const brackets = (
          parentNode as import("jsdoc-type-pratt-parser").GenericResult
        )?.meta?.brackets;
        const dot = (
          parentNode as import("jsdoc-type-pratt-parser").GenericResult
        )?.meta?.dot;

        if (brackets === "angle") {
          const checkPostFixes = dot ? [".", ".<>"] : ["<>"];
          isGenericMatch = checkPostFixes.some((checkPostFix) => {
            if (preferredTypes?.[typeNodeName + checkPostFix] !== undefined) {
              typeName += checkPostFix;
              return true;
            }
            return false;
          });
        }

        if (
          !isGenericMatch &&
          property &&
          (parentNode as import("jsdoc-type-pratt-parser").NonRootResult)
            .type === "JsdocTypeGeneric"
        ) {
          const checkPostFixes = dot
            ? [".", ".<>"]
            : [brackets === "angle" ? "<>" : "[]"];

          isGenericMatch = checkPostFixes.some((checkPostFix) => {
            if (preferredTypes?.[checkPostFix] !== undefined) {
              typeName = checkPostFix;
              return true;
            }
            return false;
          });
        }
      }

      const directNameMatch =
        preferredTypes?.[typeNodeName] !== undefined &&
        !Object.values(preferredTypes).includes(typeNodeName);
      const unifiedSyntaxParentMatch =
        property && directNameMatch && unifyParentAndChildTypeChecks;
      isGenericMatch = isGenericMatch || Boolean(unifiedSyntaxParentMatch);

      hasMatchingPreferredType =
        isGenericMatch || (directNameMatch && !property);

      return [hasMatchingPreferredType, typeName, isGenericMatch];
    };

    const checkNativeTypes = (
      typeNodeName: string,
      preferred: string | undefined,
      parentNode: import("jsdoc-type-pratt-parser").NonRootResult | undefined,
      invalidTypes: Array<[string, string | undefined]>,
    ): string | undefined => {
      let changedPreferred = preferred;
      for (const strictNativeType of strictNativeTypes) {
        if (
          strictNativeType === "object" &&
          (!preferredTypes?.[typeNodeName] ||
            ((parentNode as import("jsdoc-type-pratt-parser").GenericResult)
              ?.elements?.length &&
              (parentNode as import("jsdoc-type-pratt-parser").GenericResult)
                ?.left?.type === "JsdocTypeName" &&
              (parentNode as import("jsdoc-type-pratt-parser").GenericResult)
                ?.left?.value === "Object"))
        ) {
          continue;
        }

        if (
          strictNativeType !== typeNodeName &&
          strictNativeType.toLowerCase() === typeNodeName.toLowerCase() &&
          (!preferredTypes || preferredTypes?.[strictNativeType] === undefined)
        ) {
          changedPreferred = strictNativeType;
          invalidTypes.push([typeNodeName, changedPreferred]);
          break;
        }
      }
      return changedPreferred;
    };

    const getInvalidTypes = (
      type: string,
      value: string,
      tagName: string,
      nameInTag: string,
      idx: number,
      property: string | undefined,
      node: import("jsdoc-type-pratt-parser").NonRootResult,
      parentNode: import("jsdoc-type-pratt-parser").NonRootResult | undefined,
      invalidTypes: Array<[string, string | undefined, string?]>,
    ): void => {
      let typeNodeName = type === "JsdocTypeAny" ? "*" : value;

      const [hasMatchingPreferredType, typeName, isGenericMatch] =
        getPreferredTypeInfo(type, typeNodeName, parentNode, property);

      let preferred;
      let types;
      if (hasMatchingPreferredType) {
        const preferredSetting = preferredTypes[typeName];
        typeNodeName = typeName === "[]" ? typeName : typeNodeName;

        if (!preferredSetting) {
          invalidTypes.push([typeNodeName]);
        } else if (typeof preferredSetting === "string") {
          preferred = preferredSetting;
          invalidTypes.push([typeNodeName, preferred]);
        } else if (preferredSetting && typeof preferredSetting === "object") {
          const nextItem =
            preferredSetting.skipRootChecking &&
            jsdocTagsWithPossibleType[idx + 1];

          if (!nextItem || !nextItem.name.startsWith(`${nameInTag}.`)) {
            preferred = preferredSetting.replacement;
            invalidTypes.push([
              typeNodeName,
              preferred,
              preferredSetting.message,
            ]);
          }
        } else {
          utils.reportSettings(
            "Invalid `settings.jsdoc.preferredTypes`. Values must be falsy, a string, or an object.",
          );
          return;
        }
      } else if (
        Object.entries(structuredTags).some(([tag, { type: typs }]) => {
          types = typs;
          return (
            tag === tagName &&
            Array.isArray(types) &&
            !types.includes(typeNodeName)
          );
        })
      ) {
        invalidTypes.push([typeNodeName, types]);
      } else if (!noDefaults && type === "JsdocTypeName") {
        preferred = checkNativeTypes(
          typeNodeName,
          preferred,
          parentNode,
          invalidTypes,
        );
      }

      if (preferred) {
        adjustNames(
          type,
          preferred,
          isGenericMatch,
          typeNodeName,
          node,
          parentNode,
        );
      }
    };

    for (const [idx, jsdocTag] of jsdocTagsWithPossibleType.entries()) {
      const invalidTypes: Array<[string, string | undefined, string?]> = [];
      let typeAst;

      try {
        typeAst =
          mode === "permissive"
            ? tryParse(jsdocTag.type)
            : parse(jsdocTag.type, mode);
      } catch {
        continue;
      }

      const { tag: tagName, name: nameInTag } = jsdocTag;

      traverse(typeAst, (node, parentNode, property) => {
        const { type, value } =
          node as import("jsdoc-type-pratt-parser").NameResult;
        if (!["JsdocTypeName", "JsdocTypeAny"].includes(type)) {
          return;
        }

        getInvalidTypes(
          type,
          value,
          tagName,
          nameInTag,
          idx,
          property,
          node,
          parentNode,
          invalidTypes,
        );
      });

      if (invalidTypes.length) {
        const fixedType = stringify(typeAst);

        const fix = (fixer: any) => {
          return fixer.replaceText(
            jsdocNode,
            sourceCode
              .getText(jsdocNode)
              .replace(`{${jsdocTag.type}}`, `{${fixedType}}`),
          );
        };

        for (const [badType, preferredType = "", msg] of invalidTypes) {
          const tagValue = jsdocTag.name ? ` "${jsdocTag.name}"` : "";
          if (
            exemptTagContexts.some(
              ({ tag, types }) =>
                tag === tagName &&
                (types === true || types.includes(jsdocTag.type)),
            )
          ) {
            continue;
          }

          report(
            msg ||
              `Invalid JSDoc @${tagName}${tagValue} type "${badType}".${preferredType ? ` Prefer: ${preferredType}.` : ""}`,
            preferredType ? fix : null,
            jsdocTag,
            msg ? { tagName, tagValue } : undefined,
          );
        }
      }
    }
  },
  {
    iterateAllJsdocs: true,
    meta: {
      docs: {
        description: "Reports invalid types.",
        url: "https://github.com/gajus/eslint-plugin-jsdoc/blob/main/docs/rules/check-types.md#repos-sticky-header",
      },
      fixable: "code",
      schema: [
        {
          additionalProperties: false,
          properties: {
            exemptTagContexts: {
              items: {
                additionalProperties: false,
                properties: {
                  tag: {
                    type: "string",
                  },
                  types: {
                    oneOf: [
                      {
                        type: "boolean",
                      },
                      {
                        items: {
                          type: "string",
                        },
                        type: "array",
                      },
                    ],
                  },
                },
                type: "object",
              },
              type: "array",
            },
            noDefaults: {
              type: "boolean",
            },
            unifyParentAndChildTypeChecks: {
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
