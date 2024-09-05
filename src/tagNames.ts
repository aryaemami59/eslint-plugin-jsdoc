/**
 * AliasedTags is an object type where keys are strings, and values are arrays of strings.
 */
interface AliasedTags {
  [key: string]: string[];
}

/**
 * Undocumented JSDoc tags.
 */
const jsdocTagsUndocumented: AliasedTags = {
  // Undocumented but present; see
  // https://github.com/jsdoc/jsdoc/issues/1283#issuecomment-516816802
  // https://github.com/jsdoc/jsdoc/blob/master/packages/jsdoc/lib/jsdoc/tag/dictionary/definitions.js#L594
  modifies: [],
};

/**
 * Documented JSDoc tags.
 */
const jsdocTags: AliasedTags = {
  ...jsdocTagsUndocumented,
  abstract: ["virtual"],
  access: [],
  alias: [],
  async: [],
  augments: ["extends"],
  author: [],
  borrows: [],
  callback: [],
  class: ["constructor"],
  classdesc: [],
  constant: ["const"],
  constructs: [],
  copyright: [],
  default: ["defaultvalue"],
  deprecated: [],
  description: ["desc"],
  enum: [],
  event: [],
  example: [],
  exports: [],
  external: ["host"],
  file: ["fileoverview", "overview"],
  fires: ["emits"],
  function: ["func", "method"],
  generator: [],
  global: [],
  hideconstructor: [],
  ignore: [],
  implements: [],
  inheritdoc: [],
  inheritDoc: [], // Allowing casing distinct from jsdoc `definitions.js` (required in Closure)
  inner: [],
  instance: [],
  interface: [],
  kind: [],
  lends: [],
  license: [],
  listens: [],
  member: ["var"],
  memberof: [],
  "memberof!": [],
  mixes: [],
  mixin: [],
  module: [],
  name: [],
  namespace: [],
  override: [],
  package: [],
  param: ["arg", "argument"],
  private: [],
  property: ["prop"],
  protected: [],
  public: [],
  readonly: [],
  requires: [],
  returns: ["return"],
  see: [],
  since: [],
  static: [],
  summary: [],
  this: [],
  throws: ["exception"],
  todo: [],
  tutorial: [],
  type: [],
  typedef: [],
  variation: [],
  version: [],
  yields: ["yield"],
};

/**
 * TypeScript-specific JSDoc tags.
 */
const typeScriptTags: AliasedTags = {
  ...jsdocTags,

  // https://github.com/microsoft/TypeScript/issues/22160
  // https://devblogs.microsoft.com/typescript/announcing-typescript-5-5/#the-jsdoc-import-tag
  import: [],

  // https://www.typescriptlang.org/tsconfig/#stripInternal
  internal: [],

  // https://devblogs.microsoft.com/typescript/announcing-typescript-5-0/#overload-support-in-jsdoc
  overload: [],

  // https://devblogs.microsoft.com/typescript/announcing-typescript-5-0/#satisfies-support-in-jsdoc
  satisfies: [],

  // `@template` is also in TypeScript per:
  //      https://www.typescriptlang.org/docs/handbook/type-checking-javascript-files.html#supported-jsdoc
  template: [],
};

/**
 * Closure-specific undocumented tags.
 */
const undocumentedClosureTags: AliasedTags = {
  // These are in Closure source but not in jsdoc source nor in the Closure
  //  docs: https://github.com/google/closure-compiler/blob/master/src/com/google/javascript/jscomp/parsing/Annotation.java
  closurePrimitive: [],
  customElement: [],
  expose: [],
  hidden: [],
  idGenerator: [],
  meaning: [],
  mixinClass: [],
  mixinFunction: [],
  ngInject: [],
  owner: [],
  typeSummary: [],
  wizaction: [],
};

const {
  /* eslint-disable no-unused-vars */
  inheritdoc,
  internal,
  overload,
  satisfies,

  // Will be inverted to prefer `return`
  returns,
  /* eslint-enable no-unused-vars */
  ...typeScriptTagsInClosure
} = typeScriptTags;

/**
 * Closure-specific documented tags.
 */
const closureTags: AliasedTags = {
  ...typeScriptTagsInClosure,
  ...undocumentedClosureTags,

  // From https://github.com/google/closure-compiler/wiki/Annotating-JavaScript-for-the-Closure-Compiler
  // These are all recognized in https://github.com/jsdoc/jsdoc/blob/master/packages/jsdoc/lib/jsdoc/tag/dictionary/definitions.js
  //   except for the experimental `noinline` and the casing differences noted below

  // Defined as a synonym of `const` in jsdoc `definitions.js`
  define: [],
  dict: [],
  export: [],
  externs: [],
  final: [],

  // With casing distinct from jsdoc `definitions.js`
  implicitCast: [],

  noalias: [],
  nocollapse: [],
  nocompile: [],
  noinline: [],
  nosideeffects: [],
  polymer: [],
  polymerBehavior: [],
  preserve: [],

  // Defined as a synonym of `interface` in jsdoc `definitions.js`
  record: [],

  return: ["returns"],
  struct: [],
  suppress: [],
  unrestricted: [],
};

export { closureTags, jsdocTags, typeScriptTags };
