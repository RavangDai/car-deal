export function formatMoney(value: number, currency: string = "USD"): string {
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
      maximumFractionDigits: Number.isInteger(value) ? 0 : 2,
    }).format(value);
  } catch {
    return `$${value.toFixed(2)}`;
  }
}

export function formatPct(value: number): string {
  return `${value >= 0 ? "" : "−"}${Math.abs(value).toFixed(0)}%`;
}

// Fine-grained "N ago" for real recency (taskbar status, etc.) — distinct
// from HomePage's day-granularity agoLabel, which reads "tracked N days"
// for a product's tracking age rather than a recheck timestamp.
export function formatCheckedAgo(iso: string | null): string {
  if (!iso) return "Not checked yet";
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return "Not checked yet";
  const minutes = Math.max(0, Math.round((Date.now() - t) / 60_000));
  if (minutes < 1) return "Last checked just now";
  if (minutes < 60) return `Last checked ${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `Last checked ${hours}h ago`;
  const days = Math.round(hours / 24);
  return `Last checked ${days}d ago`;
}
