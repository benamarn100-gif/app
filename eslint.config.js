// ESLint (Flat Config). Erzwingt: keine hartkodierten Farben/Texte außerhalb von
// Tokens und i18n-Dateien, saubere Schichtgrenzen (docs/architecture.md §3.1).
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');
const prettier = require('eslint-config-prettier');
const i18next = require('eslint-plugin-i18next');

const COLOR_LITERAL = String.raw`/^(#([0-9a-fA-F]{3}){1,2}([0-9a-fA-F]{2})?|rgba?\(.*\)|hsla?\(.*\))$/`;

module.exports = defineConfig([
  expoConfig,
  prettier,
  {
    ignores: [
      'dist/*',
      '.expo/*',
      'android/*',
      'ios/*',
      'supabase/functions/*',
      'dashboard/*',
      'node_modules/*',
      'coverage/*',
    ],
  },
  {
    files: ['src/**/*.{ts,tsx}'],
    plugins: { i18next },
    rules: {
      // Keine Texte direkt im JSX – alles über src/i18n/locales/*.json
      'i18next/no-literal-string': [
        'error',
        {
          mode: 'jsx-text-only',
          'jsx-attributes': {
            include: ['label', 'title', 'placeholder', 'accessibilityLabel', 'accessibilityHint'],
          },
        },
      ],
      // Keine Farb-Literale außerhalb der Design-Tokens
      'no-restricted-syntax': [
        'error',
        {
          selector: `Literal[value=${COLOR_LITERAL}]`,
          message: 'Farben nur über Design-Tokens (src/design/tokens.ts) verwenden.',
        },
      ],
    },
  },
  {
    files: ['src/design/**', 'src/components/Illustrations.tsx', 'scripts/**'],
    rules: { 'no-restricted-syntax': 'off' },
  },
  {
    files: ['src/domain/**/*.ts'],
    ignores: ['src/domain/**/__tests__/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: [
                'react',
                'react-native',
                'expo*',
                '@/components/*',
                '@/features/*',
                '@/data/*',
              ],
              message: 'src/domain bleibt reines TypeScript.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['src/components/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@/features/*'],
              message: 'Design-System-Komponenten kennen keine Features.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['**/__tests__/**', '**/*.test.{ts,tsx}', 'jest.setup.ts', 'src/features/showcase/**'],
    rules: { 'i18next/no-literal-string': 'off' },
  },
]);
