// Metro-Konfiguration: Expo-Standard plus Ausnahmen fürs Bundle-Budget.
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// react-native-purchases lädt immer seine Browser-Variante (~1,7 MB) mit. Die brauchen nur
// Expo Go und das Web – nativ läuft das SDK über das native Modul. Im Web lädt die App das
// SDK gar nicht (src/lib/purchasesModule.web.ts).
const NATIVE_STUBS = new Set(['@revenuecat/purchases-js-hybrid-mappings']);

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (platform !== 'web' && NATIVE_STUBS.has(moduleName)) return { type: 'empty' };
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
