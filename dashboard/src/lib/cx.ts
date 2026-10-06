/** Klassennamen zusammensetzen (falsy-Werte werden ignoriert). */
export function cx(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(' ');
}
