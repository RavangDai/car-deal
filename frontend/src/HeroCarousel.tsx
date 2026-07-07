// frontend/src/HeroCarousel.tsx
// The hero IS the carousel: full-viewport slides (not a small floating
// widget) auto-advance through today's top deals, each one a real tracked
// product's own photo with its price, deal score, and a live sparkline of
// its actual price history — "the math attached," not just a picture.
// Persistent headline/CTA content (passed as `children`) overlays every
// slide so the paste-URL input never leaves the screen while slides change.
import { type ReactNode, useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { ProductImage } from "./ProductImage";
import { Sparkline } from "./charts";
import type { ImageAsset } from "./images";

export type HeroSlide = {
  id: string;
  title: string;
  domain: string;
  image: ImageAsset;
  priceLabel: string;
  median90dLabel: string | null;
  dealScore: number | null;
  isLowestEver: boolean;
  historyPoints: { t: string; price: number }[];
};

const AUTO_ADVANCE_MS = 6500;
const EASE_OUT_EXPO: [number, number, number, number] = [0.16, 1, 0.3, 1];

export default function HeroCarousel({
  slides,
  onSlideClick,
  children,
}: {
  slides: HeroSlide[];
  onSlideClick?: (id: string) => void;
  children?: ReactNode;
}) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const reduce = useReducedMotion();

  useEffect(() => {
    if (paused || reduce || slides.length <= 1) return;
    const t = setInterval(() => setIndex((i) => (i + 1) % slides.length), AUTO_ADVANCE_MS);
    return () => clearInterval(t);
  }, [paused, reduce, slides.length]);

  useEffect(() => {
    if (index >= slides.length) setIndex(0);
  }, [slides.length, index]);

  if (slides.length === 0) {
    // No product has enough history for a deal score yet (fresh installs,
    // or every tracked product is still under the 14-day coverage gate) —
    // the headline/CTA in `children` must keep showing rather than the
    // whole hero vanishing, so fall back to a plain gradient backdrop.
    return (
      <div className="wic-hero-carousel wic-hero-carousel-empty">
        <style>{CAROUSEL_STYLES}</style>
        <div className="wic-hero-overlay">{children}</div>
      </div>
    );
  }
  const slide = slides[Math.min(index, slides.length - 1)];

  return (
    <div
      className="wic-hero-carousel"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <style>{CAROUSEL_STYLES}</style>

      <AnimatePresence mode="wait">
        <motion.div
          key={slide.id}
          className="wic-hero-slide-bg"
          initial={reduce ? false : { opacity: 0, scale: 1.045 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={reduce ? undefined : { opacity: 0 }}
          transition={{ duration: 1.1, ease: EASE_OUT_EXPO }}
        >
          <ProductImage
            image={slide.image}
            eager
            position="center"
            className="wic-hero-slide-img"
            sizes="100vw"
          />
        </motion.div>
      </AnimatePresence>
      <div className="wic-hero-scrim" aria-hidden />

      <div className="wic-hero-overlay">{children}</div>

      <button
        type="button"
        className="wic-hero-slide-card"
        onClick={() => onSlideClick?.(slide.id)}
      >
        <div className="wic-hero-slide-head">
          <span className="wic-hero-slide-domain">{slide.domain}</span>
          {slide.isLowestEver && <span className="wic-hero-lowest-badge">LOWEST EVER</span>}
        </div>
        <span className="wic-hero-slide-title">{slide.title}</span>
        <div className="wic-hero-slide-price-row">
          <span className="wic-hero-slide-price tabular-nums">{slide.priceLabel}</span>
          {slide.dealScore != null && (
            <span className="wic-hero-slide-score tabular-nums">{Math.round(slide.dealScore)}/100</span>
          )}
        </div>
        {slide.median90dLabel && (
          <span className="wic-hero-slide-median tabular-nums">{slide.median90dLabel}</span>
        )}
        {slide.historyPoints.length > 1 && (
          <div className="wic-hero-slide-spark">
            <Sparkline points={slide.historyPoints} />
          </div>
        )}
      </button>

      {slides.length > 1 && (
        <div className="wic-hero-controls">
          <button
            type="button"
            onClick={() => setIndex((i) => (i - 1 + slides.length) % slides.length)}
            className="wic-hero-nav"
            aria-label="Previous product"
          >
            <ChevronLeft size={18} />
          </button>
          <div className="wic-hero-dots">
            {slides.map((s, i) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setIndex(i)}
                className={`wic-hero-dot${i === index ? " wic-hero-dot-on" : ""}`}
                aria-label={`Go to slide ${i + 1}`}
                aria-current={i === index}
              />
            ))}
          </div>
          <button
            type="button"
            onClick={() => setIndex((i) => (i + 1) % slides.length)}
            className="wic-hero-nav"
            aria-label="Next product"
          >
            <ChevronRight size={18} />
          </button>
        </div>
      )}
    </div>
  );
}

const CAROUSEL_STYLES = `
  .wic-hero-carousel {
    position: relative; isolation: isolate;
    width: 100%; min-height: 100vh; min-height: 100svh;
    overflow: hidden;
  }
  .wic-hero-carousel-empty {
    background: var(--desktop);
    background-image: repeating-linear-gradient(45deg, rgba(255,255,255,.05) 0 2px, transparent 2px 22px);
  }
  .wic-hero-slide-bg { position: absolute; inset: 0; z-index: 0; }
  .wic-hero-slide-img { width: 100%; height: 100%; border-radius: 0; box-shadow: none; }
  .wic-hero-scrim {
    position: absolute; inset: 0; z-index: 1;
    background:
      linear-gradient(180deg, rgba(10,14,26,.40) 0%, rgba(10,14,26,.10) 30%, rgba(10,14,26,.46) 64%, rgba(10,14,26,.88) 100%),
      linear-gradient(90deg, rgba(10,14,26,.50) 0%, rgba(10,14,26,.12) 48%, rgba(10,14,26,0) 76%);
  }

  .wic-hero-overlay {
    position: relative; z-index: 2;
    min-height: 100vh; min-height: 100svh;
    display: flex; align-items: center;
    max-width: 1180px; margin: 0 auto;
    padding: 116px 24px 120px;
  }

  /* Per-slide info card — floats bottom-right, reads like a real product card */
  .wic-hero-slide-card {
    position: absolute; z-index: 2; right: 24px; bottom: 96px;
    width: min(300px, calc(100vw - 48px));
    display: flex; flex-direction: column; gap: 6px;
    text-align: left; cursor: pointer;
    background: var(--paper);
    border-top: var(--bevel-width) solid var(--bevel-hi); border-left: var(--bevel-width) solid var(--bevel-hi);
    border-right: var(--bevel-width) solid var(--bevel-lo); border-bottom: var(--bevel-width) solid var(--bevel-lo);
    padding: 16px 18px;
    box-shadow: var(--shadow-xl);
    transition: transform .15s var(--ease-out-expo);
  }
  .wic-hero-slide-card:hover { transform: translateY(-2px); }
  .wic-hero-slide-card:active { transform: translate(1px, 1px); }
  .wic-hero-slide-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
  .wic-hero-slide-domain { font-size: 11px; font-weight: 600; color: var(--ink-muted); text-transform: uppercase; letter-spacing: 0.05em; }
  .wic-hero-lowest-badge {
    font-size: 9.5px; font-weight: 800; letter-spacing: 0.04em;
    color: #fff; background: var(--green-deep, var(--green)); padding: 2px 7px; border-radius: 999px;
    white-space: nowrap;
  }
  .wic-hero-slide-title {
    font-size: 15px; font-weight: 700; line-height: 1.25;
    display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
  }
  .wic-hero-slide-price-row { display: flex; align-items: baseline; gap: 10px; margin-top: 2px; }
  .wic-hero-slide-price { font-size: 20px; font-weight: 800; letter-spacing: -0.01em; }
  .wic-hero-slide-score { font-size: 12px; font-weight: 700; color: var(--primary); }
  .wic-hero-slide-median { font-size: 11.5px; color: var(--ink-muted); }
  .wic-hero-slide-spark { margin-top: 4px; }

  .wic-hero-controls {
    position: absolute; z-index: 2; left: 50%; bottom: 28px; transform: translateX(-50%);
    display: flex; align-items: center; gap: 14px;
  }
  .wic-hero-nav {
    width: 34px; height: 34px; border-radius: 999px; flex-shrink: 0;
    display: inline-flex; align-items: center; justify-content: center;
    background: rgba(255,255,255,.12); color: #fff;
    border: 1px solid rgba(255,255,255,.3);
    transition: background-color .15s ease, transform .2s var(--ease-out-expo);
  }
  .wic-hero-nav:hover { background: rgba(255,255,255,.22); transform: scale(1.06); }
  .wic-hero-dots { display: flex; gap: 7px; }
  .wic-hero-dot { width: 7px; height: 7px; border-radius: 999px; background: rgba(255,255,255,.4); transition: width .2s var(--ease-out-expo), background-color .2s ease; }
  .wic-hero-dot-on { width: 22px; background: #fff; }

  @media (max-width: 900px) {
    .wic-hero-overlay { padding: 100px 20px 260px; }
    .wic-hero-slide-card { right: 20px; left: 20px; width: auto; bottom: 84px; }
  }

  @media (prefers-reduced-motion: reduce) {
    .wic-hero-nav, .wic-hero-dot, .wic-hero-slide-card { transition: none !important; }
  }
`;
