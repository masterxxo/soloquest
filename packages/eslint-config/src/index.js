import js from '@eslint/js';
import tseslint from 'typescript-eslint';

import soloquest from './plugin.js';

/**
 * Paths no package should ever lint. Kept here so every package inherits the same list
 * instead of drifting apart.
 */
export const ignores = [
  '**/node_modules/**',
  '**/dist/**',
  '**/.nuxt/**',
  '**/.output/**',
  '**/.turbo/**',
  '**/coverage/**',
  // Drizzle-generated SQL and its journal - machine output, never hand-edited.
  '**/migrations/**',

  // Localization files. i18n is not in the project yet, but once it lands the language
  // policy changes to "no Polish in code; Polish allowed only in locale files" - so these
  // paths are excluded up front and the first `pl.json` cannot break CI.
  //
  // Recommendation: keep locale files as JSON, not TS. ESLint does not lint JSON by
  // default, so the exception stops being an exception at all.
  '**/locales/**',
  '**/i18n/**',
  '**/lang/**',
];

/**
 * The house language policy: nothing but English gets committed. Split out from `base` so
 * the Nuxt app - which brings its own base config via `withNuxt()` - can apply just this
 * without double-registering the JS/TS plugins.
 */
export const languagePolicy = [
  {
    plugins: { soloquest },
    rules: {
      'soloquest/no-polish-characters': 'error',
    },
  },
];

/**
 * Base config for the plain TypeScript packages (api, db, shared).
 *
 * Deliberately minimal: `eslint:recommended` plus typescript-eslint `recommended` - not
 * `strict`, not `stylistic`. No formatting rules; this repo has no Prettier and no style
 * lint on purpose. The point of the linter here is correctness and policy, not taste.
 */
export const base = [
  { ignores },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  ...languagePolicy,
];

export default base;
