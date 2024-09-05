import checkAccess from "./rules/checkAccess.js";
import checkAlignment from "./rules/checkAlignment.js";
import checkExamples from "./rules/checkExamples.js";
import checkIndentation from "./rules/checkIndentation.js";
import checkLineAlignment from "./rules/checkLineAlignment.js";
import checkParamNames from "./rules/checkParamNames.js";
import checkPropertyNames from "./rules/checkPropertyNames.js";
import checkSyntax from "./rules/checkSyntax.js";
import checkTagNames from "./rules/checkTagNames.js";
import checkTemplateNames from "./rules/checkTemplateNames.js";
import checkTypes from "./rules/checkTypes.js";
import checkValues from "./rules/checkValues.js";
import convertToJsdocComments from "./rules/convertToJsdocComments.js";
import emptyTags from "./rules/emptyTags.js";
import implementsOnClasses from "./rules/implementsOnClasses.js";
import importsAsDependencies from "./rules/importsAsDependencies.js";
import informativeDocs from "./rules/informativeDocs.js";
import linesBeforeBlock from "./rules/linesBeforeBlock.js";
import matchDescription from "./rules/matchDescription.js";
import matchName from "./rules/matchName.js";
import multilineBlocks from "./rules/multilineBlocks.js";
import noBadBlocks from "./rules/noBadBlocks.js";
import noBlankBlockDescriptions from "./rules/noBlankBlockDescriptions.js";
import noBlankBlocks from "./rules/noBlankBlocks.js";
import noDefaults from "./rules/noDefaults.js";
import noMissingSyntax from "./rules/noMissingSyntax.js";
import noMultiAsterisks from "./rules/noMultiAsterisks.js";
import noRestrictedSyntax from "./rules/noRestrictedSyntax.js";
import noTypes from "./rules/noTypes.js";
import noUndefinedTypes from "./rules/noUndefinedTypes.js";
import requireAsteriskPrefix from "./rules/requireAsteriskPrefix.js";
import requireDescription from "./rules/requireDescription.js";
import requireDescriptionCompleteSentence from "./rules/requireDescriptionCompleteSentence.js";
import requireExample from "./rules/requireExample.js";
import requireFileOverview from "./rules/requireFileOverview.js";
import requireHyphenBeforeParamDescription from "./rules/requireHyphenBeforeParamDescription.js";
import requireJsdoc from "./rules/requireJsdoc.js";
import requireParam from "./rules/requireParam.js";
import requireParamDescription from "./rules/requireParamDescription.js";
import requireParamName from "./rules/requireParamName.js";
import requireParamType from "./rules/requireParamType.js";
import requireProperty from "./rules/requireProperty.js";
import requirePropertyDescription from "./rules/requirePropertyDescription.js";
import requirePropertyName from "./rules/requirePropertyName.js";
import requirePropertyType from "./rules/requirePropertyType.js";
import requireReturns from "./rules/requireReturns.js";
import requireReturnsCheck from "./rules/requireReturnsCheck.js";
import requireReturnsDescription from "./rules/requireReturnsDescription.js";
import requireReturnsType from "./rules/requireReturnsType.js";
import requireTemplate from "./rules/requireTemplate.js";
import requireThrows from "./rules/requireThrows.js";
import requireYields from "./rules/requireYields.js";
import requireYieldsCheck from "./rules/requireYieldsCheck.js";
import sortTags from "./rules/sortTags.js";
import tagLines from "./rules/tagLines.js";
import textEscaping from "./rules/textEscaping.js";
import validTypes from "./rules/validTypes.js";

/**
 * @type {import('eslint').ESLint.Plugin & {
 *   configs: Record<
 *     "recommended"|"recommended-error"|"recommended-typescript"|
 *       "recommended-typescript-error"|"recommended-typescript-flavor"|
 *       "recommended-typescript-flavor-error"|"flat/recommended"|
 *       "flat/recommended-error"|"flat/recommended-typescript"|
 *       "flat/recommended-typescript-error"|
 *       "flat/recommended-typescript-flavor"|
 *       "flat/recommended-typescript-flavor-error",
 *     import('eslint').Linter.FlatConfig
 *   >
 * }}
 */
const index: import("eslint").ESLint.Plugin = {
  // @ts-expect-error Ok
  configs: {},
  rules: {
    "check-access": checkAccess,
    "check-alignment": checkAlignment,
    "check-examples": checkExamples,
    "check-indentation": checkIndentation,
    "check-line-alignment": checkLineAlignment,
    "check-param-names": checkParamNames,
    "check-property-names": checkPropertyNames,
    "check-syntax": checkSyntax,
    "check-tag-names": checkTagNames,
    "check-template-names": checkTemplateNames,
    "check-types": checkTypes,
    "check-values": checkValues,
    "convert-to-jsdoc-comments": convertToJsdocComments,
    "empty-tags": emptyTags,
    "implements-on-classes": implementsOnClasses,
    "imports-as-dependencies": importsAsDependencies,
    "informative-docs": informativeDocs,
    "lines-before-block": linesBeforeBlock,
    "match-description": matchDescription,
    "match-name": matchName,
    "multiline-blocks": multilineBlocks,
    "no-bad-blocks": noBadBlocks,
    "no-blank-block-descriptions": noBlankBlockDescriptions,
    "no-blank-blocks": noBlankBlocks,
    "no-defaults": noDefaults,
    "no-missing-syntax": noMissingSyntax,
    "no-multi-asterisks": noMultiAsterisks,
    "no-restricted-syntax": noRestrictedSyntax,
    "no-types": noTypes,
    "no-undefined-types": noUndefinedTypes,
    "require-asterisk-prefix": requireAsteriskPrefix,
    "require-description": requireDescription,
    "require-description-complete-sentence": requireDescriptionCompleteSentence,
    "require-example": requireExample,
    "require-file-overview": requireFileOverview,
    "require-hyphen-before-param-description":
      requireHyphenBeforeParamDescription,
    "require-jsdoc": requireJsdoc,
    "require-param": requireParam,
    "require-param-description": requireParamDescription,
    "require-param-name": requireParamName,
    "require-param-type": requireParamType,
    "require-property": requireProperty,
    "require-property-description": requirePropertyDescription,
    "require-property-name": requirePropertyName,
    "require-property-type": requirePropertyType,
    "require-returns": requireReturns,
    "require-returns-check": requireReturnsCheck,
    "require-returns-description": requireReturnsDescription,
    "require-returns-type": requireReturnsType,
    "require-template": requireTemplate,
    "require-throws": requireThrows,
    "require-yields": requireYields,
    "require-yields-check": requireYieldsCheck,
    "sort-tags": sortTags,
    "tag-lines": tagLines,
    "text-escaping": textEscaping,
    "valid-types": validTypes,
  },
};

export default index;
