/** @type {import('jest').Config} */
module.exports = {
  preset: 'jest-expo',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  // Reanimated 4 / Worklets: Nicht-native Implementierung in Jest verwenden
  resolver: 'react-native-worklets/jest/resolver.js',
  testPathIgnorePatterns: ['/node_modules/', '/supabase/', '/dashboard/', '/.maestro/'],
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@sentry/react-native|native-base|react-native-svg|lucide-react-native|@shopify/flash-list|@gorhom/.*|@maplibre/.*|@date-fns/.*|date-fns))',
  ],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    // marked ist ESM-only → UMD-Build für Jest (Webseiten-Generator)
    '^marked$': '<rootDir>/node_modules/marked/lib/marked.umd.js',
    // ESM-Build (.mjs) von Lucide → CommonJS-Build für Jest
    '^lucide-react-native$':
      '<rootDir>/node_modules/lucide-react-native/dist/cjs/lucide-react-native.js',
    '^lucide-react-native/icons/(.*)$':
      '<rootDir>/node_modules/lucide-react-native/dist/cjs/icons/$1.js',
  },
  collectCoverageFrom: ['src/**/*.{ts,tsx}', '!src/**/*.d.ts', '!src/app/**'],
};
