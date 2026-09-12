// frontend/src/ui/SiteHeader.tsx
//
// The site header: a full-width two-row bar replacing the old floating pill
// nav. Row one is identity + search + account; row two is section nav plus
// the one mint call to action.
//
// `sticky`, never `fixed` — deliberately. Every page below was written
// assuming the nav occupies flow height; going fixed slides all of them
// underneath it. The old TopBar carried the same note and the same reason.
import { useEffect, useRef, useState } from "react";
import { Wordmark } from "../primitives";
import { useProducts } from "../hooks";
import { Heart, ChevronDown } from "../icons";
import { productImage } from "../images";
import { ProductImage } from "../ProductImage";
import { formatMoney } from "../format";

export type NavKey = "discover" | "deals" | "drops" | "categories";

const NAV: { key: NavKey; label: string; href: string }[] = [
  { key: "discover", label: "Discover", href: "#" },
  // NOT "Trending". Nothing in this product measures views, clicks or
  // velocity, so a trending label would be a claim with no data behind it.
  // `sort=deal_score` is what the API actually offers.
  { key: "deals", label: "Top deals", href: "#/browse" },
  { key: "drops", label: "Price drops", href: "#/browse" },
  { key: "categories", label: "Categories", href: "#/browse" },
];

export function SiteHeader({
  active,
  onSignIn,
  onCreateAlert,
  onSaved,
  signedIn,
}: {
  active?: NavKey;
  onSignIn?: () => void;
  onCreateAlert?: () => void;
  onSaved?: () => void;
  signedIn?: boolean;
}) {
  const [raw, setRaw] = useState("");
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement | null>(null);

  // Debounce so a five-letter word is one request, not five. Each distinct
  // q also mints its own react-query cache entry, so this bounds that too.
  useEffect(() => {
    const t = setTimeout(() => setQ(raw.trim()), 250);
    return () => clearTimeout(t);
  }, [raw]);

  // sort:"newest" is REQUIRED, not a preference. The default deal_score sort
  // filters to products with a non-null score BEFORE applying q, so a
  // default-sorted search silently cannot see anything with under 14 days of
  // history — which is most of a young catalogue.
  const results = useProducts({ q, sort: "newest", limit: 8 }, q.length >= 2);

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (!boxRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const hits = results.data ?? [];
  const showPanel = open && q.length >= 2;

  return (
    <header className="rv-hdr">
      <div className="rv-hdr-row rv-hdr-row-1">
        <a href="#" className="rv-hdr-brand" aria-label="DealOwl home">
          <Wordmark size={22} />
        </a>

        <div className="rv-hdr-search" ref={boxRef}>
          <label className="rv-hdr-search-box">
            <SearchGlyph />
            <input
              type="search"
              className="rv-hdr-search-input"
              placeholder="Search products, brands, or stores"
              aria-label="Search products, brands, or stores"
              value={raw}
              onChange={(e) => { setRaw(e.target.value); setOpen(true); }}
              onFocus={() => setOpen(true)}
            />
          </label>

          {showPanel && (
            <div className="rv-hdr-results" role="listbox" aria-label="Search results">
              {results.isLoading && <p className="rv-hdr-results-note">Searching…</p>}
              {!results.isLoading && hits.length === 0 && (
                // "No matching titles", not "no products": the API matches
                // Product.title only, and title is nullable, so a product
                // with no extracted title genuinely cannot be found here.
                <p className="rv-hdr-results-note">No matching titles.</p>
              )}
              {hits.map((p) => (
                <a key={p.id} className="rv-hdr-result" href={`#/product/${p.id}`} role="option">
                  <ProductImage
                    image={productImage(p.image_url, p.title ?? p.domain, p.category)}
                    ratio="1 / 1"
                    className="rv-hdr-result-shot"
                  />
                  <span className="rv-hdr-result-text">
                    <span className="rv-hdr-result-title">{p.title ?? p.domain}</span>
                    <span className="rv-hdr-result-store">{p.domain}</span>
                  </span>
                  {p.latest_price != null && (
                    <span className="rv-hdr-result-price rv-num">
                      {formatMoney(p.latest_price, p.currency ?? "USD")}
                    </span>
                  )}
                </a>
              ))}
            </div>
          )}
        </div>

        <div className="rv-hdr-end">
          <button type="button" className="rv-hdr-icon-btn" onClick={onSaved}>
            <Heart className="rv-hdr-icon" />
            <span className="rv-sr-only">Saved products</span>
          </button>
          {!signedIn && (
            <button type="button" className="rv-hdr-signin" onClick={onSignIn}>
              Sign in
            </button>
          )}
        </div>
      </div>

      <div className="rv-hdr-row rv-hdr-row-2">
        <nav className="rv-hdr-nav" aria-label="Primary">
          {NAV.map((n) => (
            <a
              key={n.key}
              href={n.href}
              className={`rv-hdr-navlink${active === n.key ? " is-active" : ""}`}
              aria-current={active === n.key ? "page" : undefined}
            >
              {n.label}
              {n.key === "categories" && <ChevronDown className="rv-hdr-navchev" />}
            </a>
          ))}
        </nav>

        <button type="button" className="rv-hdr-alert" onClick={onCreateAlert}>
          <BellGlyph />
          Create alert
        </button>
      </div>
    </header>
  );
}

function SearchGlyph() {
  return (
    <svg className="rv-hdr-search-icon" viewBox="0 0 24 24" fill="none"
         stroke="currentColor" strokeWidth={1.8} aria-hidden="true">
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" strokeLinecap="round" />
    </svg>
  );
}

function BellGlyph() {
  return (
    <svg className="rv-hdr-alert-icon" viewBox="0 0 24 24" fill="none"
         stroke="currentColor" strokeWidth={1.8} aria-hidden="true">
      <path d="M18 8A6 6 0 1 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M13.7 21a2 2 0 0 1-3.4 0" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export const SITE_HEADER_STYLES = `
  .rv-hdr {
    position: sticky; top: 0; z-index: var(--z-sticky-nav);
    background: var(--paper);
    border-bottom: 1px solid var(--rule);
  }
  .rv-hdr-row {
    max-width: var(--measure); margin: 0 auto;
    padding: 0 var(--gutter);
    display: flex; align-items: center; gap: 20px;
  }
  .rv-hdr-row-1 { height: 68px; }
  .rv-hdr-row-2 {
    height: 48px; gap: 26px;
    border-top: 1px solid var(--rule-faint);
  }

  .rv-hdr-brand { flex: none; text-decoration: none; display: flex; align-items: center; }

  .rv-hdr-search { position: relative; flex: 1; min-width: 0; max-width: 620px; margin: 0 auto; }
  .rv-hdr-search-box {
    display: flex; align-items: center; gap: 10px;
    height: 42px; padding: 0 14px;
    background: var(--ground);
    border: 1px solid var(--rule);
    border-radius: var(--r-pill);
    transition: border-color var(--dur-fast) var(--ease-out-soft),
                background-color var(--dur-fast) var(--ease-out-soft);
  }
  .rv-hdr-search-box:focus-within { border-color: var(--ink-muted); background: var(--paper); }
  .rv-hdr-search-icon { width: 18px; height: 18px; flex: none; color: var(--ink-fade); }
  .rv-hdr-search-input {
    flex: 1; min-width: 0;
    border: 0; background: transparent; outline: none;
    font-family: var(--font-sans); font-size: 14.5px; color: var(--ink);
  }
  .rv-hdr-search-input::placeholder { color: var(--ink-fade); }

  .rv-hdr-results {
    position: absolute; left: 0; right: 0; top: calc(100% + 8px);
    z-index: var(--z-modal);
    background: var(--paper);
    border: 1px solid var(--rule);
    border-radius: var(--r-card);
    box-shadow: var(--shadow-lg);
    overflow: hidden;
  }
  .rv-hdr-results-note { margin: 0; padding: 14px 16px; font-size: 13.5px; color: var(--ink-fade); }
  .rv-hdr-result {
    display: flex; align-items: center; gap: 12px;
    padding: 10px 14px; text-decoration: none;
    border-top: 1px solid var(--rule-faint);
  }
  .rv-hdr-result:first-child { border-top: 0; }
  .rv-hdr-result:hover { background: var(--ground); }
  .rv-hdr-result-shot { width: 40px; height: 40px; flex: none; border-radius: 8px; background: var(--plate); }
  .rv-hdr-result-shot img { object-fit: contain; padding: 4px; }
  .rv-hdr-result-text { display: flex; flex-direction: column; min-width: 0; flex: 1; }
  .rv-hdr-result-title {
    font-size: 14px; font-weight: 600; color: var(--ink);
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  }
  .rv-hdr-result-store { font-size: 12px; color: var(--ink-fade); }
  .rv-hdr-result-price { font-size: 14px; font-weight: 700; color: var(--ink); flex: none; }

  .rv-hdr-end { flex: none; display: flex; align-items: center; gap: 10px; }
  .rv-hdr-icon-btn {
    width: 40px; height: 40px;
    display: inline-flex; align-items: center; justify-content: center;
    border: 0; background: transparent; border-radius: var(--r-pill);
    color: var(--ink-soft); cursor: pointer;
    transition: background-color var(--dur-fast) var(--ease-out-soft);
  }
  .rv-hdr-icon-btn:hover { background: var(--ground); color: var(--ink); }
  .rv-hdr-icon { width: 20px; height: 20px; display: block; }

  .rv-hdr-signin {
    border: 0; border-radius: var(--r-pill); cursor: pointer;
    background: var(--navy); color: #fff;
    padding: 10px 20px;
    font-family: var(--font-sans); font-size: 14px; font-weight: 700;
    transition: background-color var(--dur-fast) var(--ease-out-soft);
  }
  .rv-hdr-signin:hover { background: var(--primary-deep); }

  .rv-hdr-nav { display: flex; align-items: center; gap: 26px; flex: 1; min-width: 0; }
  .rv-hdr-navlink {
    position: relative;
    display: inline-flex; align-items: center; gap: 4px;
    height: 47px;
    font-size: 14px; font-weight: 500; color: var(--ink-muted);
    text-decoration: none; white-space: nowrap;
    transition: color var(--dur-fast) var(--ease-out-soft);
  }
  .rv-hdr-navlink:hover { color: var(--ink); }
  /* The active item is carried by WEIGHT AND COLOUR, with mint only as
     decoration on top. Mint is 1.23:1 on this ground — as the sole signal
     it would be invisible. */
  .rv-hdr-navlink.is-active { color: var(--ink); font-weight: 700; }
  .rv-hdr-navlink.is-active::after {
    content: ""; position: absolute; left: 0; right: 0; bottom: 0;
    height: 3px; border-radius: 3px 3px 0 0; background: var(--mint);
  }
  .rv-hdr-navchev { width: 15px; height: 15px; }

  .rv-hdr-alert {
    flex: none;
    display: inline-flex; align-items: center; gap: 8px;
    border: 0; border-radius: var(--r-pill); cursor: pointer;
    background: var(--mint); color: var(--navy);
    padding: 9px 16px;
    font-family: var(--font-sans); font-size: 13.5px; font-weight: 700;
    transition: background-color var(--dur-fast) var(--ease-out-soft);
  }
  .rv-hdr-alert:hover { background: var(--mint-deep); }
  .rv-hdr-alert-icon { width: 16px; height: 16px; }

  .rv-hdr :focus-visible { outline: 2px solid var(--ink); outline-offset: 2px; }

  /* ---- Mobile: identity + actions on one row, search beneath, nav scrolls */
  @media (max-width: 860px) {
    .rv-hdr-row-1 {
      height: auto; gap: 12px; padding: 10px 16px;
      flex-wrap: wrap;
    }
    .rv-hdr-search { order: 3; flex-basis: 100%; max-width: none; margin: 0; }
    .rv-hdr-end { margin-left: auto; }

    /* Row 2 must NOT wrap. It wrapped at first, which put the mint button
       on top of the nav links instead of beside them. The row stays a
       single line; the NAV scrolls inside its own box and the button keeps
       its place at the end. */
    .rv-hdr-row-2 { height: 46px; gap: 12px; flex-wrap: nowrap; padding: 0 16px; }
    .rv-hdr-nav {
      gap: 18px;
      overflow-x: auto; overflow-y: hidden;
      -webkit-overflow-scrolling: touch;
      scrollbar-width: none;
      /* Room for the last pill's active underline to breathe past the edge. */
      padding-right: 4px;
    }
    .rv-hdr-nav::-webkit-scrollbar { display: none; }
    .rv-hdr-navlink { height: 45px; flex: none; }
    .rv-hdr-alert { padding: 8px 12px; font-size: 13px; }
  }

  @media (prefers-reduced-motion: reduce) {
    .rv-hdr-search-box, .rv-hdr-icon-btn, .rv-hdr-signin,
    .rv-hdr-navlink, .rv-hdr-alert { transition: none; }
  }
`;
