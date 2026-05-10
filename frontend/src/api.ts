const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

export async function runCraigslistScrape(
  city: string,
  query: string,
  maxResults: number
) {
  const params = new URLSearchParams({
    city,
    query,
    max_results: String(maxResults),
  });

  const res = await fetch(`${API_BASE}/scrape/craigslist?${params}`, {
    method: "POST",
  });

  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function fetchDeals(minUndervaluePercent: number) {
  const params = new URLSearchParams({
    min_undervalue_percent: String(minUndervaluePercent),
  });

  const res = await fetch(`${API_BASE}/deals?${params}`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}
