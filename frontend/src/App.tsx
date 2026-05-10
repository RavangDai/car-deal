import { useState } from "react";
import { runCraigslistScrape, fetchDeals } from "./api";
import LoginPage from "./LoginPage";
import HomePage from "./HomePage";

type Page = "home" | "login" | "dashboard";

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
  const [page, setPage] = useState<Page>("home");

  if (page === "home")  return <HomePage  onGetStarted={() => setPage("login")} />;
  if (page === "login") return <LoginPage onLogin={() => setPage("dashboard")} />;
  return <Dashboard onLogout={() => setPage("home")} />;
}

function Dashboard({ onLogout }: { onLogout: () => void }) {
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
    <div className="min-h-screen" style={{ background: "var(--bone)", color: "var(--ink)", fontFamily: "'DM Sans', sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght,SOFT,WONK@0,9..144,400..800,0..100,0..1;1,9..144,400..800,0..100,0..1&family=DM+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;700&display=swap');
        :root {
          --bone:#efe9dd; --paper:#f7f1e3;
          --ink:#131310; --ink-soft:#3a3a36; --ink-muted:#7a756c;
          --rule:#ddd6c7; --rule-strong:#131310;
          --red:#c41e3a; --red-deep:#a01a30;
        }
        .display { font-family:'Fraunces',serif; font-weight:500; font-variation-settings:"WONK" 1,"SOFT" 30,"opsz" 144; }
        .field-input {
          width:100%; padding:11px 14px; background:transparent; border:1px solid var(--rule-strong);
          font-size:14px; color:var(--ink); outline:none; transition:background-color .15s;
          font-family:'DM Sans',sans-serif;
        }
        .field-input:focus { background:var(--paper); }
      `}</style>

      {/* ── HEADER ──────────────────────────────────────────── */}
      <header className="border-b border-[var(--rule-strong)] bg-[var(--bone)]">
        <div className="px-6 md:px-10 py-5 flex items-center justify-between max-w-[1280px] mx-auto">
          <div className="flex items-center gap-8">
            <a href="#" className="flex items-baseline gap-1">
              <span className="display text-[1.4rem] leading-none tracking-tight">Revveal</span>
              <span className="w-[7px] h-[7px] bg-[var(--red)] inline-block translate-y-[-2px]" />
            </a>
            <span className="hidden md:inline font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--ink-muted)]">
              Buyer's Console / v3.2
            </span>
          </div>
          <button
            onClick={onLogout}
            className="text-[13px] text-[var(--ink-soft)] hover:text-[var(--ink)] transition-colors flex items-center gap-2"
          >
            <span>Sign out</span> <span className="text-[var(--red)]">↗</span>
          </button>
        </div>
      </header>

      {/* ── PAGE TITLE ───────────────────────────────────────── */}
      <section className="px-6 md:px-10 py-16 max-w-[1280px] mx-auto">
        <div className="flex items-baseline gap-3 mb-8">
          <span className="font-mono text-[11px] tracking-[0.2em] uppercase text-[var(--ink-muted)]">§ Search</span>
          <span className="h-px flex-1 max-w-[80px] bg-[var(--rule-strong)] translate-y-[-3px]" />
          <span className="font-mono text-[11px] tracking-[0.2em] uppercase text-[var(--ink-soft)]">Live Index</span>
        </div>
        <h1 className="display text-[clamp(2.5rem,5vw,4rem)] leading-[0.95] tracking-[-0.02em] mb-3">
          Find a deal <span className="italic text-[var(--red)]">worth</span> the drive.
        </h1>
        <p className="text-[15px] text-[var(--ink-soft)] max-w-[40ch]">
          Set your parameters. The model returns ranked, scored, and explained.
        </p>
      </section>

      {/* ── SEARCH FORM ──────────────────────────────────────── */}
      <section className="px-6 md:px-10 mb-16 max-w-[1280px] mx-auto">
        <form
          onSubmit={handleSearch}
          className="bg-[var(--paper)] border border-[var(--rule-strong)] p-7 md:p-9"
        >
          <div className="flex items-center gap-3 mb-7">
            <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--ink-muted)]">Form 02 — Parameters</span>
            <span className="h-px flex-1 bg-[var(--rule)]" />
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-5">
            <Input label="City" value={city} onChange={setCity} placeholder="austin" />
            <Input label="Search query" value={query} onChange={setQuery} placeholder="honda civic" />
            <Input label="Max results" value={maxResults} type="number" onChange={(v) => setMaxResults(Number(v))} />
            <Input label="Min undervalue %" value={minUndervalue} type="number" onChange={(v) => setMinUndervalue(Number(v))} />
          </div>

          <div className="mt-7 flex items-center gap-6">
            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center gap-3 px-7 py-3 bg-[var(--ink)] text-[var(--bone)] text-[14px] font-medium rounded-full hover:bg-[var(--red)] disabled:opacity-60 disabled:hover:bg-[var(--ink)] transition-all duration-200 group"
            >
              <span>{loading ? "Querying" : "Run search"}</span>
              <span className="transition-transform group-hover:translate-x-0.5">→</span>
            </button>
            {error && (
              <p className="text-[13px] text-[var(--red)] flex items-center gap-2">
                <span className="font-bold">!</span> {error}
              </p>
            )}
          </div>
        </form>
      </section>

      {/* ── RESULTS ─────────────────────────────────────────── */}
      <section className="px-6 md:px-10 pb-24 max-w-[1280px] mx-auto">
        <div className="flex items-baseline justify-between mb-8 border-b border-[var(--rule-strong)] pb-4">
          <h2 className="display text-[1.8rem] tracking-[-0.02em]">
            Index <span className="italic">— results</span>
          </h2>
          <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-[var(--ink-muted)]">
            {loading ? "fetching..." : `${deals.length} listings`}
          </span>
        </div>

        {!loading && deals.length === 0 && (
          <div className="border border-dashed border-[var(--rule-strong)]/30 p-16 text-center">
            <p className="display text-[1.6rem] mb-2 italic text-[var(--ink-muted)]">No results yet.</p>
            <p className="text-[13px] text-[var(--ink-muted)]">Run a search to populate the index.</p>
          </div>
        )}

        {loading && (
          <p className="font-mono text-[13px] text-[var(--ink-muted)]">querying sources...</p>
        )}

        <div className="grid md:grid-cols-2 gap-px bg-[var(--rule-strong)] border border-[var(--rule-strong)]">
          {deals.map((deal, i) => (
            <a
              key={deal.id}
              href={deal.url}
              target="_blank"
              rel="noreferrer"
              className="block bg-[var(--bone)] hover:bg-[var(--paper)] p-7 transition-colors group"
            >
              <div className="flex items-start justify-between mb-1">
                <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--ink-muted)]">
                  № {String(i + 1).padStart(4, "0")}
                </span>
                <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--ink-muted)]">
                  {deal.source}
                </span>
              </div>
              <div className="border-b border-[var(--ink)] mb-5" />

              <h3 className="display text-[1.5rem] leading-tight tracking-tight mb-1">
                {deal.year} {deal.make} {deal.model}
              </h3>
              <p className="text-[13px] text-[var(--ink-muted)] mb-5">
                {deal.location} · {deal.mileage ? `${deal.mileage.toLocaleString()} mi` : "Mileage N/A"}
              </p>

              <div className="border-t border-dashed border-[var(--rule-strong)]/30 pt-4 space-y-2 font-mono text-[13px]">
                <div className="flex items-baseline gap-3">
                  <span className="text-[var(--ink-muted)]">Listed</span>
                  <span className="flex-1 border-b border-dotted border-[var(--rule-strong)]/30 translate-y-[-4px]" />
                  <span className="font-bold">${deal.listed_price.toLocaleString()}</span>
                </div>
                <div className="flex items-baseline gap-3">
                  <span className="text-[var(--ink-muted)]">Fair value</span>
                  <span className="flex-1 border-b border-dotted border-[var(--rule-strong)]/30 translate-y-[-4px]" />
                  <span>${deal.predicted_price.toLocaleString()}</span>
                </div>
                <div className="flex items-baseline gap-3 pt-1">
                  <span className="text-[var(--ink-muted)]">Differential</span>
                  <span className="flex-1 border-b border-dotted border-[var(--rule-strong)]/30 translate-y-[-4px]" />
                  <span className="text-[var(--red)] font-bold">−{deal.undervalue_percent.toFixed(1)}%</span>
                </div>
              </div>
            </a>
          ))}
        </div>
      </section>

      {/* ── FOOTER ──────────────────────────────────────────── */}
      <footer className="border-t border-[var(--rule-strong)] px-6 md:px-10 py-8">
        <div className="max-w-[1280px] mx-auto flex items-center justify-between">
          <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-[var(--ink-muted)]">
            © 2026 Revveal · Buyer's Index
          </span>
          <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-[var(--ink-muted)]">
            Model v3.2 · Updated 2m ago
          </span>
        </div>
      </footer>
    </div>
  );
}

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
    <div>
      <label className="font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--ink-muted)] mb-2 block">
        {label}
      </label>
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="field-input"
      />
    </div>
  );
}
