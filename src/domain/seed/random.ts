/** Deterministischer Zufall für reproduzierbare Demo-Daten und Tests. */

/** FNV-1a (32 bit) */
export function hashString(input: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Schneller 32-bit-Integer-Mixer (Murmur3-Finalizer) für deterministische Würfe. */
export function mix32(a: number, b: number): number {
  let h = (a ^ Math.imul(b, 0x9e3779b1)) >>> 0;
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return h >>> 0;
}

/** Mulberry32 – kleiner, schneller PRNG mit gutem Verteilungsverhalten. */
export function createRandom(seed: number | string) {
  let state = typeof seed === 'string' ? hashString(seed) : seed >>> 0;
  const next = () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    int: (min: number, max: number) => min + Math.floor(next() * (max - min + 1)),
    float: (min: number, max: number) => min + next() * (max - min),
    chance: (p: number) => next() < p,
    pick: <T>(items: readonly T[]): T => {
      const item = items[Math.floor(next() * items.length)];
      if (item === undefined) throw new Error('pick() auf leerer Liste');
      return item;
    },
    shuffle: <T>(items: readonly T[]): T[] => {
      const copy = [...items];
      for (let i = copy.length - 1; i > 0; i--) {
        const j = Math.floor(next() * (i + 1));
        [copy[i], copy[j]] = [copy[j] as T, copy[i] as T];
      }
      return copy;
    },
  };
}

export type Random = ReturnType<typeof createRandom>;

/** Stabile UUID (Format v4-kompatibel) aus einem String – gleiche IDs in App-Demo und SQL-Seed. */
export function uuidFromString(input: string): string {
  const parts = [0, 1, 2, 3].map((i) => hashString(`${i}:${input}`).toString(16).padStart(8, '0'));
  const hex = parts.join('');
  const variant = ((parseInt(hex[16] ?? '0', 16) & 0x3) | 0x8).toString(16);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-${variant}${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}
