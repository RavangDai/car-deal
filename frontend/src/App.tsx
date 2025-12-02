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

export default function App() {
  const [city, setCity] = useState("austin");
  const [query, setQuery] = useState("honda civic");
  const [maxResults, setMaxResults] = useState(10);
  const [minUndervalue, setMinUndervalue] = useState(10);

  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      await runCraigslistScrape(city, query, maxResults);
      const results = await fetchDeals(minUndervalue);
      setDeals(results);
    } catch (err: any) {
      setError(err?.message ?? "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200">
      {/* HEADER */}
      <header className="px-6 py-8 border-b border-slate-800 bg-slate-900/70 backdrop-blur">
        <h1 className="text-4xl font-bold tracking-tight">
          🚗 Car Deal Finder <span className="text-emerald-400">AI</span>
        </h1>
        <p className="text-slate-400 mt-1 text-sm">
          Search undervalued used cars using FastAPI + SQLite.
        </p>
      </header>

      {/* MAIN CONTENT */}
      <main className="max-w-5xl mx-auto px-6 py-10 space-y-10">

        {/* SEARCH BOX */}
        <form
          onSubmit={handleSearch}
          className="grid gap-4 bg-slate-900/50 border border-slate-800 p-5 rounded-xl"
        >
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Input
              label="City"
              value={city}
              onChange={setCity}
              placeholder="austin"
            />
            <Input
              label="Search Query"
              value={query}
              onChange={setQuery}
              placeholder="honda civic"
            />
            <Input
              label="Max Results"
              value={maxResults}
              type="number"
              onChange={(v) => setMaxResults(Number(v))}
            />
            <Input
              label="Min Undervalue %"
              value={minUndervalue}
              type="number"
              onChange={(v) => setMinUndervalue(Number(v))}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="mt-3 w-fit px-4 py-2 bg-emerald-500 text-slate-900 font-semibold rounded-lg shadow-md hover:bg-emerald-400 disabled:opacity-50"
          >
            {loading ? "Searching…" : "🔍 Find Deals"}
          </button>

          {error && <p className="text-red-400 text-sm">Error: {error}</p>}
        </form>

        {/* RESULTS */}
        <section>
          <h2 className="text-2xl font-semibold mb-4">Best Deals</h2>

          {!loading && deals.length === 0 && (
            <p className="text-slate-500">No deals yet. Try running a search.</p>
          )}

          {loading && <p className="text-slate-400">Loading results…</p>}

          <div className="grid md:grid-cols-2 gap-5">
            {deals.map((deal) => (
              <a
                key={deal.id}
                href={deal.url}
                target="_blank"
                className="block bg-slate-900/60 border border-slate-800 rounded-xl p-5 hover:border-emerald-400 transition"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-semibold text-lg">
                      {deal.year} {deal.make} {deal.model}
                    </h3>
                    <p className="text-slate-400 text-sm">{deal.title}</p>
                    <p className="text-slate-500 text-xs mt-1">
                      {deal.location} •{" "}
                      {deal.mileage
                        ? `${deal.mileage.toLocaleString()} mi`
                        : "Mileage N/A"}
                    </p>
                  </div>

                  <span className="text-xs px-2 py-1 bg-slate-800 rounded-full">
                    {deal.source}
                  </span>
                </div>

                <div className="mt-4">
                  <p className="text-emerald-400 font-bold text-xl">
                    ${deal.listed_price.toLocaleString()}
                  </p>
                  <p className="text-xs text-slate-400">
                    Est. fair: ${deal.predicted_price.toLocaleString()}
                  </p>
                  <div className="mt-2 text-emerald-300 text-sm font-semibold">
                    {deal.undervalue_percent.toFixed(1)}% undervalued
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

/* SMALL INPUT COMPONENT FOR CLEANER UI */
function Input({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  label: string;
  value: any;
  onChange: (v: any) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs text-slate-400">{label}</label>
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm outline-none focus:border-emerald-400"
      />
    </div>
  );
}
