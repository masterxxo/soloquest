import noPolishCharacters from './rules/no-polish-characters.js';

/**
 * Local ESLint plugin holding the repository's own rules. Kept in-repo rather than
 * published: it encodes house policy, so there is nothing to share outside the monorepo.
 */
export default {
  meta: { name: '@soloquest/eslint-config', version: '0.0.0' },
  rules: {
    'no-polish-characters': noPolishCharacters,
  },
};
