import js from '@eslint/js';
import globals from 'globals';
import prettier from 'eslint-config-prettier';

// Flat config (ESLint 9). Server is node, client is browser, tests pull in
// vitest globals via the imports in the test files themselves so we don't
// need a special override.
export default [
  {
    ignores: [
      'dist/**',
      'node_modules/**',
      'TRELLIS-main/**',
      '.runpod/**',
      'deploy/**',
      'coverage/**',
      'tools/**/*.py',
      'server/workers/**/*.py',
    ],
  },
  js.configs.recommended,
  {
    rules: {
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      'prefer-const': 'warn',
      'no-undef': 'error',
      'no-empty': ['warn', { allowEmptyCatch: true }],
    },
  },
  {
    files: ['server/**/*.js', 'tools/**/*.js', '*.config.js', 'handler.py'],
    languageOptions: {
      globals: { ...globals.node },
    },
  },
  {
    files: ['client/**/*.js'],
    languageOptions: {
      globals: { ...globals.browser },
    },
  },
  {
    files: ['tests/**/*.js'],
    languageOptions: {
      globals: { ...globals.node, ...globals.browser },
    },
  },
  prettier,
];
