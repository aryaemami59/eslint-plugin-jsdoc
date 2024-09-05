import iterateJsdoc from "../iterateJsdoc.js";

/**
 * @typedef {[string, boolean, () => RootNamerReturn]} RootNamerReturn
 */

/**
 * @param {string[]} desiredRoots
 * @param {number} currentIndex
 * @returns {RootNamerReturn}
 */
const rootNamer = (
  desiredRoots: string[],
  currentIndex: number,
): [string, boolean, () => RootNamerReturn] => {
  let name: string;
  let idx = currentIndex;
  const incremented = desiredRoots.length <= 1;
  if (incremented) {
    const base = desiredRoots[0];
    const suffix = idx++;
    name = `${base}${suffix}`;
  } else {
    name = desiredRoots.shift() as string;
  }

  return [
    name,
    incremented,
    () => {
      return rootNamer(desiredRoots, idx);
    },
  ];
};

export default iterateJsdoc(
  ({ jsdoc, utils, context }) => {
    if (utils.avoidDocs()) {
      return;
    }

    if (utils.hasTag("type")) {
      return;
    }

    const {
      autoIncrementBase = 0,
      checkRestProperty = false,
      checkDestructured = true,
      checkDestructuredRoots = true,
      checkTypesPattern = "/^(?:[oO]bject|[aA]rray|PlainObject|Generic(?:Object|Array))$/",
      enableFixer = true,
      enableRootFixer = true,
      enableRestElementFixer = true,
      unnamedRootBase = ["root"],
      useDefaultObjectProperties = false,
    } = context.options[0] || {};

    const preferredTagName = utils.getPreferredTagName({
      tagName: "param",
    }) as string;
    if (!preferredTagName) {
      return;
    }

    const functionParameterNames = utils.getFunctionParameterNames(
      useDefaultObjectProperties,
    );
    if (!functionParameterNames.length) {
      return;
    }

    const jsdocParameterNames = utils
      .getJsdocTagsDeep(preferredTagName)
      .map((tag: any, idx: number) => ({
        ...tag,
        idx,
      }));

    const shallowJsdocParameterNames = jsdocParameterNames.filter(
      (tag: any) => !tag.name.includes("."),
    );

    const checkTypesRegex = utils.getRegexFromString(checkTypesPattern);

    const missingTags: {
      functionParameterIdx: number;
      functionParameterName: string;
      inc?: boolean;
      remove?: true;
      type?: string;
    }[] = [];

    const flattenedRoots = utils.flattenRoots(functionParameterNames).names;

    const paramIndex: Record<string, number> = {};

    flattenedRoots.forEach((cur, idx) => {
      paramIndex[utils.dropPathSegmentQuotes(String(cur))] = idx;
    });

    const hasParamIndex = (cur: string) =>
      utils.dropPathSegmentQuotes(String(cur)) in paramIndex;

    const getParamIndex = (cur: string | number | undefined) =>
      paramIndex[utils.dropPathSegmentQuotes(String(cur))];

    const setParamIndex = (cur: string, idx: number) => {
      paramIndex[utils.dropPathSegmentQuotes(String(cur))] = idx;
    };

    let [nextRootName, incremented, namer] = rootNamer(
      [...unnamedRootBase],
      autoIncrementBase,
    );

    const thisOffset = functionParameterNames[0] === "this" ? 1 : 0;

    for (const [
      functionParameterIdx,
      functionParameterName,
    ] of functionParameterNames.entries()) {
      let inc: boolean | undefined;
      if (Array.isArray(functionParameterName)) {
        const matchedJsdoc =
          shallowJsdocParameterNames[functionParameterIdx - thisOffset];
        let rootName: string;
        if (functionParameterName[0]) {
          rootName = functionParameterName[0];
        } else if (matchedJsdoc && matchedJsdoc.name) {
          rootName = matchedJsdoc.name;
          if (
            matchedJsdoc.type &&
            matchedJsdoc.type.search(checkTypesRegex) === -1
          ) {
            continue;
          }
        } else {
          rootName = nextRootName;
          inc = incremented;
        }
        [nextRootName, incremented, namer] = namer();

        const { hasRestElement, names } = functionParameterName[1];
        if (!enableRestElementFixer && hasRestElement) continue;
        if (!checkDestructuredRoots) continue;

        for (const [idx, paramName] of names.entries()) {
          const fullParamName = `${rootName}.${paramName}`;
          if (
            !jsdocParameterNames.some(({ name }) =>
              utils.comparePaths(name)(fullParamName),
            )
          ) {
            missingTags.push({
              functionParameterIdx: getParamIndex(rootName),
              functionParameterName: fullParamName,
              inc,
              type: hasRestElement ? "{...any}" : undefined,
            });
          }
        }
      } else {
        let funcParamName: string;
        let type: string | undefined;
        if (typeof functionParameterName === "object") {
          if (!enableRestElementFixer && functionParameterName.restElement)
            continue;
          funcParamName = functionParameterName.name;
          type = "{...any}";
        } else {
          funcParamName = functionParameterName;
        }

        if (
          !jsdocParameterNames.some(({ name }) => name === funcParamName) &&
          funcParamName !== "this"
        ) {
          missingTags.push({
            functionParameterIdx: getParamIndex(funcParamName),
            functionParameterName: funcParamName,
            inc,
            type,
          });
        }
      }
    }

    const fix = ({
      functionParameterIdx,
      functionParameterName,
      remove,
      inc,
      type,
    }: {
      functionParameterIdx: number;
      functionParameterName: string;
      remove?: true;
      inc?: boolean;
      type?: string;
    }) => {
      if (inc && !enableRootFixer) return;

      const createTokens = (
        tagIndex: number,
        sourceIndex: number,
        spliceCount: number,
      ) => {
        const tokens = {
          number: sourceIndex + 1,
          source: "",
          tokens: {
            delimiter: "*",
            description: "",
            end: "",
            lineEnd: "",
            name: functionParameterName,
            newAdd: true,
            postDelimiter: " ",
            postName: "",
            postTag: " ",
            postType: type ? " " : "",
            start: jsdoc.source[sourceIndex].tokens.start,
            tag: `@${preferredTagName}`,
            type: type ?? "",
          },
        };

        jsdoc.tags.splice(tagIndex, spliceCount, {
          description: "",
          inlineTags: [],
          name: functionParameterName,
          newAdd: true,
          optional: false,
          problems: [],
          source: [tokens],
          tag: preferredTagName,
          type: type ?? "",
        });

        const firstNumber = jsdoc.source[0].number;
        jsdoc.source.splice(sourceIndex, spliceCount, tokens);
        for (const [idx, src] of jsdoc.source.slice(sourceIndex).entries()) {
          src.number = firstNumber + sourceIndex + idx;
        }
      };

      const offset = jsdoc.source.findIndex(
        ({ tokens: { tag, end } }) => tag || end,
      );
      if (remove) {
        createTokens(functionParameterIdx, offset + functionParameterIdx, 1);
      } else {
        const expectedIdx = findExpectedIndex(jsdoc.tags, functionParameterIdx);
        createTokens(expectedIdx, offset + expectedIdx, 0);
      }
    };

    const fixer = () => {
      for (const missingTag of missingTags) {
        fix(missingTag);
      }
    };

    if (missingTags.length && jsdoc.source.length === 1) {
      utils.makeMultiline();
    }

    for (const { functionParameterName } of missingTags) {
      utils.reportJSDoc(
        `Missing JSDoc @${preferredTagName} "${functionParameterName}" declaration.`,
        null,
        enableFixer ? fixer : null,
      );
    }
  },
  {
    contextDefaults: true,
    meta: {
      docs: {
        description: "Requires that all function parameters are documented.",
        url: "https://github.com/gajus/eslint-plugin-jsdoc/blob/main/docs/rules/require-param.md#repos-sticky-header",
      },
      fixable: "code",
      schema: [
        {
          additionalProperties: false,
          properties: {
            autoIncrementBase: { default: 0, type: "integer" },
            checkConstructors: { default: true, type: "boolean" },
            checkDestructured: { default: true, type: "boolean" },
            checkDestructuredRoots: { default: true, type: "boolean" },
            checkGetters: { default: false, type: "boolean" },
            checkRestProperty: { default: false, type: "boolean" },
            checkSetters: { default: false, type: "boolean" },
            checkTypesPattern: { type: "string" },
            contexts: {
              items: {
                anyOf: [
                  { type: "string" },
                  {
                    additionalProperties: false,
                    properties: {
                      comment: { type: "string" },
                      context: { type: "string" },
                    },
                    type: "object",
                  },
                ],
              },
              type: "array",
            },
            enableFixer: { type: "boolean" },
            enableRestElementFixer: { type: "boolean" },
            enableRootFixer: { type: "boolean" },
            exemptedBy: {
              items: { type: "string" },
              type: "array",
            },
            unnamedRootBase: {
              items: { type: "string" },
              type: "array",
            },
            useDefaultObjectProperties: { type: "boolean" },
          },
          type: "object",
        },
      ],
      type: "suggestion",
    },
  },
);
