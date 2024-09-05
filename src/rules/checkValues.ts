import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import semver from "semver";
import spdxExpressionParse from "spdx-expression-parse";
import { createSyncFn } from "synckit";
import iterateJsdoc from "../iterateJsdoc.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const pathName = join(__dirname, "../import-worker.mjs");

const allowedKinds = new Set([
  "class",
  "constant",
  "event",
  "external",
  "file",
  "function",
  "member",
  "mixin",
  "module",
  "namespace",
  "typedef",
]);

interface Options {
  allowedLicenses?: string[] | boolean | null;
  allowedAuthors?: string[] | null;
  numericOnlyVariation?: boolean;
  licensePattern?: string;
}

export default iterateJsdoc(
  ({
    utils,
    report,
    context,
    settings,
  }: {
    utils: any;
    report: (message: string, fixer: null, tag?: any) => void;
    context: { options: [Options] };
    settings: { mode: string };
  }) => {
    const options = context.options[0] || {};
    const {
      allowedLicenses = null,
      allowedAuthors = null,
      numericOnlyVariation = false,
      licensePattern = "/([^\n\r]*)/gu",
    } = options;

    utils.forEachPreferredTag(
      "version",
      (jsdocParameter: any, targetTagName: string) => {
        const version = (
          utils.getTagDescription(jsdocParameter) as string
        ).trim();
        if (!version) {
          report(
            `Missing JSDoc @${targetTagName} value.`,
            null,
            jsdocParameter,
          );
        } else if (!semver.valid(version)) {
          report(
            `Invalid JSDoc @${targetTagName}: "${utils.getTagDescription(jsdocParameter)}".`,
            null,
            jsdocParameter,
          );
        }
      },
    );

    utils.forEachPreferredTag(
      "kind",
      (jsdocParameter: any, targetTagName: string) => {
        const kind = (utils.getTagDescription(jsdocParameter) as string).trim();
        if (!kind) {
          report(
            `Missing JSDoc @${targetTagName} value.`,
            null,
            jsdocParameter,
          );
        } else if (!allowedKinds.has(kind)) {
          report(
            `Invalid JSDoc @${targetTagName}: "${utils.getTagDescription(jsdocParameter)}"; ` +
              `must be one of: ${[...allowedKinds].join(", ")}.`,
            null,
            jsdocParameter,
          );
        }
      },
    );

    if (numericOnlyVariation) {
      utils.forEachPreferredTag(
        "variation",
        (jsdocParameter: any, targetTagName: string) => {
          const variation = (
            utils.getTagDescription(jsdocParameter) as string
          ).trim();
          if (!variation) {
            report(
              `Missing JSDoc @${targetTagName} value.`,
              null,
              jsdocParameter,
            );
          } else if (
            !Number.isInteger(Number(variation)) ||
            Number(variation) <= 0
          ) {
            report(
              `Invalid JSDoc @${targetTagName}: "${utils.getTagDescription(jsdocParameter)}".`,
              null,
              jsdocParameter,
            );
          }
        },
      );
    }

    utils.forEachPreferredTag(
      "since",
      (jsdocParameter: any, targetTagName: string) => {
        const version = (
          utils.getTagDescription(jsdocParameter) as string
        ).trim();
        if (!version) {
          report(
            `Missing JSDoc @${targetTagName} value.`,
            null,
            jsdocParameter,
          );
        } else if (!semver.valid(version)) {
          report(
            `Invalid JSDoc @${targetTagName}: "${utils.getTagDescription(jsdocParameter)}".`,
            null,
            jsdocParameter,
          );
        }
      },
    );

    utils.forEachPreferredTag(
      "license",
      (jsdocParameter: any, targetTagName: string) => {
        const licenseRegex = utils.getRegexFromString(licensePattern, "g");
        const matches = (
          utils.getTagDescription(jsdocParameter) as string
        ).matchAll(licenseRegex);
        let positiveMatch = false;
        for (const match of matches) {
          const license = match[1] || match[0];
          if (license) {
            positiveMatch = true;
          }

          if (!license.trim()) {
            if (positiveMatch) return;

            report(
              `Missing JSDoc @${targetTagName} value.`,
              null,
              jsdocParameter,
            );
          } else if (allowedLicenses) {
            if (
              allowedLicenses !== true &&
              !allowedLicenses.includes(license)
            ) {
              report(
                `Invalid JSDoc @${targetTagName}: "${license}"; expected one of ${allowedLicenses.join(", ")}.`,
                null,
                jsdocParameter,
              );
            }
          } else {
            try {
              spdxExpressionParse(license);
            } catch {
              report(
                `Invalid JSDoc @${targetTagName}: "${license}"; expected SPDX expression: https://spdx.org/licenses/.`,
                null,
                jsdocParameter,
              );
            }
          }
        }
      },
    );

    if (settings.mode === "typescript") {
      utils.forEachPreferredTag("import", (tag: any) => {
        const { type, name, description } = tag;
        const typePart = type ? `{${type}} ` : "";
        const imprt =
          "import " +
          (description
            ? `${typePart}${name} ${description}`
            : `${typePart}${name}`);

        const getImports = createSyncFn(pathName);
        if (!getImports(imprt)) {
          report("Bad @import tag", null, tag);
        }
      });
    }

    utils.forEachPreferredTag(
      "author",
      (jsdocParameter: any, targetTagName: string) => {
        const author = (
          utils.getTagDescription(jsdocParameter) as string
        ).trim();
        if (!author) {
          report(
            `Missing JSDoc @${targetTagName} value.`,
            null,
            jsdocParameter,
          );
        } else if (allowedAuthors && !allowedAuthors.includes(author)) {
          report(
            `Invalid JSDoc @${targetTagName}: "${utils.getTagDescription(jsdocParameter)}"; expected one of ${allowedAuthors.join(", ")}.`,
            null,
            jsdocParameter,
          );
        }
      },
    );
  },
  {
    iterateAllJsdocs: true,
    meta: {
      docs: {
        description:
          "This rule checks the values for a handful of tags: `@version`, `@since`, `@license`, and `@author`.",
        url: "https://github.com/gajus/eslint-plugin-jsdoc/blob/main/docs/rules/check-values.md#repos-sticky-header",
      },
      schema: [
        {
          additionalProperties: false,
          properties: {
            allowedAuthors: {
              items: {
                type: "string",
              },
              type: "array",
            },
            allowedLicenses: {
              anyOf: [
                {
                  items: {
                    type: "string",
                  },
                  type: "array",
                },
                {
                  type: "boolean",
                },
              ],
            },
            licensePattern: {
              type: "string",
            },
            numericOnlyVariation: {
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
