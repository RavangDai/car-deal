// Small pure helpers shared by the dashboard UI. Kept out of CarGlyphs.tsx so
// that file only exports components (keeps React Fast Refresh happy).

const SOURCE_CODES: Record<string, string> = {
  craigslist: "CL",
  facebook: "FB",
  autotrader: "AT",
  cargurus: "CG",
};

export function sourceCode(source: string): string {
  return (
    SOURCE_CODES[source.toLowerCase()] ?? source.slice(0, 2).toUpperCase()
  );
}

export function extractStateCode(location: string): string | null {
  const m = location.match(/,\s*([A-Z]{2})\s*$/);
  return m ? m[1] : null;
}
