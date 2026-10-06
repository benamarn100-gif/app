/**
 * Ruhige, flächige Illustrationen in den Markenfarben (Farben über CSS-Klassen
 * aus den Design-Tokens, damit Hell/Dunkel automatisch passt).
 */
export function CalendarIllustration() {
  return (
    <svg viewBox="0 0 160 120" width="160" height="120" role="presentation" focusable="false">
      <ellipse className="ill-blob-teal" cx="80" cy="66" rx="70" ry="48" />
      <circle className="ill-blob-coral" cx="128" cy="30" r="14" />
      <rect className="ill-surface ill-stroke" x="44" y="30" width="72" height="64" rx="12" />
      <rect className="ill-primary" x="44" y="30" width="72" height="16" rx="8" />
      <rect className="ill-primary" x="44" y="38" width="72" height="8" />
      <circle className="ill-free" cx="62" cy="62" r="5" />
      <circle className="ill-muted" cx="80" cy="62" r="5" />
      <circle className="ill-muted" cx="98" cy="62" r="5" />
      <circle className="ill-muted" cx="62" cy="78" r="5" />
      <circle className="ill-free" cx="80" cy="78" r="5" />
      <circle className="ill-muted" cx="98" cy="78" r="5" />
    </svg>
  );
}

export function ShieldIllustration() {
  return (
    <svg viewBox="0 0 160 120" width="160" height="120" role="presentation" focusable="false">
      <ellipse className="ill-blob-teal" cx="80" cy="64" rx="66" ry="46" />
      <circle className="ill-blob-sand" cx="34" cy="28" r="12" />
      <path
        className="ill-surface ill-stroke"
        d="M80 22 L112 34 V62 C112 82 98 94 80 100 C62 94 48 82 48 62 V34 Z"
      />
      <path className="ill-check" d="M66 62 L76 72 L96 50" />
    </svg>
  );
}

/** Wortmarke: Plus im abgerundeten Quadrat (wie das App-Icon). */
export function LogoMark({ size = 32 }: { size?: number }) {
  return (
    <svg viewBox="0 0 64 64" width={size} height={size} role="presentation" focusable="false">
      <rect className="ill-primary" width="64" height="64" rx="16" />
      <path className="ill-logo-cross" d="M32 18v28M18 32h28" />
    </svg>
  );
}
