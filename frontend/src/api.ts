// frontend/src/api.ts

const API_BASE = "http://127.0.0.1:8000";

export async function runCraigslistScrape(
  city: string,
  query: string,
  maxResults: number
) {
  const url =
    `${API_BASE}/scrape/craigslist?` +
    `city=${encodeURIComponent(city)}` +
    `&query=${encodeURIComponent(query)}` +
    `&max_results=${maxResults}`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  });

  if (!res.ok) {
    throw new Error(await res.text());
  }
  return res.json(); // { inserted, city, query, deals: [...] }
}

export async function fetchDeals(minUndervaluePercent: number) {
  const url =
    `${API_BASE}/deals?` +
    `min_undervalue_percent=${encodeURIComponent(minUndervaluePercent)}`;

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(await res.text());
  }
  return res.json(); // array of deals
}
