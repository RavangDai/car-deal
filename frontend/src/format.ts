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
