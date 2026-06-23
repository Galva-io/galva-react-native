// ESLint flat config (ESLint 9). typescript-eslint for type-aware-ready linting,
// react-hooks rules for the provider/hooks, prettier last to disable conflicts.
import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import reactHooks from 'eslint-plugin-react-hooks';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: [
      'lib/',
      'node_modules/',
      'example/',
      'examples-compat/',
      'plugin/build/',
      'ios/',
      'android/',
      'coverage/',
      'scripts/', // Node build tooling — verified by running, not linting.
      'in-app-message.js', // generated subpath shims (re-export from lib/)
      'react.js',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    plugins: { 'react-hooks': reactHooks },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
    },
  },
  prettier
);
