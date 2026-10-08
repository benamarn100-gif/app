/**
 * Baut die kleine öffentliche Webseite (Startseite, Datenschutz, Nutzungsbedingungen, Impressum)
 * aus docs/legal/*.md. Die Stores verlangen eine Datenschutz-URL; Apple/Google verlinken darauf.
 *
 *   npx tsx scripts/build-website.ts [Ausgabeordner]   (Standard: dist-website)
 *
 * Umgebungsvariablen (optional): SUPPORT_EMAIL; DASHBOARD_DIST + SUPABASE_URL kopieren das gebaute
 * Praxis-Dashboard nach /praxis/ und legen dort passende Sicherheits-Header ab.
 * Platzhalter `[PLATZHALTER: …]` werden gelb markiert, „ENTWURF“-Hinweise bleiben sichtbar –
 * so geht nichts Ungeprüftes unbemerkt online.
 */
import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { marked } from 'marked';

import { brand } from '../src/config/brand';
import { colors } from '../src/design/tokens';

export type Page = { slug: string; file: string; title: string };

export const PAGES: readonly Page[] = [
  { slug: 'datenschutz', file: 'datenschutz.md', title: 'Datenschutzerklärung' },
  { slug: 'nutzungsbedingungen', file: 'nutzungsbedingungen.md', title: 'Nutzungsbedingungen' },
  { slug: 'impressum', file: 'impressum.md', title: 'Impressum' },
];

const escapeHtml = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
  );

/** Markdown → HTML; rohes HTML aus den Texten wird nicht übernommen. */
export function renderMarkdown(md: string): string {
  const html = marked.parse(md, {
    async: false,
    gfm: true,
    // Kein eingebettetes HTML aus den Quelltexten
    walkTokens: undefined,
  }) as string;
  return html.replace(
    /\[PLATZHALTER:([^\]]*)\]/g,
    (_m, text: string) => `<mark>[PLATZHALTER:${text}]</mark>`,
  );
}

marked.use({
  renderer: {
    html: ({ text }) => escapeHtml(text),
  },
});

const css = () => {
  const l = colors.light;
  const d = colors.dark;
  return `:root{--bg:${l.background};--surface:${l.surface};--text:${l.textPrimary};--muted:${l.textSecondary};--border:${l.border};--primary:${l.primary};--soft:${l.primarySoft};--mark:#FDEFD3}
@media (prefers-color-scheme: dark){:root{--bg:${d.background};--surface:${d.surface};--text:${d.textPrimary};--muted:${d.textSecondary};--border:${d.border};--primary:${d.primary};--soft:${d.primarySoft};--mark:#33270C}}
*{box-sizing:border-box}html{-webkit-text-size-adjust:100%}
body{margin:0;background:var(--bg);color:var(--text);font:17px/1.6 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
header,main,footer{max-width:760px;margin:0 auto;padding:0 16px}
header{display:flex;align-items:center;justify-content:space-between;gap:12px;padding-top:20px;padding-bottom:12px}
header a.brand{font-weight:700;font-size:20px;color:var(--text);text-decoration:none}
nav{display:flex;flex-wrap:wrap;gap:4px 14px;font-size:15px}
main{background:var(--surface);border:1px solid var(--border);border-radius:20px;padding:8px 24px 24px}
h1{font-size:30px;line-height:1.2;margin:20px 0 12px}h2{font-size:22px;margin:28px 0 8px}h3{font-size:18px;margin:20px 0 6px}
a{color:var(--primary)}p,li{overflow-wrap:anywhere}
blockquote{margin:12px 0;padding:10px 16px;border-radius:12px;background:var(--soft);color:var(--text)}blockquote p{margin:4px 0}
mark{background:var(--mark);color:inherit;padding:0 3px;border-radius:4px}
table{border-collapse:collapse;width:100%;display:block;overflow-x:auto;font-size:15px}th,td{border:1px solid var(--border);padding:6px 10px;text-align:left;vertical-align:top}
.cards{display:grid;gap:12px;margin:16px 0}.card{display:block;padding:16px;border:1px solid var(--border);border-radius:16px;text-decoration:none;color:var(--text)}
.card strong{color:var(--primary)}.muted{color:var(--muted)}
footer{padding-top:16px;padding-bottom:32px;font-size:14px;color:var(--muted)}
@media (max-width:480px){main{padding:4px 16px 16px;border-radius:16px}h1{font-size:26px}}`;
};

const layout = (title: string, body: string, depth: number) => {
  const up = depth ? '../'.repeat(depth) : './';
  const links = PAGES.map((p) => `<a href="${up}${p.slug}/">${p.title}</a>`).join('');
  return `<!doctype html>
<html lang="de">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="referrer" content="no-referrer">
<title>${escapeHtml(title)} – ${brand.name}</title>
<link rel="stylesheet" href="${up}styles.css">
</head>
<body>
<header><a class="brand" href="${up}">${brand.name}</a><nav>${links}</nav></header>
<main>${body}</main>
<footer>${brand.name} · <a href="${up}impressum/">Impressum</a> · <a href="${up}datenschutz/">Datenschutz</a></footer>
</body>
</html>
`;
};

function home(supportEmail: string | undefined) {
  const contact = supportEmail
    ? `<a href="mailto:${escapeHtml(supportEmail)}">${escapeHtml(supportEmail)}</a>`
    : '<mark>[PLATZHALTER: Support-E-Mail]</mark>';
  return `<h1>${brand.name}</h1>
<p>Freie Arzttermine in deiner Nähe finden und buchen. Termin-Alarm, wenn etwas frei wird – in der Reihenfolge der Eintragung, Bezahlen bringt keinen Vorrang. Server in Frankfurt, keine Werbung, kein Tracking.</p>
<blockquote><p><strong>Notfall?</strong> Bei Lebensgefahr <a href="tel:112">112</a>. Ärztlicher Bereitschaftsdienst: <a href="tel:116117">116117</a>.</p></blockquote>
<div class="cards">
${PAGES.map((p) => `<a class="card" href="./${p.slug}/"><strong>${p.title}</strong></a>`).join('\n')}
<a class="card" href="./praxis/"><strong>Für Praxen: Praxis-Dashboard</strong><br><span class="muted">Anmeldung nur für eingeladene Praxen</span></a>
</div>
<h2>Kontakt</h2>
<p>Fragen, Datenschutz-Anfragen, Hilfe: ${contact}</p>`;
}

/** Sicherheits-Header für Apache-Webspace (die meisten deutschen Webhoster). */
export const HTACCESS_ROOT = `# Erzeugt von scripts/build-website.ts
# Nur weit verbreitete Direktiven (Apache 2.4, mod_headers/mod_rewrite) – kein „Options“, das viele
# Webhoster in .htaccess verbieten (sonst Fehler 500).
<IfModule mod_rewrite.c>
RewriteEngine On
RewriteCond %{HTTPS} !=on
RewriteRule ^ https://%{HTTP_HOST}%{REQUEST_URI} [L,R=301]
</IfModule>
<IfModule mod_headers.c>
Header always set Strict-Transport-Security "max-age=31536000"
Header always set X-Content-Type-Options "nosniff"
Header always set X-Frame-Options "DENY"
Header always set Referrer-Policy "no-referrer"
Header always set Permissions-Policy "camera=(), microphone=(), geolocation=(), payment=()"
Header always set Content-Security-Policy "default-src 'self'; img-src 'self' data:; style-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'"
</IfModule>
`;

/** Praxis-Dashboard: wie der Build-CSP, zusätzlich frame-ancestors (geht nur als Header). */
export function htaccessDashboard(supabaseUrl: string) {
  const api = new URL(supabaseUrl).origin;
  const ws = api.replace(/^http/, 'ws');
  return `# Erzeugt von scripts/build-website.ts
<IfModule mod_headers.c>
Header always set Content-Security-Policy "default-src 'self'; connect-src 'self' ${api} ${ws}; img-src 'self' data:; style-src 'self'; font-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'"
Header always set X-Robots-Tag "noindex, nofollow"
</IfModule>
<Files "index.html">
<IfModule mod_headers.c>
Header set Cache-Control "no-store"
</IfModule>
</Files>
`;
}

export function buildWebsite(
  outDir: string,
  opts: { supportEmail?: string; legalDir?: string } = {},
) {
  const legalDir = opts.legalDir ?? join(__dirname, '..', 'docs', 'legal');
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, 'styles.css'), css());
  writeFileSync(join(outDir, '.htaccess'), HTACCESS_ROOT);
  writeFileSync(join(outDir, 'robots.txt'), 'User-agent: *\nDisallow: /praxis/\n');
  writeFileSync(join(outDir, 'index.html'), layout(brand.name, home(opts.supportEmail), 0));
  const missing: string[] = [];
  for (const page of PAGES) {
    const src = join(legalDir, page.file);
    const body = existsSync(src)
      ? renderMarkdown(readFileSync(src, 'utf8'))
      : `<h1>${page.title}</h1><p><mark>[PLATZHALTER: Text folgt]</mark></p>`;
    if (!existsSync(src)) missing.push(page.file);
    mkdirSync(join(outDir, page.slug), { recursive: true });
    writeFileSync(join(outDir, page.slug, 'index.html'), layout(page.title, body, 1));
  }
  return { missing };
}

if (require.main === module) {
  const out = process.argv[2] ?? 'dist-website';
  const { missing } = buildWebsite(out, { supportEmail: process.env.SUPPORT_EMAIL || undefined });
  const dashboard = process.env.DASHBOARD_DIST;
  if (dashboard) {
    const supabaseUrl = process.env.SUPABASE_URL;
    if (!supabaseUrl)
      throw new Error('SUPABASE_URL fehlt (für die Sicherheits-Header des Dashboards)');
    cpSync(dashboard, join(out, 'praxis'), { recursive: true });
    writeFileSync(join(out, 'praxis', '.htaccess'), htaccessDashboard(supabaseUrl));
    console.log('Praxis-Dashboard → /praxis/');
  }
  const drafts = PAGES.filter((p) => {
    const f = join(__dirname, '..', 'docs', 'legal', p.file);
    return existsSync(f) && /ENTWURF|\[PLATZHALTER:/.test(readFileSync(f, 'utf8'));
  });
  console.log(`Webseite → ${out}`);
  if (missing.length) console.log(`Fehlende Texte: ${missing.join(', ')}`);
  if (drafts.length)
    console.log(`Noch Entwurf/Platzhalter: ${drafts.map((p) => p.file).join(', ')}`);
}
