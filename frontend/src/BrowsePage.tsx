// Browse every tracked product (#/browse), ranked by the computed deal score
// and filterable by category.
//
// This is what "Browse" and "See every tracked deal" always promised. They
// previously entered guest mode, which showed a browse feed — but once guests
// got real accounts that became *your* watchlist, i.e. empty for a new
// visitor. Those buttons now land here.
//
// Ranking is the API's, not a local re-derivation: GET /products?sort=deal_score
// orders on the indexed, materialised `deal_score` column.
import { useState } from "react";
import { ArrowLeft } from "lucide-react";
import { useProducts } from "./hooks";
import { formatMoney } from "./format";
import { ProductImage } from "./ProductImage";
import { productImage } from "./images";
import { CATEGORIES, categoryLabel, type CategorySlug } from "./taxonomy";
import { Spinner } from "./Spinner";
import { Button, Delta, Panel, Stamp, TopBar } from "./primitives";
import type { Product } from "./api";

type Sort = "deal_score" | "newest";

export default function BrowsePage({ onBack }: { onBack: () => void }) {
  const [category, setCategory] = useState<CategorySlug | null>(null);
  const [sort, setSort] = useState<Sort>("deal_score");
  const [menuOpen, setMenuOpen] = useState(false);

  const query = useProducts({
    sort,
    limit: 60,
    ...(category ? { category } : {}),
  });
  const products = query.data ?? [];

  return (
    <div className="rv-browse rv-page min-h-screen">
      <style>{BROWSE_STYLES}</style>

      <TopBar
        links={[
          { href: "#", label: "Today's deals" },
          { href: "#/browse", label: "Browse" },
          { href: "#/alerts", label: "Alerts" },
        ]}
        activeHref="#/browse"
        status={products.length > 0 ? `${products.length} shown` : undefined}
        menuOpen={menuOpen}
        onToggleMenu={() => setMenuOpen((v) => !v)}
      />

      <main className="rv-browse-main">
        <button onClick={onBack} className="rv-browse-back">
          <ArrowLeft size={15} />
          <span>Back</span>
        </button>

        <h1 className="rv-browse-title">Every tracked product</h1>
        <p className="rv-browse-sub">
          Ranked by how well each price stands up to its own history &mdash; not by how many
          people liked it. The score is the measured discount against the product&rsquo;s own
          ninety-day median.
        </p>

        {/* Chips rather than a segmented control: nine options is well past
            what SegmentedControl is shaped for. */}
        <div className="rv-browse-filters" role="group" aria-label="Filter by category">
          <button
            type="button"
            onClick={() => setCategory(null)}
            className={`rv-chip${category === null ? " is-active" : ""}`}
            aria-pressed={category === null}
          >
            All
          </button>
          {CATEGORIES.map((c) => (
            <button
              key={c.slug}
              type="button"
              onClick={() => setCategory(c.slug)}
              className={`rv-chip${category === c.slug ? " is-active" : ""}`}
              aria-pressed={category === c.slug}
              title={c.hint}
            >
              {c.label}
            </button>
          ))}
        </div>

        <div className="rv-browse-sort">
          <button
            type="button"
            onClick={() => setSort("deal_score")}
            className={`rv-browse-sort-btn${sort === "deal_score" ? " is-active" : ""}`}
            aria-pressed={sort === "deal_score"}
          >
            Best scored
          </button>
          <button
            type="button"
            onClick={() => setSort("newest")}
            className={`rv-browse-sort-btn${sort === "newest" ? " is-active" : ""}`}
            aria-pressed={sort === "newest"}
          >
            Recently tracked
          </button>
        </div>

        {query.isLoading && (
          <div className="rv-browse-state">
            <Spinner size={18} />
            <p>Loading tracked products&hellip;</p>
          </div>
        )}

        {!query.isLoading && products.length === 0 && (
          <EmptyBrowse
            category={category}
            sort={sort}
            onClearCategory={() => setCategory(null)}
            onShowNewest={() => setSort("newest")}
          />
        )}

        {products.length > 0 && (
          <Panel
            label={category ? categoryLabel(category) : "All categories"}
            aside={`${products.length} product${products.length === 1 ? "" : "s"}`}
          >
            <ol className="rv-browse-list">
              {products.map((p) => (
                <li key={p.id}>
                  <BrowseRow product={p} />
                </li>
              ))}
            </ol>
          </Panel>
        )}
      </main>
    </div>
  );
}

// Both empty cases are real today and mean different things, so they get
// different copy and different actions. Notably neither silently widens the
// query — list_products deliberately refuses to substitute unrelated products
// for a filtered one, and this page holds the same line.
function EmptyBrowse({
  category,
  sort,
  onClearCategory,
  onShowNewest,
}: {
  category: CategorySlug | null;
  sort: Sort;
  onClearCategory: () => void;
  onShowNewest: () => void;
}) {
  if (category) {
    return (
      <Panel label={categoryLabel(category)}>
        <p className="rv-browse-empty-title">
          Nothing tracked in {categoryLabel(category).toLowerCase()} yet.
        </p>
        <p className="rv-browse-empty-sub">
          We&rsquo;d rather show you nothing than pad this with products from other
          categories.
        </p>
        <Button onClick={onClearCategory} variant="primary" size="sm">
          Show all categories
        </Button>
      </Panel>
    );
  }

  if (sort === "deal_score") {
    return (
      <Panel label="Nothing scored yet">
        <p className="rv-browse-empty-title">Nothing has enough history to score.</p>
        <p className="rv-browse-empty-sub">
          A score needs fourteen days of recorded prices behind it, so a freshly tracked
          product stays unscored until then. Products being tracked right now are still
          listed.
        </p>
        <Button onClick={onShowNewest} variant="primary" size="sm">
          Show recently tracked
        </Button>
      </Panel>
    );
  }

  return (
    <Panel label="Nothing tracked">
      <p className="rv-browse-empty-title">No products are being tracked yet.</p>
      <p className="rv-browse-empty-sub">
        Paste a product URL on the dashboard and it appears here from its first reading.
      </p>
      <Button as="a" href="#" variant="primary" size="sm">
        Go to the dashboard
      </Button>
    </Panel>
  );
}

function BrowseRow({ product }: { product: Product }) {
  const currency = product.currency ?? "USD";
  const delta = product.stats?.discount_vs_median_pct ?? null;
  const coverage = product.stats?.coverage_days ?? 0;

  return (
    <a href={`#/product/${product.id}`} className="rv-brow">
      <ProductImage
        image={productImage(product.image_url, product.title ?? product.domain)}
        ratio="1 / 1"
        className="rv-brow-thumb"
      />

      <span className="rv-brow-names">
        <span className="rv-brow-title">{product.title ?? product.domain}</span>
        <span className="rv-brow-meta rv-num">
          {product.domain}
          {product.category && ` · ${categoryLabel(product.category)}`}
        </span>
      </span>

      <span className="rv-brow-price rv-num">
        {product.latest_price != null ? formatMoney(product.latest_price, currency) : "—"}
      </span>

      <span className="rv-brow-delta">
        <Delta pct={delta} size="md" />
      </span>

      <span className="rv-brow-score">
        {product.deal_score != null ? (
          <b className="rv-brow-score-v rv-num">{Math.round(product.deal_score)}</b>
        ) : (
          // Say why there is no score rather than showing a dash.
          <Stamp tone="quiet">{Math.max(0, 14 - coverage)}d</Stamp>
        )}
        {product.is_lowest_ever && <Stamp tone="signal">Lowest</Stamp>}
      </span>
    </a>
  );
}

const BROWSE_STYLES = `
  .rv-browse { background: var(--paper); color: var(--ink); font-family: var(--font-sans); }
  .rv-browse-main { max-width: 1080px; margin: 0 auto; padding: 26px 24px 88px; }

  .rv-browse-back {
    display: inline-flex; align-items: center; gap: 8px; background: none; cursor: pointer;
    font-size: 13.5px; font-weight: 500; color: var(--ink-muted); padding: 4px 0; margin-bottom: 28px;
    transition: color var(--dur-fast) ease;
  }
  .rv-browse-back:hover { color: var(--ink); }

  .rv-browse-title { margin: 0; font-size: clamp(28px, 3.6vw, 40px); font-weight: 700; letter-spacing: -0.03em; }
  .rv-browse-sub { margin: 12px 0 0; font-size: 15px; line-height: 1.6; color: var(--ink-muted); max-width: 62ch; }

  .rv-browse-filters { display: flex; flex-wrap: wrap; gap: 8px; margin: 28px 0 14px; }
  .rv-chip {
    padding: 7px 13px; border-radius: var(--r-pill); border: 1px solid var(--rule-strong);
    font-size: 13px; font-weight: 500; color: var(--ink-muted); background: var(--paper);
    cursor: pointer; transition: border-color var(--dur-fast) ease, color var(--dur-fast) ease,
      background-color var(--dur-fast) ease;
  }
  .rv-chip:hover { border-color: var(--ink); color: var(--ink); }
  .rv-chip.is-active { background: var(--ink); border-color: var(--ink); color: var(--paper); }

  .rv-browse-sort { display: flex; gap: 16px; margin-bottom: 26px; }
  .rv-browse-sort-btn {
    background: none; cursor: pointer; padding: 4px 0; font-size: 13px; font-weight: 500;
    color: var(--ink-fade); border-bottom: 2px solid transparent;
    transition: color var(--dur-fast) ease, border-color var(--dur-fast) ease;
  }
  .rv-browse-sort-btn:hover { color: var(--ink); }
  .rv-browse-sort-btn.is-active { color: var(--ink); border-bottom-color: var(--ink); }

  .rv-browse-state {
    display: flex; flex-direction: column; align-items: center; gap: 12px;
    padding: 72px 0; color: var(--ink-muted);
  }
  .rv-browse-empty-title { margin: 0 0 8px; font-size: 17px; font-weight: 600; color: var(--ink); }
  .rv-browse-empty-sub { margin: 0 0 18px; font-size: 14px; line-height: 1.6; color: var(--ink-muted); max-width: 56ch; }

  .rv-browse-list { list-style: none; margin: 0; padding: 0; }
  .rv-browse-list > li { border-bottom: 1px solid var(--rule); }
  .rv-browse-list > li:last-child { border-bottom: 0; }

  .rv-brow {
    display: grid; grid-template-columns: 44px minmax(0, 1fr) 108px 92px 92px;
    gap: 16px; align-items: center; padding: 14px 0; text-decoration: none;
  }
  .rv-brow-thumb { width: 44px; height: 44px; border-radius: var(--img-radius); box-shadow: var(--img-ring); }
  .rv-brow-names { display: flex; flex-direction: column; gap: 3px; min-width: 0; }
  .rv-brow-title {
    font-size: 14.5px; font-weight: 600; color: var(--ink); letter-spacing: -0.01em;
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  }
  .rv-brow:hover .rv-brow-title { text-decoration: underline; text-underline-offset: 3px; }
  .rv-brow-meta { font-size: 11.5px; color: var(--ink-muted); }
  .rv-brow-price { text-align: right; font-size: 15px; font-weight: 600; }
  .rv-brow-delta { display: flex; justify-content: flex-end; }
  .rv-brow-score { display: flex; flex-direction: column; align-items: flex-end; gap: 5px; }
  .rv-brow-score-v { font-size: 20px; font-weight: 600; letter-spacing: -0.02em; }

  @media (max-width: 760px) {
    .rv-browse-main { padding: 20px 18px 64px; }
    .rv-brow {
      grid-template-columns: 44px minmax(0, 1fr) auto;
      grid-template-areas: "thumb names names" "price delta score";
      gap: 12px;
    }
    .rv-brow-thumb { grid-area: thumb; }
    .rv-brow-names { grid-area: names; }
    .rv-brow-price { grid-area: price; text-align: left; }
    .rv-brow-delta { grid-area: delta; justify-content: flex-start; }
    .rv-brow-score { grid-area: score; flex-direction: row; align-items: center; }
    .rv-brow-title { white-space: normal; overflow: visible; }
  }
`;
