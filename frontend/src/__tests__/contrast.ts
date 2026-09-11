/** WCAG 2.1 relative luminance / contrast, plus a token parser.
 *  Used by tokens.test.ts to hold the palette to measured floors rather
 *  than to anyone's eye. */

function expand(hex: string): string {
  const h = hex.trim().replace(/^#/, "");
  return h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
}

function channel(v: number): number {
  const c = v / 255;
  return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

export function relativeLuminance(hex: string): number {
  const h = expand(hex);
  if (!/^[0-9a-fA-F]{6}$/.test(h)) throw new Error(`not a hex colour: ${hex}`);
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

export function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const hi = Math.max(la, lb);
  const lo = Math.min(la, lb);
  return (hi + 0.05) / (lo + 0.05);
}

/** Pulls `--name: value;` pairs out of CSS source text. Values are trimmed;
 *  declarations spanning lines are not supported (none exist in theme.css). */
export function parseTokens(css: string): Record<string, string> {
  const out: Record<string, string> = {};
  const re = /(--[a-z0-9-]+)\s*:\s*([^;]+);/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(css)) !== null) out[m[1]] = m[2].trim();
  return out;
}
