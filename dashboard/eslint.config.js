// Dashboard-Lint: TypeScript, React-Hooks (inkl. React-Compiler-Regeln), keine Texte im
// JSX (alles über src/i18n) und keine Farbwerte außerhalb der Design-Tokens.
import js from '@eslint/js';
import i18next from 'eslint-plugin-i18next';
import reactHooks from 'eslint-plugin-react-hooks';
import { defineConfig } from 'eslint/config';
import globals from 'globals';
import tseslint from 'typescript-eslint';

const COLOR_LITERAL = String.raw`/^(#([0-9a-fA-F]{3}){1,2}([0-9a-fA-F]{2})?|rgba?\(.*\)|hsla?\(.*\))$/`;

export default defineConfig([
  { ignores: ['dist/**', 'node_modules/**', 'coverage/**'] },
  js.configs.recommended,
  tseslint.configs.recommended,
  reactHooks.configs.flat.recommended,
  {
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
  },
  {
    files: ['src/**/*.{ts,tsx}'],
    plugins: { i18next },
    rules: {
      'i18next/no-literal-string': [
        'error',
        {
          mode: 'jsx-text-only',
          'jsx-attributes': { include: ['label', 'title', 'placeholder', 'aria-label', 'alt'] },
        },
      ],
      'no-restricted-syntax': [
        'error',
        {
          selector: `Literal[value=${COLOR_LITERAL}]`,
          message: 'Farben nur über Design-Tokens (CSS-Variablen --color-*).',
        },
      ],
    },
  },
  {
    files: ['src/**/__tests__/**', 'src/test/**'],
    rules: { 'i18next/no-literal-string': 'off' },
  },
]);
