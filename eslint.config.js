import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import globals from 'globals';
import prettier from 'eslint-config-prettier';

export default tseslint.config(
  // store/src: one-off scripts that render the Web Store images (need playwright-core, not shipped).
  { ignores: ['dist', 'node_modules', 'coverage', '.husky', 'public', 'store/src'] },
  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: { allowDefaultProject: ['eslint.config.js', 'scripts/*.mjs'] },
        tsconfigRootDir: import.meta.dirname,
      },
      globals: { ...globals.browser, chrome: 'readonly' },
    },
    rules: {
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      eqeqeq: ['error', 'always'],
      'no-console': ['warn', { allow: ['warn', 'error'] }],
    },
  },
  // Architecture rule 1: core logic stays pure (no browser or extension APIs) so it is unit-testable.
  {
    files: ['src/shared/**', 'src/scan/**', 'src/ml/**', 'src/suggest/**'],
    rules: {
      'no-restricted-globals': [
        'error',
        { name: 'chrome', message: 'Core logic must not touch extension APIs. Inject them.' },
        { name: 'document', message: 'Core logic must not touch the DOM. Use src/source.' },
        { name: 'window', message: 'Core logic must not touch the DOM. Use src/source.' },
        { name: 'location', message: 'Core logic must not touch the DOM. Use src/source.' },
      ],
    },
  },
  // Architecture rule 2: only the content script may use the Google Photos page module.
  {
    files: [
      'src/ui/**',
      'src/background/**',
      'src/scan/**',
      'src/ml/**',
      'src/suggest/**',
      'src/store/**',
    ],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/source/*', '**/content/*'],
              message: 'Only src/content may use the page module.',
            },
          ],
        },
      ],
    },
  },
  {
    files: [
      '*.config.ts',
      '*.config.js',
      'eslint.config.js',
      'tests/**',
      'tests-model/**',
      'scripts/**',
    ],
    languageOptions: { globals: { ...globals.node } },
  },
  { files: ['eslint.config.js', 'scripts/**'], ...tseslint.configs.disableTypeChecked },
  { files: ['tests-model/**', 'scripts/**'], rules: { 'no-console': 'off' } },
  prettier,
);
