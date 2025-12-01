import { useState } from "react";
import { runCraigslistScrape, fetchDeals } from "./api";

type Deal = {
  id: string;
  source: string;
  url: string;
  title: string;
  description: string;
  listed_price: number;
  predicted_price: number;
  undervalue_percent: number;
  year: number;
  make: string;
  model: string;
  mileage: number | null;
  location: string;
  created_at: string;
  posted_at: string;
};

function App() {
  const [city, setCity] = useState("austin");
  const [query, setQuery] = useState("honda civic");
  const [maxResults, setMaxResults] = useState(10);
  const [minUndervalue, setMinUndervalue] = useState(10);

  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFindDeals() {
    setLoading(true);
    setError(null);

    try {
      // 1) run scraper to populate DB
      await runCraigslistScrape(city, query, maxResults);

      // 2) fetch filtered deals from DB
      const data = await fetchDeals(minUndervalue);
      setDeals(data);
    } catch (err: any) {
      console.error(err);
      setError(err.message ?? "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 flex flex-col items-center p-6">
      <header className="max-w-4xl w-full mb-6">
        <h1 className="text-3xl font-bold mb-2">🚗 Car Deal Finder AI</h1>
        <p className="text-slate-300">
          Find undervalued car listings using your FastAPI + SQLite backend.
        </p>
      </header>

      <main className="max-w-4xl w-full space-y-6">
        {/* Controls */}
        <section className="bg-slate-900/70 border border-slate-800 rounded-2xl p-4 space-y-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <div>
              <label className="block text-sm mb-1">City</label>
              <input
                className="w-full rounded-md bg-slate-950 border border-slate-700 px-2 py-1"
                value={city}
                onChange={(e) => setCity(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-sm mb-1">Query</label>
              <input
                className="w-full rounded-md bg-slate-950 border border-slate-700 px-2 py-1"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-sm mb-1">Max results</label>
              <input
                type="number"
                className="w-full rounded-md bg-slate-950 border border-slate-700 px-2 py-1"
                value={maxResults}
                onChange={(e) => setMaxResults(Number(e.target.value))}
              />
            </div>

            <div>
              <label className="block text-sm mb-1">
                Min undervalue % (deal score)
              </label>
              <input
                type="number"
                className="w-full rounded-md bg-slate-950 border border-slate-700 px-2 py-1"
                value={minUndervalue}
                onChange={(e) => setMinUndervalue(Number(e.target.value))}
              />
            </div>
          </div>

          <button
            onClick={handleFindDeals}
            disabled={loading}
            className="mt-2 inline-flex items-center px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 disabled:opacity-60"
          >
            {loading ? "Finding deals…" : "Find Deals"}
          </button>

          {error && (
            <p className="text-sm text-red-400 mt-2">Error: {error}</p>
          )}
        </section>

        {/* Results */}
        <section className="space-y-3">
          <h2 className="text-xl font-semibold">
            Results ({deals.length} deals)
          </h2>

          {deals.length === 0 && !loading && (
            <p className="text-slate-400 text-sm">
              No deals yet. Try running a search.
            </p>
          )}

          <div className="space-y-3">
            {deals.map((deal) => (
              <a
                key={deal.id}
                href={deal.url}
                target="_blank"
                rel="noreferrer"
                className="block rounded-2xl border border-slate-800 bg-slate-900/70 p-4 hover:border-emerald-500 transition"
              >
                <div className="flex justify-between items-start gap-4">
                  <div>
                    <h3 className="font-semibold">
                      {deal.year} {deal.make} {deal.model}
                    </h3>
                    <p className="text-sm text-slate-300">{deal.title}</p>
                    <p className="text-xs text-slate-400 mt-1 line-clamp-2">
                      {deal.description}
                    </p>
                    <p className="text-xs text-slate-400 mt-1">
                      {deal.location} • mileage:{" "}
                      {deal.mileage ? `${deal.mileage.toLocaleString()} mi` : "—"}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold text-emerald-400">
                      ${deal.listed_price.toLocaleString()}
                    </p>
                    <p className="text-xs text-slate-400">
                      Predicted: ${deal.predicted_price.toLocaleString()}
                    </p>
                    <p className="text-xs mt-1 text-amber-300 font-semibold">
                      {deal.undervalue_percent.toFixed(1)}% undervalued
                    </p>
                  </div>
                </div>
              </a>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}

export default App;
