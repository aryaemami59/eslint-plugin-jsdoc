/**
 * Transform based on https://github.com/syavorsky/comment-parser/blob/master/src/transforms/align.ts
 *
 * It contains some customizations to align based on the tags, and some custom options.
 */

import { util } from 'comment-parser';
import { Integer } from './iterateJsdoc.js';
import { Line, Tokens, Spec, Problem, Block } from 'comment-parser';
import { CustomSpacings } from '../src/rules/checkLineAlignment.js';

type TypelessInfo = {
  hasNoTypes: boolean;
  maxNamedTagLength: Integer;
  maxUnnamedTagLength: Integer;
};

const { rewireSource } = util;

type Width = {
  name: Integer;
  start: Integer;
  tag: Integer;
  type: Integer;
};

const zeroWidth: Width = {
  name: 0,
  start: 0,
  tag: 0,
  type: 0,
};

const shouldAlign = (tags: string[], index: Integer, source: Line[]): boolean => {
  const tag = source[index].tokens.tag.replace('@', '');
  const includesTag = tags.includes(tag);

  if (includesTag) {
    return true;
  }

  if (tag !== '') {
    return false;
  }

  for (let iterator = index; iterator >= 0; iterator--) {
    const previousTag = source[iterator].tokens.tag.replace('@', '');

    if (previousTag !== '') {
      if (tags.includes(previousTag)) {
        return true;
      }

      return false;
    }
  }

  return true;
};

const getWidth = (
  tags: string[]
): ((width: Width, line: { tokens: Tokens }, index: Integer, source: Line[]) => Width) => {
  return (width, { tokens }, index, source) => {
    if (!shouldAlign(tags, index, source)) {
      return width;
    }

    return {
      name: Math.max(width.name, tokens.name.length),
      start: tokens.delimiter === '/**' ? tokens.start.length : width.start,
      tag: Math.max(width.tag, tokens.tag.length),
      type: Math.max(width.type, tokens.type.length),
    };
  };
};

const getTypelessInfo = (fields: {
  description: string;
  tags: Spec[];
  problems: Problem[];
}): TypelessInfo => {
  const hasNoTypes = fields.tags.every(({ type }) => !type);

  const maxNamedTagLength = Math.max(
    ...fields.tags.map(({ tag, name }) => (name.length === 0 ? -1 : tag.length)).filter((length) => length !== -1)
  ) + 1;

  const maxUnnamedTagLength = Math.max(
    ...fields.tags.map(({ tag, name }) => (name.length === 0 ? tag.length : -1)).filter((length) => length !== -1)
  ) + 1;

  return {
    hasNoTypes,
    maxNamedTagLength,
    maxUnnamedTagLength,
  };
};

const space = (len: Integer): string => {
  return ''.padStart(len, ' ');
};

const alignTransform = ({
  customSpacings,
  tags,
  indent,
  preserveMainDescriptionPostDelimiter,
  wrapIndent,
  disableWrapIndent,
}: {
  customSpacings: CustomSpacings;
  tags: string[];
  indent: string;
  preserveMainDescriptionPostDelimiter: boolean;
  wrapIndent: string;
  disableWrapIndent: boolean;
}): ((block: Block) => Block) => {
  let intoTags = false;
  let width: Width = { ...zeroWidth };

  const alignTokens = (tokens: Tokens, typelessInfo: TypelessInfo): Tokens => {
    const nothingAfter = {
      delim: false,
      name: false,
      tag: false,
      type: false,
    };

    if (tokens.description === '') {
      nothingAfter.name = true;
      tokens.postName = '';

      if (tokens.name === '') {
        nothingAfter.type = true;
        tokens.postType = '';

        if (tokens.type === '') {
          nothingAfter.tag = true;
          tokens.postTag = '';

          if (tokens.tag === '') {
            nothingAfter.delim = true;
          }
        }
      }
    }

    let untypedNameAdjustment = 0;
    let untypedTypeAdjustment = 0;

    if (typelessInfo.hasNoTypes) {
      nothingAfter.tag = true;
      tokens.postTag = '';

      if (tokens.name === '') {
        untypedNameAdjustment = typelessInfo.maxNamedTagLength - tokens.tag.length;
      } else {
        untypedNameAdjustment =
          typelessInfo.maxNamedTagLength > typelessInfo.maxUnnamedTagLength
            ? 0
            : Math.max(0, typelessInfo.maxUnnamedTagLength - (tokens.tag.length + tokens.name.length + 1));
        untypedTypeAdjustment = typelessInfo.maxNamedTagLength - tokens.tag.length;
      }
    }

    if (tokens.tag === '' && tokens.type) {
      return tokens;
    }

    const spacings = {
      postDelimiter: customSpacings?.postDelimiter || 1,
      postName: customSpacings?.postName || 1,
      postTag: customSpacings?.postTag || 1,
      postType: customSpacings?.postType || 1,
    };

    tokens.postDelimiter = nothingAfter.delim ? '' : space(spacings.postDelimiter);

    if (!nothingAfter.tag) {
      tokens.postTag = space(width.tag - tokens.tag.length + spacings.postTag);
    }

    if (!nothingAfter.type) {
      tokens.postType = space(width.type - tokens.type.length + spacings.postType + untypedTypeAdjustment);
    }

    if (!nothingAfter.name) {
      tokens.postName =
        width.name === 0 ? '' : space(width.name - tokens.name.length + spacings.postName + untypedNameAdjustment);
    }

    return tokens;
  };

  const update = (
    line: Line,
    index: Integer,
    source: Line[],
    typelessInfo: TypelessInfo,
    indentTag: string | false
  ): Line => {
    const tokens: Tokens = { ...line.tokens };

    if (tokens.tag !== '') {
      intoTags = true;
    }

    const isEmpty =
      tokens.tag === '' && tokens.name === '' && tokens.type === '' && tokens.description === '';

    if (tokens.end === '*/' && isEmpty) {
      tokens.start = indent + ' ';
      return { ...line, tokens };
    }

    switch (tokens.delimiter) {
      case '/**':
        tokens.start = indent;
        break;
      case '*':
        tokens.start = indent + ' ';
        break;
      default:
        tokens.delimiter = '';
        tokens.start = indent + '  ';
    }

    if (!intoTags) {
      if (tokens.description === '') {
        tokens.postDelimiter = '';
      } else if (!preserveMainDescriptionPostDelimiter) {
        tokens.postDelimiter = ' ';
      }

      return { ...line, tokens };
    }

    const postHyphenSpacing = customSpacings?.postHyphen ?? 1;
    const hyphenSpacing = /^\s*-\s+/u;

    tokens.description = tokens.description.replace(hyphenSpacing, '-' + ''.padStart(postHyphenSpacing, ' '));

    if (shouldAlign(tags, index, source)) {
      alignTokens(tokens, typelessInfo);
      if (!disableWrapIndent && indentTag) {
        tokens.postDelimiter += wrapIndent;
      }
    }

    return { ...line, tokens };
  };

  return ({ source, ...fields }) => {
    width = source.reduce(getWidth(tags), { ...zeroWidth });

    const typelessInfo = getTypelessInfo(fields);

    let tagIndentMode = false;

    return rewireSource({
      ...fields,
      source: source.map((line, index) => {
        const indentTag = !disableWrapIndent && tagIndentMode && !line.tokens.tag && line.tokens.description;
        const ret = update(line, index, source, typelessInfo, indentTag);

        if (!disableWrapIndent && line.tokens.tag) {
          tagIndentMode = true;
        }

        return ret;
      }),
    });
  };
};

export default alignTransform;
