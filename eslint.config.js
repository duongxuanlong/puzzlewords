// ESLint flat config. Cocos Creator 2.4 scripts are CommonJS modules compiled by Babel,
// so modern syntax is fine, but we keep the model layer strictly engine-free.
'use strict';

const js = require('@eslint/js');
const globals = require('globals');

const cocosGlobals = {
  cc: 'readonly',
  Editor: 'readonly',
  CC_EDITOR: 'readonly',
  CC_PREVIEW: 'readonly',
  CC_DEV: 'readonly',
  CC_DEBUG: 'readonly',
  CC_BUILD: 'readonly',
  CC_JSB: 'readonly',
  CC_RUNTIME: 'readonly',
  CC_TEST: 'readonly',
  CC_WECHATGAME: 'readonly',
};

const baseRules = {
  'no-var': 'error',
  'prefer-const': 'error',
  eqeqeq: ['error', 'always'],
  curly: ['error', 'all'],
  'no-unused-vars': ['error', { argsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' }],
  'no-console': 'off',
};

module.exports = [
  {
    ignores: ['library/**', 'temp/**', 'local/**', 'build/**', 'node_modules/**', 'packages/**', 'preview-templates/**'],
  },
  js.configs.recommended,
  {
    files: ['assets/scripts/**/*.js'],
    languageOptions: {
      ecmaVersion: 2018,
      sourceType: 'commonjs',
      globals: { ...globals.browser, ...cocosGlobals },
    },
    rules: baseRules,
  },
  {
    // Model, data and systems must never touch the engine. Tested in plain Node.
    files: ['assets/scripts/model/**/*.js', 'assets/scripts/data/**/*.js', 'assets/scripts/systems/**/*.js'],
    rules: {
      'no-restricted-globals': ['error', { name: 'cc', message: 'Model layer is engine-free.' }, 'window', 'document'],
    },
  },
  {
    files: ['tests/**/*.js', 'tools/**/*.js', 'eslint.config.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'commonjs',
      globals: { ...globals.node },
    },
    rules: baseRules,
  },
];
