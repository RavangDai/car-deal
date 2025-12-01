export async function scrapeCraigslist(city: string, query: string, maxResults = 10) {
  const res = await fetch(
    `http://127.0.0.1:8000/scrape/craigslist?city=${encodeURIComponent(
      city
    )}&query=${encodeURIComponent(query)}&max_results=${maxResults}`,
    { method: "POST" }
  );
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}
