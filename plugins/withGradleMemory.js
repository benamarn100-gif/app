// Android-Build: Gradle bekommt mehr Speicher als die Vorlage (2 GB Heap, 512 MB Metaspace).
// Mit Reanimated, MapLibre, Sentry und den Expo-Modulen bricht Android-Lint (lintVitalAnalyzeRelease)
// sonst mit „OutOfMemoryError: Metaspace“ ab – lokal, auf GitHub und auf EAS.
const { withGradleProperties } = require('expo/config-plugins');

const JVM_ARGS =
  '-Xmx4g -XX:MaxMetaspaceSize=1g -XX:+HeapDumpOnOutOfMemoryError -Dfile.encoding=UTF-8';

module.exports = function withGradleMemory(config) {
  return withGradleProperties(config, (cfg) => {
    const existing = cfg.modResults.find(
      (item) => item.type === 'property' && item.key === 'org.gradle.jvmargs',
    );
    if (existing) existing.value = JVM_ARGS;
    else cfg.modResults.push({ type: 'property', key: 'org.gradle.jvmargs', value: JVM_ARGS });
    return cfg;
  });
};
