import { ParserMode } from "./jsdocUtils";

type TagStructure = Map<string, Map<string, string | boolean>>;

const getDefaultTagStructureForMode = (mode: ParserMode): TagStructure => {
  const isJsdoc = mode === "jsdoc";
  const isClosure = mode === "closure";
  const isTypescript = mode === "typescript";
  const isPermissive = mode === "permissive";

  const isJsdocOrPermissive = isJsdoc || isPermissive;
  const isJsdocOrTypescript = isJsdoc || isTypescript;
  const isTypescriptOrClosure = isTypescript || isClosure;
  const isClosureOrPermissive = isClosure || isPermissive;
  const isJsdocTypescriptOrPermissive = isJsdocOrTypescript || isPermissive;

  return new Map([
    [
      "alias",
      new Map<string, string | boolean>([
        ["namepathRole", "namepath-defining"],
        ["typeOrNameRequired", true],
      ]),
    ],
    [
      "arg",
      new Map<string, string | boolean>([
        ["namepathRole", "namepath-defining"],
        ["nameRequired", true],
        ["typeAllowed", true],
      ]),
    ],
    [
      "argument",
      new Map<string, string | boolean>([
        ["namepathRole", "namepath-defining"],
        ["nameRequired", true],
        ["typeAllowed", true],
      ]),
    ],
    [
      "augments",
      new Map<string, string | boolean>([
        ["namepathRole", "namepath-referencing"],
        ["typeAllowed", true],
        ["typeOrNameRequired", true],
      ]),
    ],
    [
      "borrows",
      new Map<string, string | boolean>([
        ["namepathRole", "namepath-referencing"],
        ["typeOrNameRequired", true],
      ]),
    ],
    [
      "callback",
      new Map<string, string | boolean>([
        ["namepathRole", "namepath-defining"],
        ["nameRequired", true],
      ]),
    ],
    [
      "class",
      new Map<string, string | boolean>([
        ["namepathRole", "namepath-defining"],
        ["nameAllowed", true],
        ["typeAllowed", true],
      ]),
    ],
    [
      "const",
      new Map<string, string | boolean>([
        ["namepathRole", "namepath-defining"],
        ["typeAllowed", true],
      ]),
    ],
    [
      "constant",
      new Map<string, string | boolean>([
        ["namepathRole", "namepath-defining"],
        ["typeAllowed", true],
      ]),
    ],
    [
      "constructor",
      new Map<string, string | boolean>([
        ["namepathRole", "namepath-defining"],
        ["typeAllowed", true],
      ]),
    ],
    [
      "constructs",
      new Map<string, string | boolean>([
        ["namepathRole", "namepath-defining"],
        ["nameRequired", false],
        ["typeAllowed", false],
      ]),
    ],
    [
      "define",
      new Map<string, string | boolean>([["typeRequired", isClosure]]),
    ],
    [
      "emits",
      new Map<string, string | boolean>([
        ["namepathRole", "namepath-referencing"],
        ["nameRequired", true],
        ["typeAllowed", false],
      ]),
    ],
    ["enum", new Map<string, string | boolean>([["typeAllowed", true]])],
    [
      "event",
      new Map<string, string | boolean>([
        ["nameRequired", true],
        ["namepathRole", "namepath-defining"],
      ]),
    ],
    ["exception", new Map<string, string | boolean>([["typeAllowed", true]])],
    [
      "export",
      new Map<string, string | boolean>([
        ["typeAllowed", isClosureOrPermissive],
      ]),
    ],
    [
      "exports",
      new Map<string, string | boolean>([
        ["namepathRole", "namepath-defining"],
        ["nameRequired", isJsdoc],
        ["typeAllowed", isClosureOrPermissive],
      ]),
    ],
    [
      "extends",
      new Map<string, string | boolean>([
        ["namepathRole", "namepath-referencing"],
        ["typeAllowed", isTypescriptOrClosure || isPermissive],
        ["nameRequired", isJsdoc],
        ["typeOrNameRequired", isTypescriptOrClosure || isPermissive],
      ]),
    ],
    [
      "external",
      new Map<string, string | boolean>([
        ["namepathRole", "namepath-defining"],
        ["nameRequired", true],
        ["typeAllowed", false],
      ]),
    ],
    [
      "fires",
      new Map<string, string | boolean>([
        ["namepathRole", "namepath-referencing"],
        ["nameRequired", true],
        ["typeAllowed", false],
      ]),
    ],
    [
      "function",
      new Map<string, string | boolean>([
        ["namepathRole", "namepath-defining"],
        ["nameRequired", false],
        ["typeAllowed", false],
      ]),
    ],
    [
      "func",
      new Map<string, string | boolean>([
        ["namepathRole", "namepath-defining"],
      ]),
    ],
    [
      "host",
      new Map<string, string | boolean>([
        ["namepathRole", "namepath-defining"],
        ["nameRequired", true],
        ["typeAllowed", false],
      ]),
    ],
    [
      "interface",
      new Map<string, string | boolean>([
        [
          "namepathRole",
          isJsdocTypescriptOrPermissive ? "namepath-defining" : false,
        ],
        ["nameAllowed", isClosure],
        ["typeAllowed", false],
      ]),
    ],
    [
      "internal",
      new Map<string, string | boolean>([
        ["namepathRole", false],
        ["nameAllowed", false],
      ]),
    ],
    ["implements", new Map<string, string | boolean>([["typeRequired", true]])],
    [
      "lends",
      new Map<string, string | boolean>([
        ["namepathRole", "namepath-referencing"],
        ["typeOrNameRequired", true],
      ]),
    ],
    [
      "link",
      new Map<string, string | boolean>([
        ["namepathRole", "namepath-or-url-referencing"],
      ]),
    ],
    [
      "linkcode",
      new Map<string, string | boolean>([
        ["namepathRole", "namepath-or-url-referencing"],
      ]),
    ],
    [
      "linkplain",
      new Map<string, string | boolean>([
        ["namepathRole", "namepath-or-url-referencing"],
      ]),
    ],
    [
      "listens",
      new Map<string, string | boolean>([
        ["namepathRole", "namepath-referencing"],
        ["nameRequired", true],
        ["typeAllowed", false],
      ]),
    ],
    [
      "member",
      new Map<string, string | boolean>([
        ["namepathRole", "namepath-defining"],
        ["typeAllowed", true],
      ]),
    ],
    [
      "memberof",
      new Map<string, string | boolean>([
        ["namepathRole", "namepath-referencing"],
        ["typeOrNameRequired", true],
      ]),
    ],
    [
      "memberof!",
      new Map<string, string | boolean>([
        ["namepathRole", "namepath-referencing"],
        ["typeOrNameRequired", true],
      ]),
    ],
    [
      "method",
      new Map<string, string | boolean>([
        ["namepathRole", "namepath-defining"],
      ]),
    ],
    [
      "mixes",
      new Map<string, string | boolean>([
        ["namepathRole", "namepath-referencing"],
        ["typeOrNameRequired", true],
      ]),
    ],
    [
      "mixin",
      new Map<string, string | boolean>([
        ["namepathRole", "namepath-defining"],
        ["nameRequired", false],
        ["typeAllowed", false],
      ]),
    ],
    ["modifies", new Map<string, string | boolean>([["typeAllowed", true]])],
    [
      "module",
      new Map<string, string | boolean>([
        ["namepathRole", isJsdoc ? "namepath-defining" : "text"],
        ["typeAllowed", true],
      ]),
    ],
    [
      "name",
      new Map<string, string | boolean>([
        ["namepathRole", "namepath-defining"],
        ["nameRequired", true],
        ["typeOrNameRequired", true],
      ]),
    ],
    [
      "namespace",
      new Map<string, string | boolean>([
        ["namepathRole", "namepath-defining"],
        ["typeAllowed", true],
      ]),
    ],
    [
      "package",
      new Map<string, string | boolean>([
        ["typeAllowed", isClosureOrPermissive],
      ]),
    ],
    [
      "param",
      new Map<string, string | boolean>([
        ["namepathRole", "namepath-defining"],
        ["nameRequired", true],
        ["typeAllowed", true],
      ]),
    ],
    [
      "private",
      new Map<string, string | boolean>([
        ["typeAllowed", isClosureOrPermissive],
      ]),
    ],
    [
      "prop",
      new Map<string, string | boolean>([
        ["namepathRole", "namepath-defining"],
        ["nameRequired", true],
        ["typeAllowed", true],
      ]),
    ],
    [
      "property",
      new Map<string, string | boolean>([
        ["namepathRole", "namepath-defining"],
        ["nameRequired", true],
        ["typeAllowed", true],
      ]),
    ],
    [
      "protected",
      new Map<string, string | boolean>([
        ["typeAllowed", isClosureOrPermissive],
      ]),
    ],
    [
      "public",
      new Map<string, string | boolean>([
        ["typeAllowed", isClosureOrPermissive],
      ]),
    ],
    [
      "requires",
      new Map<string, string | boolean>([
        ["namepathRole", "namepath-referencing"],
        ["nameRequired", true],
        ["typeAllowed", false],
      ]),
    ],
    ["returns", new Map<string, string | boolean>([["typeAllowed", true]])],
    ["return", new Map<string, string | boolean>([["typeAllowed", true]])],
    ["satisfies", new Map<string, string | boolean>([["typeRequired", true]])],
    ["see", new Map<string, string | boolean>([["namepathRole", "text"]])],
    [
      "static",
      new Map<string, string | boolean>([
        ["typeAllowed", isClosureOrPermissive],
      ]),
    ],
    [
      "suppress",
      new Map<string, string | boolean>([
        ["namepathRole", !isClosure],
        ["typeRequired", isClosure],
      ]),
    ],
    [
      "template",
      new Map<string, string | boolean>([
        ["namepathRole", isJsdoc ? "text" : "namepath-referencing"],
        ["nameRequired", !isJsdoc],
        ["typeAllowed", isTypescriptOrClosure || isPermissive],
      ]),
    ],
    [
      "this",
      new Map<string, string | boolean>([
        ["namepathRole", isJsdoc ? "namepath-referencing" : false],
        ["typeRequired", isTypescriptOrClosure],
        ["typeOrNameRequired", isJsdoc],
      ]),
    ],
    ["throws", new Map<string, string | boolean>([["typeAllowed", true]])],
    [
      "tutorial",
      new Map<string, string | boolean>([
        ["nameRequired", true],
        ["typeAllowed", false],
      ]),
    ],
    ["type", new Map<string, string | boolean>([["typeRequired", true]])],
    [
      "typedef",
      new Map<string, string | boolean>([
        ["namepathRole", "namepath-defining"],
        ["nameRequired", isJsdocOrPermissive],
        ["typeAllowed", true],
        ["typeOrNameRequired", !isTypescript],
      ]),
    ],
    [
      "var",
      new Map<string, string | boolean>([
        ["namepathRole", "namepath-defining"],
        ["typeAllowed", true],
      ]),
    ],
    ["yields", new Map<string, string | boolean>([["typeAllowed", true]])],
    ["yield", new Map<string, string | boolean>([["typeAllowed", true]])],
  ]);
};

export default getDefaultTagStructureForMode;
