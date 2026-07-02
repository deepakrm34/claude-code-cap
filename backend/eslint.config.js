// ESLint 9 flat config for the backend.
// CommonJS module because package.json declares "type": "commonjs".
// Type-aware linting via typescript-eslint, tied to the strict tsconfig.json.

const tsParser = require('@typescript-eslint/parser');
const tsPlugin = require('@typescript-eslint/eslint-plugin');

module.exports = [
  // Never lint build output or dependencies.
  { ignores: ['dist/**', 'node_modules/**'] },

  {
    files: ['src/**/*.ts'],
    languageOptions: {
      parser: tsParser,
      ecmaVersion: 2020, // matches tsconfig target/lib ES2020
      sourceType: 'module',
      parserOptions: {
        // Type-aware rules need the TS program; point at the strict config.
        project: './tsconfig.json',
        tsconfigRootDir: __dirname,
      },
    },
    plugins: {
      '@typescript-eslint': tsPlugin,
    },
    rules: {
      // Strict, type-checked rule set — the ESLint counterpart to the strict
      // tsconfig. `strict-type-checked` layers on top of `recommended-type-checked`,
      // so both are spread (the plugin's flat rules are exposed via .configs[...].rules).
      ...tsPlugin.configs['recommended-type-checked'].rules,
      ...tsPlugin.configs['strict-type-checked'].rules,

      // Align with tsconfig's noUnusedLocals / noUnusedParameters, keeping the
      // underscore-prefix escape hatch the codebase already uses (e.g. _req, _next).
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          args: 'all',
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
    },
  },
];
