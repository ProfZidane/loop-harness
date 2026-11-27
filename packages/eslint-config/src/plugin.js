import { findEmoji } from './emoji.js';

const TODO_WITHOUT_ISSUE = /\b(TODO|FIXME|XXX)\b(?!\(#\d+\))/;

const noEmoji = {
  meta: {
    type: 'problem',
    docs: { description: 'Disallow emoji anywhere in source files' },
    schema: [],
    messages: { emoji: 'Emoji are forbidden: remove "{{char}}".' },
  },
  create: (context) => ({
    Program: () => {
      const { sourceCode } = context;
      findEmoji(sourceCode.text).forEach(({ index, char }) =>
        context.report({ loc: sourceCode.getLocFromIndex(index), messageId: 'emoji', data: { char } }),
      );
    },
  }),
};

const todoRequiresIssue = {
  meta: {
    type: 'suggestion',
    docs: { description: 'Require TODO, FIXME and XXX comments to reference an issue: TODO(#42)' },
    schema: [],
    messages: { missingIssue: 'Reference an issue: TODO(#<number>).' },
  },
  create: (context) => ({
    Program: () => {
      context.sourceCode
        .getAllComments()
        .filter((comment) => TODO_WITHOUT_ISSUE.test(comment.value))
        .forEach((comment) => context.report({ loc: comment.loc, messageId: 'missingIssue' }));
    },
  }),
};

export const loopPlugin = {
  meta: { name: '@loop-harness/eslint-plugin' },
  rules: { 'no-emoji': noEmoji, 'todo-requires-issue': todoRequiresIssue },
};
