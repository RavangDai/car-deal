// Dedicated per-listing detail page (#/deal/:id). Reads GET /deals/{id}, shows
// the real photo(s), the full field set, the price/undervalue breakdown, and a
// link out to the original listing. Reachable for guests and signed-in users.
import { useEffect, useMemo, useState } from "react";
import { useDeal } from "./hooks";
import { CarImage } from "./CarImage";
import { placeholderImage, type ImageAsset } from "./images";
import { Spinner } from "./Spinner";
import { Reveal } from "./primitives";

function money(n: number): string {
  return `$${n.toLocaleString()}`;
}

function postedLabel(iso: string): string {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return "—";
  const d = new Date(t);
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

export default function DealDetailPage({ id, onBack }: { id: string; onBack: () => void }) {
  const { data: deal, isLoading, isError } = useDeal(id);

  const gallery = useMemo<string[]>(() => {
    if (!deal) return [];
    if (deal.image_urls && deal.image_urls.length > 0) return deal.image_urls;
    return deal.image_url ? [deal.image_url] : [];
  }, [deal]);

  const [active, setActive] = useState(0);
  useEffect(() => setActive(0), [id, gallery.length]);

  const hero: ImageAsset =
    gallery.length > 0
      ? { src: gallery[Math.min(active, gallery.length - 1)], alt: deal ? deal.title : "Listing photo" }
      : placeholderImage;

  const savings = deal ? Math.max(0, deal.predicted_price - deal.listed_price) : 0;

  return (
    <div className="rv-detail min-h-screen">
      <style>{DETAIL_STYLES}</style>

      <header className="rv-detail-nav">
        <div className="rv-detail-nav-inner">
          <button onClick={onBack} className="rv-detail-back">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 19l-7-7 7-7" /></svg>
            <span>Back to deals</span>
          </button>
          <a href="#" className="rv-detail-brand">
            <img src="/revveal-logo.png" alt="" aria-hidden className="rv-detail-logo" />
            <span>Revveal</span>
          </a>
        </div>
      </header>

      <main className="rv-detail-main">
        {isLoading && (
          <div className="rv-detail-state">
            <Spinner size={20} />
            <p>Loading listing…</p>
          </div>
        )}

        {(isError || (!isLoading && !deal)) && (
          <div className="rv-detail-state">
            <p className="rv-detail-state-title">Listing not found</p>
            <p className="rv-detail-state-sub">It may have been removed or the link is out of date.</p>
            <button onClick={onBack} className="rv-btn rv-btn-primary">Back to deals</button>
          </div>
        )}

        {deal && (
          <article className="rv-detail-grid">
            {/* Gallery */}
            <div className="rv-detail-gallery">
              <CarImage image={hero} ratio="4 / 3" className="rv-detail-hero" position="center" />
              {gallery.length > 1 && (
                <div className="rv-detail-thumbs">
                  {gallery.slice(0, 8).map((src, i) => (
                    <button
                      key={src + i}
                      className={`rv-detail-thumb ${i === active ? "is-active" : ""}`}
                      onClick={() => setActive(i)}
                      aria-label={`Photo ${i + 1}`}
                    >
                      <CarImage image={{ src, alt: `${deal.title} photo ${i + 1}` }} ratio="4 / 3" />
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Facts */}
            <Reveal className="rv-detail-info">
              <p className="rv-eyebrow mb-2.5">{deal.source} · posted {postedLabel(deal.posted_at)}</p>
              <h1 className="rv-detail-title">{deal.year} {deal.make} {deal.model}</h1>
              <p className="rv-detail-sub">{deal.title}</p>

              <div className="rv-bezel rv-detail-pricebox">
                <div className="rv-bezel-core rv-detail-pricebox-core">
                  <div className="rv-detail-priceline">
                    <span className="rv-detail-asking">{money(deal.listed_price)}</span>
                    <span className="rv-detail-fair">fair value {money(deal.predicted_price)}</span>
                  </div>
                  {savings > 0 && (
                    <div className="rv-detail-savings">
                      Save {money(savings)}
                      <span className="rv-detail-pct"> · −{deal.undervalue_percent.toFixed(0)}% under market</span>
                    </div>
                  )}
                </div>
              </div>

              <dl className="rv-detail-specs">
                <div><dt>Year</dt><dd>{deal.year || "—"}</dd></div>
                <div><dt>Make</dt><dd>{deal.make}</dd></div>
                <div><dt>Model</dt><dd>{deal.model}</dd></div>
                <div><dt>Mileage</dt><dd>{deal.mileage != null ? `${deal.mileage.toLocaleString()} mi` : "—"}</dd></div>
                <div><dt>Location</dt><dd>{deal.location}</dd></div>
                <div><dt>Source</dt><dd>{deal.source}</dd></div>
              </dl>

              {deal.description && (
                <div className="rv-detail-desc">
                  <div className="rv-detail-desc-label">Seller's description</div>
                  <p>{deal.description}</p>
                </div>
              )}

              <a href={deal.url} target="_blank" rel="noreferrer" className="rv-btn rv-btn-primary rv-btn-lg">
                <span>View original listing</span>
                <span className="rv-btn-icon">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="rv-btn-arrow"><path d="M7 17L17 7M9 7h8v8" /></svg>
                </span>
              </a>
            </Reveal>
          </article>
        )}
      </main>
    </div>
  );
}

const DETAIL_STYLES = `
  .rv-detail {
    background: var(--paper);
    color: var(--ink);
    font-family: 'Manrope', sans-serif;
    -webkit-font-smoothing: antialiased;
  }
  .rv-detail-nav { border-bottom: 1px solid var(--rule); background: var(--paper-pale); }
  .rv-detail-nav-inner {
    max-width: 1080px; margin: 0 auto; padding: 14px 24px;
    display: flex; align-items: center; justify-content: space-between;
  }
  .rv-detail-back {
    display: inline-flex; align-items: center; gap: 8px;
    font-size: 14px; font-weight: 600; color: var(--ink-muted);
    transition: color .15s ease;
  }
  .rv-detail-back:hover { color: var(--ink); }
  .rv-detail-brand { display: inline-flex; align-items: center; gap: 9px; font-weight: 800; font-size: 17px; letter-spacing: -0.02em; }
  .rv-detail-logo { width: 24px; height: 24px; object-fit: contain; }

  .rv-detail-main { max-width: 1080px; margin: 0 auto; padding: 32px 24px 64px; }
  .rv-detail-state {
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    gap: 12px; padding: 80px 0; color: var(--ink-muted); text-align: center;
  }
  .rv-detail-state-title { font-family: var(--font-display); font-weight: 600; font-size: 1.5rem; color: var(--ink); }
  .rv-detail-state-sub { font-size: 14px; }

  .rv-detail-grid { display: grid; grid-template-columns: 1.15fr 1fr; gap: 40px; align-items: start; }
  @media (max-width: 860px) { .rv-detail-grid { grid-template-columns: 1fr; gap: 28px; } }

  .rv-detail-hero { width: 100%; border-radius: 14px; box-shadow: var(--shadow-md); }
  .rv-detail-thumbs { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-top: 12px; }
  .rv-detail-thumb {
    border-radius: 9px; overflow: hidden; cursor: pointer;
    border: 2px solid transparent; transition: border-color .15s ease;
  }
  .rv-detail-thumb.is-active { border-color: var(--red); }

  .rv-detail-title { font-family: var(--font-display); font-weight: 600; font-size: clamp(1.7rem, 3.4vw, 2.4rem); line-height: 1.05; letter-spacing: -0.02em; }
  .rv-detail-sub { font-size: 14px; color: var(--ink-muted); margin-top: 8px; }

  .rv-detail-pricebox { margin: 22px 0; }
  .rv-detail-pricebox-core { padding: 18px 20px; }
  .rv-detail-priceline { display: flex; align-items: baseline; gap: 12px; flex-wrap: wrap; }
  .rv-detail-asking { font-size: 1.9rem; font-weight: 800; letter-spacing: -0.02em; font-variant-numeric: tabular-nums; }
  .rv-detail-fair { font-size: 13.5px; color: var(--ink-muted); font-variant-numeric: tabular-nums; }
  .rv-detail-savings { margin-top: 8px; font-size: 15px; font-weight: 800; color: var(--red); font-variant-numeric: tabular-nums; }
  .rv-detail-pct { font-size: 13px; font-weight: 700; }

  .rv-detail-specs { display: grid; grid-template-columns: repeat(2, 1fr); gap: 1px; background: var(--rule); border: 1px solid var(--rule); border-radius: 12px; overflow: hidden; margin: 0 0 22px; }
  .rv-detail-specs > div { background: var(--paper-pale); padding: 11px 14px; }
  .rv-detail-specs dt { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.07em; color: var(--ink-muted); }
  .rv-detail-specs dd { margin: 3px 0 0; font-size: 14.5px; font-weight: 600; }

  .rv-detail-desc { margin-bottom: 24px; }
  .rv-detail-desc-label { font-size: 11.5px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.08em; color: var(--ink-muted); margin-bottom: 8px; }
  .rv-detail-desc p { font-size: 14.5px; line-height: 1.6; color: var(--ink); white-space: pre-line; }
`;
