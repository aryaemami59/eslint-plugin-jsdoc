import iterateJsdoc from "../iterateJsdoc.js";

/**
 * Validates the parameter names in the JSDoc.
 * @param {string} targetTagName - The target tag name for the JSDoc.
 * @param {boolean} allowExtraTrailingParamDocs - Whether to allow extra trailing parameter documentation.
 * @param {boolean} checkDestructured - Whether to check destructured parameters.
 * @param {boolean} checkRestProperty - Whether to check rest properties.
 * @param {RegExp} checkTypesRegex - Regex to check types.
 * @param {boolean} disableExtraPropertyReporting - Whether to disable extra property reporting.
 * @param {boolean} disableMissingParamChecks - Whether to disable missing parameter checks.
 * @param {boolean} enableFixer - Whether to enable fixer.
 * @param {import('../jsdocUtils.js').ParamNameInfo[]} functionParameterNames - The function parameter names.
 * @param {import('comment-parser').Block} jsdoc - The JSDoc block.
 * @param {import('../iterateJsdoc.js').Utils} utils - Utility functions.
 * @param {import('../iterateJsdoc.js').Report} report - The report function.
 * @returns {boolean} - Returns true if there is an error.
 */
const validateParameterNames = (
  targetTagName: string,
  allowExtraTrailingParamDocs: boolean,
  checkDestructured: boolean,
  checkRestProperty: boolean,
  checkTypesRegex: RegExp,
  disableExtraPropertyReporting: boolean,
  disableMissingParamChecks: boolean,
  enableFixer: boolean,
  functionParameterNames: import("../jsdocUtils.js").ParamNameInfo[],
  jsdoc: import("comment-parser").Block,
  utils: import("../iterateJsdoc.js").Utils,
  report: import("../iterateJsdoc.js").Report,
): boolean => {
  const paramTags = Object.entries(jsdoc.tags).filter(
    ([, tag]) => tag.tag === targetTagName,
  );
  const paramTagsNonNested = paramTags.filter(
    ([, tag]) => !tag.name.includes("."),
  );

  let dotted = 0;
  let thisOffset = 0;

  return paramTags.some(([, tag], index) => {
    let tagsIndex: number;

    const dupeTagInfo = paramTags.find(([tgsIndex, tg], idx) => {
      tagsIndex = Number(tgsIndex);
      return tg.name === tag.name && idx !== index;
    });

    if (dupeTagInfo) {
      utils.reportJSDoc(
        `Duplicate @${targetTagName} "${tag.name}"`,
        dupeTagInfo[1],
        enableFixer ? () => utils.removeTag(tagsIndex) : null,
      );
      return true;
    }

    if (tag.name.includes(".")) {
      dotted++;
      return false;
    }

    let functionParameterName =
      functionParameterNames[index - dotted + thisOffset];

    if (functionParameterName === "this" && tag.name.trim() !== "this") {
      ++thisOffset;
      functionParameterName =
        functionParameterNames[index - dotted + thisOffset];
    }

    if (!functionParameterName) {
      if (allowExtraTrailingParamDocs) {
        return false;
      }

      report(
        `@${targetTagName} "${tag.name}" does not match an existing function parameter.`,
        null,
        tag,
      );
      return true;
    }

    if (Array.isArray(functionParameterName)) {
      if (!checkDestructured) {
        return false;
      }

      if (tag.type && tag.type.search(checkTypesRegex) === -1) {
        return false;
      }

      const [
        parameterName,
        { names: properties, hasPropertyRest, rests, annotationParamName },
      ] = functionParameterName;
      if (annotationParamName !== undefined) {
        const name = tag.name.trim();
        if (name !== annotationParamName) {
          report(
            `@${targetTagName} "${name}" does not match parameter name "${annotationParamName}"`,
            null,
            tag,
          );
        }
      }

      const tagName =
        parameterName === undefined ? tag.name.trim() : parameterName;
      const expectedNames = properties.map((name) => `${tagName}.${name}`);
      const actualNames = paramTags.map(([, paramTag]) => paramTag.name.trim());
      const actualTypes = paramTags.map(([, paramTag]) => paramTag.type);

      const missingProperties = [];
      const notCheckingNames: string[] = [];

      for (const [idx, name] of expectedNames.entries()) {
        if (
          notCheckingNames.some((notCheckingName) =>
            name.startsWith(notCheckingName),
          )
        ) {
          continue;
        }

        const actualNameIdx = actualNames.findIndex((actualName) =>
          utils.comparePaths(name)(actualName),
        );

        if (actualNameIdx === -1) {
          if (!checkRestProperty && rests[idx]) {
            continue;
          }

          const missingIndex = actualNames.findIndex((actualName) =>
            utils.pathDoesNotBeginWith(name, actualName),
          );
          const line =
            tag.source[0].number -
            1 +
            (missingIndex > -1 ? missingIndex : actualNames.length);
          missingProperties.push({
            name,
            tagPlacement: {
              line: line === 0 ? 1 : line,
            },
          });
        } else if (
          actualTypes[actualNameIdx].search(checkTypesRegex) === -1 &&
          actualTypes[actualNameIdx] !== ""
        ) {
          notCheckingNames.push(name);
        }
      }

      const hasMissing = missingProperties.length > 0;
      if (hasMissing) {
        for (const {
          tagPlacement,
          name: missingProperty,
        } of missingProperties) {
          report(
            `Missing @${targetTagName} "${missingProperty}"`,
            null,
            tagPlacement,
          );
        }
      }

      if (!hasPropertyRest || checkRestProperty) {
        const extraProperties = actualNames.reduce<
          [string, import("comment-parser").Spec][]
        >((acc, name, idx) => {
          if (
            name.startsWith(tag.name.trim() + ".") &&
            !expectedNames.some(utils.comparePaths(name)) &&
            !utils.comparePaths(name)(tag.name) &&
            (!disableExtraPropertyReporting ||
              properties.some(
                (prop) => prop.split(".").length >= name.split(".").length - 1,
              ))
          ) {
            acc.push([name, paramTags[idx][1]]);
          }
          return acc;
        }, []);

        if (extraProperties.length) {
          for (const [extraProperty, tg] of extraProperties) {
            report(
              `@${targetTagName} "${extraProperty}" does not exist on ${tag.name}`,
              null,
              tg,
            );
          }
          return true;
        }
      }

      return hasMissing;
    }

    const funcParamName =
      typeof functionParameterName === "object"
        ? functionParameterName.name
        : functionParameterName;

    if (funcParamName !== tag.name.trim()) {
      const actualNames = paramTagsNonNested.map(([, { name }]) => name.trim());
      const expectedNames = functionParameterNames
        .map((item, idx) => (Array.isArray(item) ? actualNames[idx] : item))
        .filter((item) => item !== "this");

      if (disableMissingParamChecks) {
        const usedExpectedNames = expectedNames
          .map((a) => a?.toString())
          .filter(
            (expectedName) =>
              expectedName && actualNames.includes(expectedName),
          );
        const usedInOrder = actualNames.every(
          (actualName, idx) => actualName === usedExpectedNames[idx],
        );
        if (usedInOrder) {
          return false;
        }
      }

      report(
        `Expected @${targetTagName} names to be "${expectedNames
          .map((expectedName) =>
            typeof expectedName === "object" &&
            "name" in expectedName &&
            expectedName.restElement
              ? "..." + expectedName.name
              : expectedName,
          )
          .join(", ")}". Got "${actualNames.join(", ")}".`,
        null,
        tag,
      );

      return true;
    }

    return false;
  });
};

/**
 * Validates the parameter names deeply in JSDoc.
 * @param {string} targetTagName - The target tag name.
 * @param {boolean} allowExtraTrailingParamDocs - Whether to allow extra trailing parameter documentation.
 * @param {Array<{name: string, idx: number}>} jsdocParameterNames - The JSDoc parameter names.
 * @param {import('comment-parser').Block} jsdoc - The JSDoc block.
 * @param {Function} report - The report function.
 * @returns {boolean} - Returns true if there is an error.
 */
const validateParameterNamesDeep = (
  targetTagName: string,
  allowExtraTrailingParamDocs: boolean,
  jsdocParameterNames: { name: string; idx: number }[],
  jsdoc: import("comment-parser").Block,
  report: (message: string, fixer: null, tag: any) => void,
): boolean => {
  let lastRealParameter: string | undefined;

  return jsdocParameterNames.some(({ name: jsdocParameterName, idx }) => {
    const isPropertyPath = jsdocParameterName.includes(".");

    if (isPropertyPath) {
      if (!lastRealParameter) {
        report(
          `@${targetTagName} path declaration ("${jsdocParameterName}") appears before any real parameter.`,
          null,
          jsdoc.tags[idx],
        );
        return true;
      }

      let pathRootNodeName = jsdocParameterName.slice(
        0,
        jsdocParameterName.indexOf("."),
      );

      if (pathRootNodeName.endsWith("[]")) {
        pathRootNodeName = pathRootNodeName.slice(0, -2);
      }

      if (pathRootNodeName !== lastRealParameter) {
        report(
          `@${targetTagName} path declaration ("${jsdocParameterName}") root node name ("${pathRootNodeName}") does not match previous real parameter name ("${lastRealParameter}").`,
          null,
          jsdoc.tags[idx],
        );
        return true;
      }
    } else {
      lastRealParameter = jsdocParameterName;
    }

    return false;
  });
};

const allowedNodes = [
  "ArrowFunctionExpression",
  "FunctionDeclaration",
  "FunctionExpression",
  "TSDeclareFunction",
  "TSMethodSignature",
];

export default iterateJsdoc(
  ({
    context,
    jsdoc,
    report,
    utils,
    node,
  }: {
    context: { options: any[] };
    jsdoc: import("comment-parser").Block;
    report: import("../iterateJsdoc.js").Report;
    utils: import("../iterateJsdoc.js").Utils;
    node: import("estree").Node;
  }) => {
    const {
      allowExtraTrailingParamDocs,
      checkDestructured = true,
      checkRestProperty = false,
      checkTypesPattern = "/^(?:[oO]bject|[aA]rray|PlainObject|Generic(?:Object|Array))$/",
      enableFixer = false,
      useDefaultObjectProperties = false,
      disableExtraPropertyReporting = false,
      disableMissingParamChecks = false,
    } = context.options[0] || {};

    if (!allowedNodes.includes(node.type)) {
      return;
    }

    const checkTypesRegex = utils.getRegexFromString(checkTypesPattern);

    const jsdocParameterNamesDeep = utils.getJsdocTagsDeep("param");
    if (!jsdocParameterNamesDeep || !jsdocParameterNamesDeep.length) {
      return;
    }

    const functionParameterNames = utils.getFunctionParameterNames(
      useDefaultObjectProperties,
    );

    const targetTagName = utils.getPreferredTagName({ tagName: "param" });

    const isError = validateParameterNames(
      targetTagName,
      allowExtraTrailingParamDocs,
      checkDestructured,
      checkRestProperty,
      checkTypesRegex,
      disableExtraPropertyReporting,
      disableMissingParamChecks,
      enableFixer,
      functionParameterNames,
      jsdoc,
      utils,
      report,
    );

    if (isError || !checkDestructured) {
      return;
    }

    validateParameterNamesDeep(
      targetTagName,
      allowExtraTrailingParamDocs,
      jsdocParameterNamesDeep,
      jsdoc,
      report,
    );
  },
  {
    contextDefaults: allowedNodes,
    meta: {
      docs: {
        description:
          "Ensures that parameter names in JSDoc match those in the function declaration.",
        url: "https://github.com/gajus/eslint-plugin-jsdoc/blob/main/docs/rules/check-param-names.md#repos-sticky-header",
      },
      fixable: "code",
      schema: [
        {
          additionalProperties: false,
          properties: {
            allowExtraTrailingParamDocs: { type: "boolean" },
            checkDestructured: { type: "boolean" },
            checkRestProperty: { type: "boolean" },
            checkTypesPattern: { type: "string" },
            disableExtraPropertyReporting: { type: "boolean" },
            disableMissingParamChecks: { type: "boolean" },
            enableFixer: { type: "boolean" },
            useDefaultObjectProperties: { type: "boolean" },
          },
          type: "object",
        },
      ],
      type: "suggestion",
    },
  },
);
