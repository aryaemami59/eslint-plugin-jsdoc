import { findJSDocComment } from "@es-joy/jsdoccomment";
import debugModule from "debug";
import { Rule, SourceCode } from "eslint";
import {
  ClassDeclaration,
  Node as ESTreeNode,
  Identifier,
  MemberExpression,
  MethodDefinition,
  PrivateIdentifier,
} from "estree";
import { RequireJsdocOpts, Settings } from "./rules/requireJsdoc";

const debug = debugModule("requireExportJsdoc");

type ValueObject = {
  value: string;
};

type CreatedNode = {
  type?: string;
  value?: ValueObject | ESTreeNode;
  props: { [key: string]: CreatedNode | null };
  special?: true;
  globalVars?: CreatedNode;
  exported?: boolean;
  ANONYMOUS_DEFAULT?: ESTreeNode;
};

type SymbolOptions = {
  simpleIdentifier?: boolean;
};

type CreateSymbol = (
  node: ESTreeNode | null,
  globals: CreatedNode,
  value: ESTreeNode | null,
  scope?: CreatedNode,
  isGlobal?: boolean | SymbolOptions,
) => CreatedNode | null;

const createNode = (): CreatedNode => ({
  props: {},
});

const getSymbolValue = (symbol: CreatedNode | null): string | null => {
  if (!symbol) return null;
  if (symbol.type === "literal") return (symbol.value as ValueObject).value;
  return null;
};

const getIdentifier = (
  node: Identifier,
  globals: CreatedNode,
  scope: CreatedNode,
  opts: SymbolOptions,
): CreatedNode | null => {
  if (opts.simpleIdentifier) {
    const identifierLiteral = createNode();
    identifierLiteral.type = "literal";
    identifierLiteral.value = { value: node.name };
    return identifierLiteral;
  }

  const block = scope || globals;

  if (block.props[node.name]) {
    return block.props[node.name];
  }

  if (globals.props[node.name]) {
    return globals.props[node.name];
  }

  return null;
};

let createSymbol: CreateSymbol; // eslint-disable-line prefer-const

const getSymbol = (
  node: ESTreeNode,
  globals: CreatedNode,
  scope: CreatedNode,
  opt?: SymbolOptions,
): CreatedNode | null => {
  const opts = opt || {};
  switch (node.type) {
    case "Identifier":
      return getIdentifier(node as Identifier, globals, scope, opts);

    case "MemberExpression": {
      const obj = getSymbol(
        (node as MemberExpression).object as ESTreeNode,
        globals,
        scope,
        opts,
      );
      const propertySymbol = getSymbol(
        (node as MemberExpression).property as ESTreeNode,
        globals,
        scope,
        { simpleIdentifier: !(node as MemberExpression).computed },
      );
      const propertyValue = getSymbolValue(propertySymbol);
      if (obj && propertyValue && obj.props[propertyValue]) {
        return obj.props[propertyValue];
      }
      debug(
        `MemberExpression: Missing property ${(node as PrivateIdentifier).name}`,
      );
      return null;
    }

    case "ClassExpression": {
      return getSymbol((node as ClassDeclaration).body, globals, scope, opts);
    }

    case "ClassDeclaration": {
      const val = createNode();
      val.props.prototype = createNode();
      val.props.prototype.type = "object";
      val.type = "object";
      val.value = node;
      return val;
    }

    case "AssignmentExpression": {
      return createSymbol(
        (node as Rule.Node).left,
        globals,
        (node as Rule.Node).right,
        scope,
        opts,
      );
    }

    case "ClassBody": {
      const val = createNode();
      for (const method of (node as Rule.ClassBody).body) {
        const methodKey = (method as MethodDefinition).key as Identifier;
        val.props[methodKey.name] = createNode();
        val.props[methodKey.name]!.type = "object";
        val.props[methodKey.name]!.value = (method as MethodDefinition)
          .value as Rule.Node;
      }
      val.type = "object";
      val.value = node.parent;
      return val;
    }

    case "ObjectExpression": {
      const val = createNode();
      val.type = "object";
      for (const prop of (node as Rule.ObjectExpression).properties) {
        if (["SpreadElement", "ExperimentalSpreadProperty"].includes(prop.type))
          continue;
        const propVal = getSymbol(
          (prop as Rule.Property).value as ESTreeNode,
          globals,
          scope,
          opts,
        );
        if (propVal) {
          const propKey = (prop as Rule.Property).key as PrivateIdentifier;
          val.props[propKey.name] = propVal;
        }
      }
      return val;
    }

    case "Literal": {
      const val = createNode();
      val.type = "literal";
      val.value = node;
      return val;
    }

    default:
      return null;
  }
};

const createBlockSymbol = (
  block: CreatedNode,
  name: string,
  value: CreatedNode | null,
  globals: CreatedNode,
  isGlobal: boolean | SymbolOptions | undefined,
): void => {
  block.props[name] = value;
  if (isGlobal && globals.props.window && globals.props.window.special) {
    globals.props.window.props[name] = value;
  }
};

createSymbol = (node, globals, value, scope, isGlobal) => {
  const block = scope || globals;
  if (!node) return null;

  let symbol: CreatedNode | null = null;
  switch (node.type) {
    case "FunctionDeclaration":
    case "ClassDeclaration":
    case "TSEnumDeclaration":
    case "TSInterfaceDeclaration": {
      const nde = node as ClassDeclaration;
      if (nde.id && nde.id.type === "Identifier") {
        return createSymbol(nde.id, globals, node, globals);
      }
      break;
    }

    case "Identifier": {
      const nde = node as Identifier;
      if (value) {
        const valueSymbol = getSymbol(value, globals, block);
        if (valueSymbol) {
          createBlockSymbol(block, nde.name, valueSymbol, globals, isGlobal);
          return block.props[nde.name];
        }
        debug("Identifier: Missing value symbol for %s", nde.name);
      } else {
        createBlockSymbol(block, nde.name, createNode(), globals, isGlobal);
        return block.props[nde.name];
      }
      break;
    }

    case "MemberExpression": {
      const nde = node as MemberExpression;
      symbol = getSymbol(nde.object as ESTreeNode, globals, block);
      const propertySymbol = getSymbol(
        nde.property as ESTreeNode,
        globals,
        block,
        { simpleIdentifier: !nde.computed },
      );
      const propertyValue = getSymbolValue(propertySymbol);
      if (symbol && propertyValue) {
        createBlockSymbol(
          symbol,
          propertyValue,
          getSymbol(value!, globals, block),
          globals,
          isGlobal,
        );
        return symbol.props[propertyValue];
      }
      debug(
        "MemberExpression: Missing symbol: %s",
        (nde.property as PrivateIdentifier).name,
      );
      break;
    }
  }

  return null;
};

const initVariables = (
  node: ESTreeNode,
  globals: CreatedNode,
  opts: RequireJsdocOpts,
): void => {
  switch (node.type) {
    case "Program": {
      for (const childNode of (node as Rule.Program).body) {
        initVariables(childNode as ESTreeNode, globals, opts);
      }
      break;
    }

    case "ExpressionStatement": {
      initVariables(
        (node as Rule.ExpressionStatement).expression,
        globals,
        opts,
      );
      break;
    }

    case "VariableDeclaration": {
      for (const declaration of (node as Rule.VariableDeclaration)
        .declarations) {
        const symbol = createSymbol(
          declaration.id as ESTreeNode,
          globals,
          null,
          globals,
        );
        if (opts.initWindow && node.kind === "var" && globals.props.window) {
          globals.props.window.props[(declaration.id as Identifier).name] =
            symbol;
        }
      }
      break;
    }

    case "ExportNamedDeclaration": {
      if ((node as Rule.ExportNamedDeclaration).declaration) {
        initVariables(
          (node as Rule.ExportNamedDeclaration).declaration!,
          globals,
          opts,
        );
      }
      break;
    }
  }
};

const mapVariables = (
  node: ESTreeNode,
  globals: CreatedNode,
  opt: RequireJsdocOpts,
  isExport?: true,
): boolean => {
  const opts = opt || {};
  switch (node.type) {
    case "Program": {
      if (opts.ancestorsOnly) return false;
      for (const childNode of (node as Rule.Program).body) {
        mapVariables(childNode as ESTreeNode, globals, opts);
      }
      break;
    }

    case "ExpressionStatement": {
      mapVariables(
        (node as Rule.ExpressionStatement).expression,
        globals,
        opts,
      );
      break;
    }

    case "AssignmentExpression": {
      createSymbol(
        (node as Rule.AssignmentExpression).left,
        globals,
        (node as Rule.AssignmentExpression).right,
      );
      break;
    }

    case "VariableDeclaration": {
      for (const declaration of (node as Rule.VariableDeclaration)
        .declarations) {
        const isGlobal = !!(
          opts.initWindow &&
          node.kind === "var" &&
          globals.props.window
        );
        const symbol = createSymbol(
          declaration.id as ESTreeNode,
          globals,
          declaration.init as ESTreeNode,
          globals,
          isGlobal,
        );
        if (symbol && isExport) {
          symbol.exported = true;
        }
      }
      break;
    }

    case "FunctionDeclaration": {
      if ((node as Identifier).type === "Identifier") {
        createSymbol(node as ESTreeNode, globals, node, globals, true);
      }
      break;
    }

    case "ExportDefaultDeclaration": {
      const symbol = createSymbol(
        (node as Rule.ExportDefaultDeclaration).declaration as ESTreeNode,
        globals,
        node as ESTreeNode,
      );
      if (symbol) {
        symbol.exported = true;
      } else {
        globals.ANONYMOUS_DEFAULT = (node as Rule.ExportDefaultDeclaration)
          .declaration as ESTreeNode;
      }
      break;
    }

    case "ExportNamedDeclaration": {
      if ((node as Rule.ExportNamedDeclaration).declaration) {
        if (
          (node as Rule.ExportNamedDeclaration).declaration!.type ===
          "VariableDeclaration"
        ) {
          mapVariables(
            (node as Rule.ExportNamedDeclaration).declaration!,
            globals,
            opts,
            true,
          );
        } else {
          const symbol = createSymbol(
            (node as Rule.ExportNamedDeclaration).declaration!,
            globals,
            (node as Rule.ExportNamedDeclaration).declaration!,
          );
          if (symbol) symbol.exported = true;
        }
      }
      for (const specifier of (node as Rule.ExportNamedDeclaration)
        .specifiers) {
        mapVariables(specifier as ESTreeNode, globals, opts);
      }
      break;
    }

    case "ExportSpecifier": {
      const symbol = getSymbol(
        (node as Rule.ExportSpecifier).local as ESTreeNode,
        globals,
        globals,
      );
      if (symbol) symbol.exported = true;
      break;
    }

    case "ClassDeclaration": {
      createSymbol(
        (node as Rule.ClassDeclaration).id as ESTreeNode,
        globals,
        (node as Rule.ClassDeclaration).body as ESTreeNode,
        globals,
      );
      break;
    }

    default:
      return false;
  }

  return true;
};

const findNode = (
  node: ESTreeNode,
  block: CreatedNode | ValueObject | string | undefined | ESTreeNode,
  cache?: (CreatedNode | ValueObject | string | ESTreeNode)[],
): boolean => {
  let blockCache = cache || [];
  if (!block || blockCache.includes(block)) return false;

  blockCache = [...blockCache, block];

  if (
    typeof block === "object" &&
    "type" in block &&
    (block.type === "object" || block.type === "MethodDefinition") &&
    block.value === node
  ) {
    return true;
  }

  if (typeof block !== "object") return false;

  const props =
    ("props" in block && block.props) || ("body" in block && block.body);
  for (const propval of Object.values(props || {})) {
    if (Array.isArray(propval)) {
      if (propval.some((val) => findNode(node, val, blockCache))) return true;
    } else if (findNode(node, propval, blockCache)) {
      return true;
    }
  }

  return false;
};

const getExportAncestor = (nde: ESTreeNode): ESTreeNode | false => {
  let node = nde;
  let idx = 0;
  const ignorableIfDeep = ignorableNestedTypes.has(nde?.type);
  while (node) {
    if (idx >= 2 && ignorableIfDeep) break;
    if (exportTypes.has(node.type)) return node;
    node = node.parent!;
    idx++;
  }
  return false;
};

const isExportByAncestor = (nde: ESTreeNode): ESTreeNode | false => {
  if (!canBeExportedByAncestorType.has(nde.type)) return false;
  let node = nde.parent!;
  while (node) {
    if (exportTypes.has(node.type)) return node;
    if (!canExportChildrenType.has(node.type)) return false;
    node = node.parent!;
  }
  return false;
};

const isNodeExported = (
  node: ESTreeNode,
  globals: CreatedNode,
  opt: RequireJsdocOpts,
): boolean => {
  const moduleExports = globals.props.module?.props?.exports;
  if (opt.initModuleExports && moduleExports && findNode(node, moduleExports))
    return true;
  if (
    opt.initWindow &&
    globals.props.window &&
    findNode(node, globals.props.window)
  )
    return true;
  if (opt.esm && findExportedNode(globals, node)) return true;
  return false;
};

const findExportedNode = (
  block: CreatedNode,
  node: ESTreeNode,
  cache?: CreatedNode[],
): boolean => {
  if (block === null) return false;
  const blockCache = cache || [];
  const { props } = block;
  for (const propval of Object.values(props)) {
    const pval = propval as CreatedNode;
    blockCache.push(pval);
    if (pval.exported && (node === pval.value || findNode(node, pval.value))) {
      return true;
    }
  }
  return false;
};

const parseRecursive = (
  node: ESTreeNode,
  globalVars: CreatedNode,
  opts: RequireJsdocOpts,
): boolean => {
  if (node.parent && parseRecursive(node.parent, globalVars, opts)) return true;
  return mapVariables(node, globalVars, opts);
};

const parse = (
  ast: ESTreeNode,
  node: ESTreeNode,
  opt: RequireJsdocOpts,
): CreatedNode => {
  const opts = opt || {
    ancestorsOnly: false,
    esm: true,
    initModuleExports: true,
    initWindow: true,
  };

  const globalVars = createNode();
  if (opts.initModuleExports) {
    globalVars.props.module = createNode();
    globalVars.props.module.props.exports = createNode();
    globalVars.props.exports = globalVars.props.module.props.exports;
  }

  if (opts.initWindow) {
    globalVars.props.window = createNode();
    globalVars.props.window.special = true;
  }

  if (opts.ancestorsOnly) {
    parseRecursive(node, globalVars, opts);
  } else {
    initVariables(ast, globalVars, opts);
    mapVariables(ast, globalVars, opts);
  }

  return { globalVars, props: {} };
};

const isPrivate = (node: ESTreeNode): boolean => {
  return (
    accessibilityNodes.has(node.type) &&
    (("accessibility" in node &&
      node.accessibility !== "public" &&
      node.accessibility !== undefined) ||
      ("key" in node && node.key.type === "PrivateIdentifier"))
  );
};

const isUncommentedExport = (
  node: ESTreeNode,
  sourceCode: SourceCode,
  opt: RequireJsdocOpts,
  settings: Settings,
): boolean => {
  if (opt.esm) {
    if (isPrivate(node) || (node.parent && isPrivate(node.parent!))) {
      return false;
    }

    const exportNode = getExportAncestor(node);
    if (exportNode && !findJSDocComment(exportNode, sourceCode, settings)) {
      return true;
    }

    if (
      isExportByAncestor(node) &&
      !findJSDocComment(node, sourceCode, settings)
    ) {
      return true;
    }
  }

  const parseResult = parse(sourceCode.ast as ESTreeNode, node, opt);
  return isNodeExported(node, parseResult.globalVars as CreatedNode, opt);
};

export default {
  isUncommentedExport,
  parse,
};
