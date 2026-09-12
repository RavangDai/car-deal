// frontend/src/ProductFan.tsx
// The landing page's product showcase: real tracked products, fanned like
// a hand of cards, driven by GSAP.
//
// Adapted from a generic image-carousel pattern, with three changes that
// matter here:
//   1. Cards carry DATA, not just a photo. A fan of anonymous product shots
//      proves nothing; the point of this product is the figure under the
//      photo, so price, delta and score ride on every card.
//   2. Below 768px the fan is abandoned entirely for a snap-scroll row.
//      A ±30rem fan cannot be made to work on a 390px viewport — shrinking
//      it just produces a pile. Different problem, different layout.
//   3. Nothing is hidden by CSS. If GSAP never runs, the cards are still
//      laid out and readable.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { gsap } from "gsap";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { Product } from "./api";
import { ProductImage } from "./ProductImage";
import { productImage } from "./images";
import { formatMoney } from "./format";
import { Delta } from "./primitives";
import { prefersReducedMotion } from "./motion";

const MAX_VISIBLE = 7;
const HALF = 3;
const MOBILE_BP = 768;

// Slot geometry for a full seven-card fan. Index 3 is the centre.
const FAN_POSITIONS = [
  { rot: -21, scale: 0.776, x: -30, y: 7.3, zIndex: 1 },
  { rot: -14, scale: 0.850, x: -22, y: 4.0, zIndex: 2 },
  { rot: -7, scale: 0.935, x: -11, y: 1.3, zIndex: 3 },
  { rot: 0, scale: 1.0, x: 0, y: 0.0, zIndex: 10 },
  { rot: 7, scale: 0.935, x: 11, y: 1.3, zIndex: 3 },
  { rot: 14, scale: 0.850, x: 22, y: 4.0, zIndex: 2 },
  { rot: 21, scale: 0.776, x: 30, y: 7.3, zIndex: 1 },
];

// Outermost slot sits at ±30rem before scaling; that is the number the
// spread has to be solved against.
const MAX_SLOT_X_REM = 30;
// Vertical descent is damped: at full strength the outer cards drop out of
// the layout box, and growing the box to fit just leaves a hole under the
// centre card.
const Y_DAMP = 0.58;

// Derived from the CONTAINER, not the window. A window-width breakpoint
// table cannot know that this fan sits inside a 1180px text measure with
// gutters, which is exactly how the outer cards ended up clipped at both
// screen edges.
function spreadMultiplier(containerWidth: number, cardWidth: number) {
  const rem = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
  const halfRoom = containerWidth / 2 - cardWidth / 2 - 8;
  return Math.max(0.3, Math.min(1, halfRoom / (MAX_SLOT_X_REM * rem)));
}

function slotConfig(total: number, slot: number) {
  if (total >= MAX_VISIBLE) return FAN_POSITIONS[slot];
  // Fewer than seven products: derive a proportional fan rather than
  // leaving gaps where slots 0..n would have been.
  const centre = total >> 1;
  const d = total > 1 ? (slot - centre) / Math.max(centre, 1) : 0;
  const ad = Math.abs(d);
  return {
    rot: d * 21,
    scale: 1.0 - 0.224 * ad * ad,
    x: d * 30,
    y: ad * ad * 7.3,
    zIndex: 10 - Math.abs(slot - centre),
  };
}

export function ProductFan({ products }: { products: Product[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const animating = useRef(false);
  const entered = useRef(false);
  const directionRef = useRef<"left" | "right" | null>(null);
  const prevVisible = useRef<Set<number>>(new Set());

  const total = products.length;
  const paginated = total > MAX_VISIBLE;
  const [centre, setCentre] = useState(paginated ? HALF : total >> 1);
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== "undefined" && window.innerWidth < MOBILE_BP,
  );

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < MOBILE_BP);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const visibleMap = useCallback(
    (c: number) => {
      const map = new Map<number, number>();
      if (!paginated) {
        products.forEach((_, i) => map.set(i, i));
        return map;
      }
      for (let slot = 0; slot < MAX_VISIBLE; slot++) {
        map.set((((c + slot - HALF) % total) + total) % total, slot);
      }
      return map;
    },
    [total, paginated, products],
  );

  const cycle = useCallback(
    (direction: "left" | "right") => {
      if (animating.current || !paginated) return;
      animating.current = true;
      directionRef.current = direction;
      setCentre((p) =>
        direction === "right" ? (p + 1) % total : (p - 1 + total) % total,
      );
    },
    [total, paginated],
  );

  useEffect(() => {
    const container = containerRef.current;
    // The mobile layout is pure CSS scroll-snap — GSAP must not touch it,
    // or it leaves transforms on cards the browser is trying to scroll.
    if (!container || !total || isMobile) return;

    const cards = Array.from(
      container.querySelectorAll<HTMLElement>(".rv-fan-card"),
    );
    if (!cards.length) return;

    const reduce = prefersReducedMotion();
    const map = visibleMap(centre);
    const previously = prevVisible.current;
    const direction = directionRef.current;
    const firstMount = !entered.current;
    const mult = spreadMultiplier(container.clientWidth, cards[0].offsetWidth);
    const slots = paginated ? MAX_VISIBLE : total;
    const cfg = (slot: number) => slotConfig(slots, slot);

    if (firstMount) animating.current = true;

    let done = 0;
    const onDone = () => {
      if (++done >= map.size) {
        animating.current = false;
        if (firstMount) entered.current = true;
      }
    };

    cards.forEach((card, i) => {
      const slot = map.get(i);
      const wasVisible = previously.has(i);

      if (slot === undefined) {
        if (wasVisible) {
          const exitX = direction === "right" ? -40 : 40;
          gsap.to(card, {
            x: `${exitX}rem`,
            opacity: 0,
            scale: 0.5,
            rotation: direction === "right" ? -30 : 30,
            duration: reduce ? 0 : 0.4,
            ease: "power2.in",
            zIndex: 0,
          });
        } else {
          gsap.set(card, { opacity: 0, scale: 0.3, x: 0, y: 0, zIndex: 0 });
        }
        return;
      }

      const { x, y, rot, scale, zIndex } = cfg(slot);
      const target = {
        x: `${x * mult}rem`,
        y: `${y * Y_DAMP}rem`,
        rotation: rot,
        scale,
        opacity: 1,
        zIndex,
      };

      if (reduce) {
        gsap.set(card, target);
        onDone();
      } else if (firstMount) {
        gsap.set(card, { x: 0, y: "9rem", rotation: 0, scale: 0.6, opacity: 0 });
        gsap.to(card, {
          ...target,
          duration: 1.15,
          ease: "elastic.out(1.05,.78)",
          delay: 0.06 + slot * 0.055,
          onComplete: onDone,
        });
      } else if (!wasVisible) {
        const enterX = direction === "right" ? 40 : -40;
        gsap.set(card, {
          x: `${enterX}rem`,
          y: `${y * Y_DAMP}rem`,
          rotation: direction === "right" ? 30 : -30,
          scale: 0.5,
          opacity: 0,
        });
        gsap.to(card, { ...target, duration: 0.6, ease: "power2.out", onComplete: onDone });
      } else {
        gsap.to(card, { ...target, duration: 0.5, ease: "power2.out", onComplete: onDone });
      }
    });

    prevVisible.current = new Set(map.keys());

    if (reduce) return;

    // ── Hover: the hovered card lifts, its neighbours part around it. ──
    const entries: { el: HTMLElement; slot: number }[] = [];
    cards.forEach((el, i) => {
      const slot = map.get(i);
      if (slot !== undefined) entries.push({ el, slot });
    });
    entries.sort((a, b) => a.slot - b.slot);

    let active: number | null = null;
    let leaveTimer: ReturnType<typeof setTimeout> | null = null;
    const centreSlot = entries.length >> 1;

    const layout = (hovered: number | null) => {
      const m = spreadMultiplier(container.clientWidth, cards[0].offsetWidth);
      entries.forEach(({ el, slot }) => {
        const base = cfg(slot);
        let tx = base.x * m;
        let ty = base.y * Y_DAMP;
        let trot = base.rot;
        let tscale = base.scale;
        let delay = 0;

        if (hovered !== null) {
          const d = Math.abs(slot - hovered);
          delay = d * 0.02;
          if (slot === hovered) {
            ty -= 2.4;
            tscale *= 1.07;
          } else {
            const norm = centreSlot > 0 ? (slot - centreSlot) / centreSlot : 0;
            const push = 7 * (1 - Math.abs(norm)) * (1 + 0.2 * Math.max(0, 3 - d));
            if (slot < hovered) {
              tx -= push * m;
              trot -= 3 / (d + 1);
            } else {
              tx += push * m;
              trot += 3 / (d + 1);
            }
          }
        } else {
          delay = Math.abs(slot - centreSlot) * 0.02;
        }

        gsap.to(el, {
          x: `${tx}rem`,
          y: `${ty}rem`,
          rotation: trot,
          scale: tscale,
          duration: 0.5,
          delay,
          ease: "elastic.out(1,.75)",
          overwrite: "auto",
        });
        gsap.set(el, { zIndex: slot === hovered ? 20 : base.zIndex });
      });
    };

    const handlers = entries.map(({ el, slot }) => {
      const handler = () => {
        if (animating.current) return;
        if (leaveTimer) {
          clearTimeout(leaveTimer);
          leaveTimer = null;
        }
        if (active !== slot) {
          active = slot;
          layout(slot);
        }
      };
      el.addEventListener("mouseenter", handler);
      return { el, handler };
    });

    const onLeave = () => {
      if (animating.current) return;
      if (leaveTimer) clearTimeout(leaveTimer);
      leaveTimer = setTimeout(() => {
        active = null;
        layout(null);
      }, 50);
    };
    container.addEventListener("mouseleave", onLeave);

    const onResize = () => {
      if (!animating.current) layout(active);
    };
    window.addEventListener("resize", onResize);

    return () => {
      handlers.forEach(({ el, handler }) => el.removeEventListener("mouseenter", handler));
      container.removeEventListener("mouseleave", onLeave);
      window.removeEventListener("resize", onResize);
      if (leaveTimer) clearTimeout(leaveTimer);
    };
  }, [centre, total, visibleMap, paginated, isMobile]);

  // Leaving the fan for the scroll row (or back) must drop every inline
  // transform GSAP left behind, or the row inherits a rotated pile.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    if (isMobile) {
      gsap.set(container.querySelectorAll(".rv-fan-card"), { clearProps: "all" });
      entered.current = false;
      prevVisible.current = new Set();
    }
  }, [isMobile]);

  const cards = useMemo(
    () =>
      products.map((p) => {
        const discount =
          p.latest_price != null && p.median_90d != null && p.median_90d > 0
            ? ((p.median_90d - p.latest_price) / p.median_90d) * 100
            : null;
        return { product: p, discount };
      }),
    [products],
  );

  if (!total) return null;

  return (
    <div className={`rv-fan${isMobile ? " is-row" : ""}`}>
      <div
        ref={containerRef}
        className="rv-fan-layout"
        role="list"
        aria-label="Today's highest-scoring tracked products"
      >
        {cards.map(({ product: p, discount }) => (
          <a
            key={p.id}
            role="listitem"
            className="rv-fan-card"
            href={`#/product/${p.id}`}
            aria-label={`${p.title ?? "Product"} — ${
              p.latest_price != null ? formatMoney(p.latest_price, p.currency ?? "USD") : "price pending"
            }`}
          >
            <span className="rv-fan-card-core">
              <span className="rv-fan-card-shot">
                <ProductImage
                  image={productImage(p.image_url, p.title ?? "Tracked product")}
                  ratio="1 / 1"
                />
                {p.deal_score != null && (
                  <span className="rv-fan-card-score rv-num">
                    <b>{Math.round(p.deal_score)}</b>
                    <i>/100</i>
                  </span>
                )}
                {p.is_lowest_ever && (
                  <span className="rv-fan-card-flag">Lowest ever</span>
                )}
              </span>

              <span className="rv-fan-card-meta">
                <span className="rv-fan-card-title">{p.title ?? "Untitled product"}</span>
                <span className="rv-fan-card-domain rv-num">{p.domain}</span>
                <span className="rv-fan-card-figures">
                  <span className="rv-fan-card-price rv-num">
                    {p.latest_price != null
                      ? formatMoney(p.latest_price, p.currency ?? "USD")
                      : "—"}
                  </span>
                  <Delta pct={discount} size="sm" />
                </span>
              </span>
            </span>
          </a>
        ))}
      </div>

      {paginated && !isMobile && (
        <div className="rv-fan-nav">
          <button
            type="button"
            className="rv-fan-arrow"
            onClick={() => cycle("left")}
            aria-label="Previous products"
          >
            <ChevronLeft size={18} strokeWidth={1.8} />
          </button>
          <div className="rv-fan-dots" aria-hidden="true">
            {products.map((p, i) => (
              <span key={p.id} className={`rv-fan-dot${i === centre ? " is-on" : ""}`} />
            ))}
          </div>
          <button
            type="button"
            className="rv-fan-arrow"
            onClick={() => cycle("right")}
            aria-label="Next products"
          >
            <ChevronRight size={18} strokeWidth={1.8} />
          </button>
        </div>
      )}
    </div>
  );
}

export const PRODUCT_FAN_STYLES = `
  .rv-fan { position: relative; width: 100%; }

  /* Height must cover the card, its damped descent, AND the vertical swing
     a 21deg rotation adds at the outer slots — otherwise the fan spills
     past the section and over whatever follows it. */
  .rv-fan-layout {
    position: relative;
    display: block;
    height: 37rem;
    width: 100%;
    margin: 0 auto;
  }

  /* ── The card. The flat card lives entirely on -core; the outer element
     only positions it — it is also the GSAP transform target and must not
     carry its own visual layer for a wrapper's transform to disturb. ── */
  .rv-fan-card {
    position: absolute;
    left: 50%; top: 50%;
    width: 19rem; height: 25.5rem;
    /* Seated above centre so the fan descends INTO the box rather than
       out of the bottom of it. */
    margin-left: -9.5rem; margin-top: -15rem;
    text-decoration: none;
    /* GSAP owns transform; declaring the origin here keeps the fan pivoting
       from the bottom of the stack rather than each card's own middle. */
    transform-origin: 50% 120%;
    will-change: transform;
  }
  .rv-fan-card-core {
    display: flex; flex-direction: column; height: 100%;
    border-radius: var(--r-card);
    background: var(--paper);
    border: 1px solid var(--rule);
    box-shadow: var(--shadow-sm);
    overflow: hidden;
  }

  .rv-fan-card-shot { position: relative; display: block; }
  .rv-fan-card-shot .wicimg { width: 100%; }
  .rv-fan-card-score {
    position: absolute; top: 10px; right: 10px;
    display: inline-flex; align-items: baseline; gap: 1px;
    padding: 5px 9px; border-radius: var(--r-pill);
    background: rgba(27,26,22,.82);
    backdrop-filter: blur(8px);
    color: var(--paper);
  }
  .rv-fan-card-score b { font-size: 13px; font-weight: 600; }
  .rv-fan-card-score i { font-size: 9.5px; font-style: normal; opacity: .62; }
  .rv-fan-card-flag {
    position: absolute; left: 10px; bottom: 10px;
    font-family: var(--font-mono); font-size: 9.5px; font-weight: 600;
    text-transform: uppercase; letter-spacing: .1em;
    padding: 4px 8px; border-radius: var(--r-pill);
    background: var(--green-tint); color: var(--green-deep);
    box-shadow: inset 0 0 0 1px rgba(10,138,79,.3);
  }

  .rv-fan-card-meta {
    display: flex; flex-direction: column; gap: 5px;
    padding: 14px 15px 15px; flex: 1; min-height: 0;
  }
  .rv-fan-card-title {
    font-size: 14.5px; font-weight: 600; line-height: 1.28;
    letter-spacing: -0.015em; color: var(--ink);
    display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;
    overflow: hidden;
  }
  .rv-fan-card-domain {
    font-size: 10.5px; color: var(--ink-fade); letter-spacing: .02em;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }
  .rv-fan-card-figures {
    display: flex; align-items: baseline; justify-content: space-between;
    gap: 10px; margin-top: auto; padding-top: 8px;
    border-top: 1px solid var(--rule);
  }
  .rv-fan-card-price {
    font-size: 18px; font-weight: 600; letter-spacing: -0.02em; color: var(--ink);
  }

  /* ── Pagination ── */
  .rv-fan-nav {
    display: flex; align-items: center; justify-content: center; gap: 16px;
    margin-top: 26px; position: relative; z-index: 30;
  }
  .rv-fan-arrow {
    display: inline-flex; align-items: center; justify-content: center;
    width: 44px; height: 44px; border-radius: var(--r-pill);
    background: rgba(255,255,255,.6); color: var(--ink-muted);
    border: 1px solid var(--rule-strong); cursor: pointer;
    backdrop-filter: blur(8px);
    transition: color var(--dur-mid) var(--ease-out-soft),
                border-color var(--dur-mid) var(--ease-out-soft),
                transform var(--dur-lux) var(--ease-spring),
                box-shadow var(--dur-lux) var(--ease-spring);
  }
  .rv-fan-arrow:hover {
    color: var(--ink); border-color: var(--ink); box-shadow: var(--shadow-sm);
  }
  .rv-fan-arrow:active { transform: scale(.94); transition-duration: .08s; }
  .rv-fan-dots { display: flex; align-items: center; gap: 7px; }
  .rv-fan-dot {
    width: 6px; height: 6px; border-radius: var(--r-pill);
    background: rgba(27,26,22,.16);
    transition: background-color var(--dur-mid) var(--ease-out-soft),
                transform var(--dur-mid) var(--ease-spring);
  }
  .rv-fan-dot.is-on { background: var(--green); transform: scale(1.45); }

  @media (max-width: 1120px) {
    .rv-fan-layout { height: 33rem; }
    .rv-fan-card {
      width: 17rem; height: 23rem;
      margin-left: -8.5rem; margin-top: -13.5rem;
    }
  }

  /* ── Under 768px the fan is abandoned for a snap-scroll row. ── */
  @media (max-width: 767px) {
    .rv-fan-layout {
      height: auto;
      display: flex; gap: 14px;
      overflow-x: auto; overflow-y: hidden;
      scroll-snap-type: x mandatory;
      -webkit-overflow-scrolling: touch;
      padding: 4px var(--gutter) 18px;
      margin: 0 calc(var(--gutter) * -1);
      scrollbar-width: none;
    }
    .rv-fan-layout::-webkit-scrollbar { display: none; }
    .rv-fan-card {
      position: relative; left: auto; top: auto;
      margin: 0; flex: 0 0 15.5rem;
      width: 15.5rem; height: auto;
      scroll-snap-align: center;
      transform: none !important;
      will-change: auto;
    }
  }
`;
