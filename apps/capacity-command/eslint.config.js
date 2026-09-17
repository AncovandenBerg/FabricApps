import js from '@eslint/js';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    // `schema/` is the entity schema contract for a backend this repo does
    // not have: it is written against @microsoft/rayfin-core, which is not a
    // dependency here, and is never built or imported. See schema/README.md.
    ignores: ['dist', 'node_modules', 'schema'],
  },
  {
    files: ['**/*.{ts,tsx}'],
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    languageOptions: {
      ecmaVersion: 2022,
      globals: globals.browser,
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': [
        'warn',
        { allowConstantExport: true },
      ],
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },
  {
    // Build-time tooling runs under Node, not in the browser.
    files: ['scripts/**/*.ts', '*.config.ts'],
    languageOptions: {
      globals: globals.node,
    },
  }
);
