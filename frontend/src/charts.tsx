// Lightweight, dependency-free SVG charts for the dashboard results view.
// All inputs come from the already-loaded /deals array — no extra fetches.

type DealLike = {
  listed_price: number;
  predicted_price: number;
  undervalue_percent: number;
};

// ── Undervalue % distribution (histogram) ───────────────────────────────────
export function UndervalueHistogram({ deals }: { deals: DealLike[] }) {
  const W = 320;
  const H = 130;
  const pad = { l: 26, r: 8, t: 8, b: 22 };

  // Bins: 0–10, 10–20, 20–30, 30–40, 40+
  const edges = [0, 10, 20, 30, 40];
  const labels = ["0", "10", "20", "30", "40+"];
  const counts = new Array(edges.length).fill(0) as number[];
  for (const d of deals) {
    const v = d.undervalue_percent;
    let bin = edges.length - 1;
    for (let i = 0; i < edges.length - 1; i++) {
      if (v < edges[i + 1]) { bin = i; break; }
    }
    counts[bin] += 1;
  }
  const maxCount = Math.max(1, ...counts);
  const plotW = W - pad.l - pad.r;
  const plotH = H - pad.t - pad.b;
  const bw = plotW / counts.length;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="auto" role="img" aria-label="Undervalue distribution">
      {/* baseline */}
      <line x1={pad.l} y1={pad.t + plotH} x2={W - pad.r} y2={pad.t + plotH} stroke="var(--rule-strong)" strokeWidth="1" />
      {counts.map((c, i) => {
        const h = (c / maxCount) * plotH;
        const x = pad.l + i * bw + bw * 0.16;
        const y = pad.t + plotH - h;
        const w = bw * 0.68;
        return (
          <g key={i}>
            <rect x={x} y={y} width={w} height={h} rx="2" fill="var(--blue)" opacity={0.25 + 0.6 * (c / maxCount)} />
            {c > 0 && (
              <text x={x + w / 2} y={y - 4} textAnchor="middle" fontSize="9" fontFamily="'JetBrains Mono', monospace" fill="var(--ink-soft)">{c}</text>
            )}
            <text x={x + w / 2} y={H - 7} textAnchor="middle" fontSize="9" fontFamily="'JetBrains Mono', monospace" fill="var(--ink-muted)">{labels[i]}</text>
          </g>
        );
      })}
    </svg>
  );
}

// ── Asking price vs fair value (scatter) ────────────────────────────────────
export function PriceScatter({ deals }: { deals: DealLike[] }) {
  const W = 320;
  const H = 130;
  const pad = { l: 30, r: 10, t: 10, b: 22 };
  const plotW = W - pad.l - pad.r;
  const plotH = H - pad.t - pad.b;

  const vals = deals.flatMap((d) => [d.listed_price, d.predicted_price]);
  const max = Math.max(1, ...vals);
  const sx = (v: number) => pad.l + (v / max) * plotW;
  const sy = (v: number) => pad.t + plotH - (v / max) * plotH;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="auto" role="img" aria-label="Asking price vs fair value">
      {/* axes */}
      <line x1={pad.l} y1={pad.t} x2={pad.l} y2={pad.t + plotH} stroke="var(--rule-strong)" strokeWidth="1" />
      <line x1={pad.l} y1={pad.t + plotH} x2={W - pad.r} y2={pad.t + plotH} stroke="var(--rule-strong)" strokeWidth="1" />
      {/* fair line (asking == fair) */}
      <line x1={sx(0)} y1={sy(0)} x2={sx(max)} y2={sy(max)} stroke="var(--ink-muted)" strokeWidth="1" strokeDasharray="3 3" opacity="0.5" />
      {deals.map((d, i) => (
        <circle
          key={i}
          cx={sx(d.listed_price)}
          cy={sy(d.predicted_price)}
          r="3.5"
          fill="var(--green)"
          opacity="0.8"
        />
      ))}
      <text x={pad.l} y={H - 6} fontSize="8.5" fontFamily="'JetBrains Mono', monospace" fill="var(--ink-muted)">asking →</text>
      <text x={pad.l - 24} y={pad.t + 6} fontSize="8.5" fontFamily="'JetBrains Mono', monospace" fill="var(--ink-muted)" transform={`rotate(-90 ${pad.l - 24} ${pad.t + 6})`}>fair →</text>
    </svg>
  );
}
