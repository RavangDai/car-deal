import type { CSSProperties, ReactNode } from "react";

// ── Car silhouette (side profile) ─────────────────────────────────────────
export function CarSilhouette({
  size = 48,
  className = "",
  style,
}: {
  size?: number;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <svg
      width={size}
      height={size * 0.5}
      viewBox="0 0 48 24"
      fill="currentColor"
      aria-hidden
      className={className}
      style={style}
    >
      {/* body */}
      <path d="M3.5 18.5 L3.5 14.5 Q3.5 12.6 5.2 11.8 L11 9.2 Q12.5 8.5 14.2 8.5 L31 8.5 Q33 8.5 34.6 9.4 L41.5 12.6 Q44.5 13.6 44.5 16 L44.5 18.5 Z" />
      {/* windows */}
      <rect x="14.4" y="9.7" width="6.6" height="3" rx="0.4" fill="var(--bone, #efe9dd)" />
      <rect x="22.4" y="9.7" width="6.6" height="3" rx="0.4" fill="var(--bone, #efe9dd)" />
      {/* wheels */}
      <circle cx="13" cy="20" r="3.4" />
      <circle cx="13" cy="20" r="1.4" fill="var(--bone, #efe9dd)" />
      <circle cx="36" cy="20" r="3.4" />
      <circle cx="36" cy="20" r="1.4" fill="var(--bone, #efe9dd)" />
    </svg>
  );
}

// ── Gauge dial — semicircular tachometer-style ────────────────────────────
export function GaugeDial({
  value,
  max = 40,
  redlineFrom = 25,
  size = 36,
  className = "",
}: {
  value: number;
  max?: number;
  redlineFrom?: number;
  size?: number;
  className?: string;
}) {
  const cx = 18;
  const cy = 16;
  const r = 13;
  const needleLen = 11.5;

  const ratio = Math.max(0, Math.min(1, value / max));
  const angle = (180 - 180 * ratio) * (Math.PI / 180);
  const nx = cx + Math.cos(angle) * needleLen;
  const ny = cy - Math.sin(angle) * needleLen;

  const rRatio = Math.max(0, Math.min(1, redlineFrom / max));
  const rAngle = (180 - 180 * rRatio) * (Math.PI / 180);
  const redStartX = cx + Math.cos(rAngle) * r;
  const redStartY = cy - Math.sin(rAngle) * r;

  const inRed = value >= redlineFrom;

  return (
    <svg
      width={size}
      height={size * 0.62}
      viewBox="0 0 36 22"
      fill="none"
      aria-hidden
      className={className}
    >
      {/* outer arc */}
      <path
        d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
        stroke="currentColor"
        strokeWidth="1.2"
        opacity="0.5"
      />
      {/* redline */}
      <path
        d={`M ${redStartX} ${redStartY} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
        stroke="var(--red, #c41e3a)"
        strokeWidth="1.6"
      />
      {/* tick marks at 0%, 50%, 100% */}
      <line x1={cx - r} y1={cy} x2={cx - r + 1.6} y2={cy - 0.8} stroke="currentColor" strokeWidth="1" opacity="0.6" />
      <line x1={cx} y1={cy - r} x2={cx} y2={cy - r + 1.6} stroke="currentColor" strokeWidth="1" opacity="0.6" />
      <line x1={cx + r} y1={cy} x2={cx + r - 1.6} y2={cy - 0.8} stroke="currentColor" strokeWidth="1" opacity="0.6" />
      {/* needle */}
      <line
        x1={cx}
        y1={cy}
        x2={nx}
        y2={ny}
        stroke={inRed ? "var(--red, #c41e3a)" : "currentColor"}
        strokeWidth="1.7"
        strokeLinecap="round"
      />
      {/* hub */}
      <circle cx={cx} cy={cy} r="1.7" fill="currentColor" />
    </svg>
  );
}

// ── Odometer — bordered tabular digit display ─────────────────────────────
export function Odometer({
  value,
  digits = 6,
  unit = "mi",
  className = "",
}: {
  value: number;
  digits?: number;
  unit?: string;
  className?: string;
}) {
  const padded = String(Math.max(0, Math.floor(value))).padStart(digits, "0");
  return (
    <span className={`inline-flex items-center gap-1.5 align-baseline ${className}`}>
      <span className="inline-flex border-[1.5px] border-current">
        {padded.split("").map((d, i) => (
          <span
            key={i}
            className={`font-mono text-[11px] tabular-nums leading-none px-[5px] py-[3px] ${
              i < padded.length - 1 ? "border-r border-current/40" : ""
            }`}
          >
            {d}
          </span>
        ))}
      </span>
      {unit && (
        <span className="font-mono text-[9px] uppercase tracking-[0.22em] opacity-60">
          {unit}
        </span>
      )}
    </span>
  );
}

// ── License plate — bordered mono pill with "screw dots" ──────────────────
export function LicensePlate({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-2 px-2.5 py-[5px] border-[1.5px] border-current font-mono text-[10px] uppercase tracking-[0.2em] leading-none ${className}`}
    >
      <span className="w-[3px] h-[3px] rounded-full bg-current opacity-60" />
      <span>{children}</span>
      <span className="w-[3px] h-[3px] rounded-full bg-current opacity-60" />
    </span>
  );
}

// ── Tire — spinning wheel for loading states ──────────────────────────────
export function Tire({
  size = 16,
  className = "",
}: {
  size?: number;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      className={`${className} animate-spin`}
      style={{ animationDuration: "1.4s" }}
      aria-hidden
    >
      <circle cx="12" cy="12" r="10" />
      <circle cx="12" cy="12" r="3" />
      <line x1="12" y1="2" x2="12" y2="6" strokeLinecap="round" />
      <line x1="12" y1="18" x2="12" y2="22" strokeLinecap="round" />
      <line x1="2" y1="12" x2="6" y2="12" strokeLinecap="round" />
      <line x1="18" y1="12" x2="22" y2="12" strokeLinecap="round" />
      <line x1="4.93" y1="4.93" x2="7.76" y2="7.76" strokeLinecap="round" />
      <line x1="16.24" y1="16.24" x2="19.07" y2="19.07" strokeLinecap="round" />
      <line x1="4.93" y1="19.07" x2="7.76" y2="16.24" strokeLinecap="round" />
      <line x1="16.24" y1="7.76" x2="19.07" y2="4.93" strokeLinecap="round" />
    </svg>
  );
}

// ── Source-code mapper for license plates ─────────────────────────────────
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
