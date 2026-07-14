/**
 * Everything committed to this repository is English: code, comments, identifiers and UI
 * copy. This rule enforces that by looking for Polish diacritics.
 *
 * It deliberately does NOT ban non-ASCII. The UI leans on emoji and typography
 * (flames, middle dots, check marks, em dashes), so a blanket non-ASCII ban would fire on
 * our own design and rot into a forest of eslint-disable comments. Matching the nine
 * Polish diacritics instead catches real Polish with no false positives.
 *
 * Accepted limitation: Polish typed without diacritics is not caught.
 */

// The nine Polish diacritics in both cases, written as escapes so this file does not trip
// its own rule: a-ogonek, c-acute, e-ogonek, l-stroke, n-acute, o-acute, s-acute, z-acute,
// z-dot.
const POLISH_CHARACTERS =
  /[\u0105\u0107\u0119\u0142\u0144\u00F3\u015B\u017A\u017C\u0104\u0106\u0118\u0141\u0143\u00D3\u015A\u0179\u017B]/gu;

const COMMENT = 'a comment';
const STRING = 'a string literal';
const TEMPLATE = 'a template literal';
const IDENTIFIER = 'an identifier';
const SOURCE = 'the source';

/** @type {import('eslint').Rule.RuleModule} */
export default {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Disallow Polish diacritics in comments, string literals and identifiers - the repository is English-only.',
    },
    schema: [],
    messages: {
      polishCharacter:
        'Polish character "{{character}}" found in {{location}}. Polish characters are not allowed in the repository - use English.',
    },
  },

  create(context) {
    const sourceCode = context.sourceCode;

    // Find every offending offset up front, straight from the source text. The visitors
    // below only label those offsets with a friendlier location name; anything they never
    // reach - most importantly a Vue `<template>` block and its comments, which are absent
    // from the script AST - is still reported. That is what keeps the rule blind-spot free.
    const offenders = new Map();
    for (const match of sourceCode.text.matchAll(POLISH_CHARACTERS)) {
      offenders.set(match.index, { character: match[0], location: SOURCE });
    }

    if (offenders.size === 0) return {};

    /** Name the offenders that fall inside `[start, end)`, first label wins. */
    function label(start, end, location) {
      for (const [index, offender] of offenders) {
        if (index >= start && index < end && offender.location === SOURCE) {
          offender.location = location;
        }
      }
    }

    return {
      Program() {
        // Comments live outside the AST, so no generic rule (`no-restricted-syntax` and
        // friends) can see them - they have to be walked explicitly.
        for (const comment of sourceCode.getAllComments()) {
          label(comment.range[0], comment.range[1], COMMENT);
        }
      },

      Literal(node) {
        if (typeof node.value === 'string') label(node.range[0], node.range[1], STRING);
      },

      TemplateElement(node) {
        label(node.range[0], node.range[1], TEMPLATE);
      },

      Identifier(node) {
        label(node.range[0], node.range[1], IDENTIFIER);
      },

      PrivateIdentifier(node) {
        label(node.range[0], node.range[1], IDENTIFIER);
      },

      'Program:exit'() {
        for (const [index, { character, location }] of offenders) {
          context.report({
            loc: {
              start: sourceCode.getLocFromIndex(index),
              end: sourceCode.getLocFromIndex(index + 1),
            },
            messageId: 'polishCharacter',
            data: { character, location },
          });
        }
      },
    };
  },
};
