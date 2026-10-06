/**
 * Bundle-Budget: misst die exportierten JS-Bundles (Web: minifiziertes JS,
 * Android: Hermes-Bytecode) und bricht ab, wenn ein Budget überschritten wird.
 *
 *   npx expo export --platform web --platform android --output-dir dist
 *   npm run check:bundle            # liest ./dist, schreibt bundle-size.txt
 *
 * Budgets bewusst knapp über dem Stand vom 06.10.2026 (Web 5,1 MB, Android 8,5 MB):
 * Wächst das Bundle, ist das eine bewusste Entscheidung mit Anpassung hier.
 */
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';

const BUDGET_BYTES: Record<string, number> = {
  web: 5_600_000,
  android: 9_300_000,
  ios: 9_300_000,
};

const dist = process.argv[2] ?? 'dist';
const root = join(dist, '_expo', 'static', 'js');
if (!existsSync(root)) {
  console.error(`Kein Export gefunden unter ${root} – zuerst \`npx expo export\` ausführen.`);
  process.exit(1);
}

const mb = (n: number) => `${(n / 1_000_000).toFixed(2)} MB`;
const lines: string[] = [];
let failed = false;

for (const platform of readdirSync(root)) {
  const dir = join(root, platform);
  const files = readdirSync(dir).filter((f) => /\.(js|hbc)$/.test(f));
  const bytes = files.reduce((sum, f) => sum + statSync(join(dir, f)).size, 0);
  const gzip = files.reduce((sum, f) => sum + gzipSync(readFileSync(join(dir, f))).length, 0);
  const budget = BUDGET_BYTES[platform];
  const over = budget !== undefined && bytes > budget;
  failed ||= over;
  lines.push(
    `${platform.padEnd(8)} ${mb(bytes).padStart(9)}  (gzip ${mb(gzip)})  Budget ${budget ? mb(budget) : '–'}  ${over ? '✗ ÜBERSCHRITTEN' : '✓'}`,
  );
}

const report = lines.join('\n');
console.log(report);
writeFileSync('bundle-size.txt', `${report}\n`);
if (failed) {
  console.error(
    '\nBundle-Budget überschritten. Ursache prüfen (z. B. Barrel-Importe), dann ggf. Budget anpassen.',
  );
  process.exit(1);
}
