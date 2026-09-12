// frontend/src/ui/ProductCard.tsx
//
// One product tile, used by the homepage feed and the watch list. What it is
// ALLOWED to claim about a price lives in ../dealClaims.ts, not here — this
// file renders a decision it does not make.
//
// Two structural notes:
//
//  * The whole card is not an <a>. The mockup's card wraps everything in a
//    link and puts buttons inside it, which is invalid HTML and makes the
//    buttons swallow the link. Here the title carries the anchor and it is
//    stretched over the card with ::after; the save button and the CTA sit
//    above it on z-index and stay independently clickable.
//  * The image uses object-fit: contain on a pale plate. `image_url` is an
//    arbitrary hotlinked third-party URL with no proxy, resize or srcset, so
//    aspect ratios are unpredictable; `cover` crops products out of frame.
import type { Product } from "../api";
import { badgeFor, comparisonFor, deriveClaim } from "../dealClaims";
import { formatMoney } from "../format";
import { productImage } from "../images";
import { ProductImage } from "../ProductImage";
import { Heart } from "../icons";

export function ProductCard({
  product,
  saved,
  onToggleSave,
  meta,
}: {
  product: Product;
  /** Omit onToggleSave entirely to render no save control. */
  saved?: boolean;
  onToggleSave?: (p: Product) => void;
  /** Extra line under the price — e.g. a watch's alert rule. */
  meta?: React.ReactNode;
}) {
  const href = `#/product/${product.id}`;
  // `title` is nullable. The domain is real information; "Untitled product"
  // is not, so fall back to the store.
  const name = product.title ?? product.domain;
  const currency = product.currency ?? "USD";
  const price = product.latest_price;

  const claim = deriveClaim(product);
  const badge = badgeFor(claim);
  const comparison = comparisonFor(claim);

  return (
    <article className="rv-pcard">
      <div className="rv-pcard-shot">
        <ProductImage
          image={productImage(product.image_url, name)}
          ratio="4 / 3"
          className="rv-pcard-img"
        />

        {badge && (
          <span className={`rv-pcard-badge rv-pcard-badge-${badge.tone}`}>{badge.label}</span>
        )}

        {onToggleSave && (
          <button
            type="button"
            className="rv-pcard-save"
            aria-pressed={!!saved}
            onClick={() => onToggleSave(product)}
          >
            <Heart className="rv-pcard-save-icon" />
            <span className="rv-sr-only">
              {saved ? `Stop tracking ${name}` : `Track ${name}`}
            </span>
          </button>
        )}
      </div>

      <div className="rv-pcard-body">
        <h3 className="rv-pcard-title">
          {/* Stretched link — see .rv-pcard-link::after. */}
          <a className="rv-pcard-link" href={href}>{name}</a>
        </h3>

        <p className="rv-pcard-store">{product.domain}</p>

        <div className="rv-pcard-prices">
          <span className="rv-pcard-now rv-num">
            {price != null ? formatMoney(price, currency) : "—"}
          </span>
          {comparison && (
            <>
              <s className="rv-pcard-was rv-num">{formatMoney(comparison.usual, currency)}</s>
              <span className="rv-pcard-save-amt rv-num">
                Save {formatMoney(comparison.saving, currency)}
              </span>
            </>
          )}
        </div>

        {meta && <p className="rv-pcard-meta">{meta}</p>}

        <div className="rv-pcard-actions">
          <a className="rv-pcard-cta" href={href}>View deal</a>
        </div>
      </div>
    </article>
  );
}

export const PRODUCT_CARD_STYLES = `
  /* ---- Product card --------------------------------------------------
     A white card on a #F6F8F7 page is only 1.07:1 against its ground, so
     the border is not decoration — it IS the card's edge. Never drop it. */
  .rv-pcard {
    position: relative;
    display: flex; flex-direction: column;
    background: var(--paper);
    border: 1px solid var(--rule);
    border-radius: var(--r-card);
    overflow: hidden;
    transition: box-shadow var(--dur-fast) var(--ease-out-soft),
                transform var(--dur-fast) var(--ease-out-soft);
  }
  .rv-pcard:hover { box-shadow: var(--shadow-md); transform: translateY(-2px); }

  .rv-pcard-shot { position: relative; background: var(--plate); }
  /* contain, not cover: hotlinked third-party images have unpredictable
     aspect ratios and cover crops the product out of its own photo. */
  .rv-pcard-img img { object-fit: contain; padding: 12px; }

  .rv-pcard-badge {
    position: absolute; top: 10px; left: 10px; z-index: 2;
    display: inline-flex; align-items: center;
    border-radius: var(--r-pill);
    padding: 4px 10px;
    font-size: 12px; font-weight: 600; line-height: 1.3;
    white-space: nowrap;
  }
  /* Mint fill, navy label — 13.5:1. Mint can never be the text itself. */
  .rv-pcard-badge-signal { background: var(--mint); color: var(--navy); }
  .rv-pcard-badge-quiet  { background: var(--paper); color: var(--ink-fade);
                           box-shadow: inset 0 0 0 1px var(--rule); }

  .rv-pcard-save {
    position: absolute; top: 10px; right: 10px; z-index: 3;
    width: 32px; height: 32px;
    display: inline-flex; align-items: center; justify-content: center;
    border: 1px solid var(--rule); border-radius: var(--r-pill);
    background: var(--paper); color: var(--ink-muted);
    cursor: pointer;
    transition: color var(--dur-fast) var(--ease-out-soft),
                border-color var(--dur-fast) var(--ease-out-soft);
  }
  .rv-pcard-save:hover { color: var(--ink); border-color: var(--rule-strong); }
  .rv-pcard-save[aria-pressed="true"] { color: var(--green); border-color: var(--green); }
  .rv-pcard-save-icon { width: 16px; height: 16px; display: block; }

  .rv-pcard-body {
    position: relative;
    display: flex; flex-direction: column;
    gap: 4px; padding: 14px 14px 16px;
    flex: 1;
  }

  .rv-pcard-title {
    margin: 0;
    font-family: var(--font-display);
    font-size: 15px; font-weight: 700; line-height: 1.32;
    letter-spacing: -0.01em;
    color: var(--ink);
    /* Two lines, so every card in a row has the same title block height
       and the prices below them stay on one baseline. */
    display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;
    overflow: hidden;
    min-height: calc(2 * 1.32em);
  }
  .rv-pcard-link { color: inherit; text-decoration: none; }
  /* Covers the card without nesting interactive elements inside an anchor.
     The save button and CTA carry a higher z-index and stay clickable. */
  .rv-pcard-link::after { content: ""; position: absolute; inset: 0; z-index: 1; }

  .rv-pcard-store {
    margin: 0; font-size: 12.5px; color: var(--ink-fade);
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  }

  .rv-pcard-prices {
    display: flex; align-items: baseline; flex-wrap: wrap; gap: 8px;
    margin-top: 6px;
  }
  .rv-pcard-now {
    font-family: var(--font-display);
    font-size: 21px; font-weight: 800; letter-spacing: -0.02em;
    color: var(--ink);
  }
  .rv-pcard-was { font-size: 13.5px; color: var(--ink-fade); }
  .rv-pcard-save-amt {
    border-radius: var(--r-pill);
    background: var(--green); color: #fff;
    padding: 3px 9px;
    font-size: 12px; font-weight: 700;
  }

  .rv-pcard-meta { margin: 2px 0 0; font-size: 12.5px; color: var(--ink-muted); }

  .rv-pcard-actions { margin-top: auto; padding-top: 12px; position: relative; z-index: 2; }
  .rv-pcard-cta {
    display: block; width: 100%;
    border-radius: 10px;
    background: var(--mint); color: var(--navy);
    padding: 10px 14px;
    font-family: var(--font-sans);
    font-size: 14px; font-weight: 700; text-align: center; text-decoration: none;
    transition: background-color var(--dur-fast) var(--ease-out-soft);
  }
  .rv-pcard-cta:hover { background: var(--mint-deep); }

  /* ---- The grid ------------------------------------------------------ */
  .rv-pgrid {
    display: grid; gap: 18px;
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }
  @media (max-width: 1180px) { .rv-pgrid { grid-template-columns: repeat(3, minmax(0, 1fr)); } }
  @media (max-width: 900px)  { .rv-pgrid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
  @media (max-width: 560px)  { .rv-pgrid { grid-template-columns: minmax(0, 1fr); gap: 14px; } }

  .rv-sr-only {
    position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px;
    overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; border: 0;
  }

  @media (prefers-reduced-motion: reduce) {
    .rv-pcard, .rv-pcard-cta, .rv-pcard-save { transition: none; }
    .rv-pcard:hover { transform: none; }
  }
`;
