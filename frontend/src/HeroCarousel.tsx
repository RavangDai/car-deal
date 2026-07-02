// frontend/src/HeroCarousel.tsx
// Hero showcase: a handful of live/curated deals, each slide pairing the car
// photo with its full price/fair-value confidence rail — "the math attached,"
// not just a picture. Manual prev/next + dot navigation, spring-animated,
// non-looping (disabled at bounds).
import { useEffect, useRef, useState } from "react";
import { animate, motion, useMotionValue, useReducedMotion } from "framer-motion";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { CarImage } from "./CarImage";
import { ConfidenceRail } from "./primitives";

export type HeroLot = {
  id: string;
  title: string;
  loc: string;
  miles: string;
  price: string;
  delta: string;
  image: string;
  ciLow: number;
  ciHigh: number;
  ciFair: number;
  ciLowVal: string;
  ciHighVal: string;
  ciFairVal: string;
};

const SPRING = { type: "spring" as const, stiffness: 300, damping: 30 };

export default function HeroCarousel({ lots }: { lots: HeroLot[] }) {
  const [index, setIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const x = useMotionValue(0);
  const reduce = useReducedMotion();

  useEffect(() => {
    const width = containerRef.current?.offsetWidth || 1;
    const target = -index * width;
    if (reduce) x.set(target);
    else animate(x, target, SPRING);
  }, [index, x, reduce]);

  const atStart = index === 0;
  const atEnd = index === lots.length - 1;

  return (
    <div className="rv-carousel" role="region" aria-roledescription="carousel" aria-label="Today's top picks">
      <style>{CAROUSEL_STYLES}</style>

      <div className="rv-carousel-viewport" ref={containerRef}>
        <motion.div className="rv-carousel-track" style={{ x }}>
          {lots.map((lot) => (
            <div key={lot.id} className="rv-carousel-slide">
              <CarImage image={{ src: lot.image, alt: lot.title }} ratio="4 / 3" className="rv-carousel-thumb" />
              <div className="rv-carousel-info">
                <span className="rv-carousel-title">{lot.title}</span>
                <span className="rv-carousel-meta">{lot.loc} · {lot.miles}</span>
              </div>
              <div className="rv-carousel-price-row">
                <span className="rv-carousel-price">{lot.price}</span>
                <span className="rv-carousel-delta">{lot.delta} under market</span>
              </div>
              <ConfidenceRail
                low={lot.ciLow}
                high={lot.ciHigh}
                fair={lot.ciFair}
                lowVal={lot.ciLowVal}
                highVal={lot.ciHighVal}
                fairVal={lot.ciFairVal}
                compact
              />
            </div>
          ))}
        </motion.div>
      </div>

      <div className="rv-carousel-controls">
        <button
          type="button"
          disabled={atStart}
          onClick={() => setIndex((i) => Math.max(0, i - 1))}
          className="rv-carousel-nav"
          aria-label="Previous car"
        >
          <ChevronLeft size={16} />
        </button>
        <div className="rv-carousel-dots">
          {lots.map((lot, i) => (
            <button
              key={lot.id}
              type="button"
              onClick={() => setIndex(i)}
              className={`rv-carousel-dot${i === index ? " rv-carousel-dot-on" : ""}`}
              aria-label={`Go to slide ${i + 1}`}
              aria-current={i === index}
            />
          ))}
        </div>
        <button
          type="button"
          disabled={atEnd}
          onClick={() => setIndex((i) => Math.min(lots.length - 1, i + 1))}
          className="rv-carousel-nav"
          aria-label="Next car"
        >
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}

const CAROUSEL_STYLES = `
  .rv-carousel { width: 100%; min-width: 0; }
  .rv-carousel-viewport { width: 100%; min-width: 0; overflow: hidden; border-radius: var(--r-md); }
  .rv-carousel-track { display: flex; min-width: 0; }
  .rv-carousel-slide {
    flex: 0 0 100%; width: 100%; min-width: 0;
    display: flex; flex-direction: column; gap: 8px;
  }
  .rv-carousel-thumb { width: 100%; border-radius: var(--r-md); }
  .rv-carousel-info { display: flex; flex-direction: column; gap: 1px; min-width: 0; }
  .rv-carousel-title { font-weight: 700; font-size: 13.5px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .rv-carousel-meta { font-size: 11.5px; color: var(--ink-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .rv-carousel-price-row { display: flex; align-items: baseline; justify-content: space-between; gap: 8px; }
  .rv-carousel-price { font-weight: 800; font-size: 15px; letter-spacing: -0.01em; font-variant-numeric: tabular-nums; }
  .rv-carousel-delta { font-size: 11.5px; font-weight: 700; color: var(--green); font-variant-numeric: tabular-nums; white-space: nowrap; }

  .rv-carousel-controls { display: flex; align-items: center; justify-content: space-between; margin-top: 10px; }
  .rv-carousel-nav {
    width: 26px; height: 26px; border-radius: 999px; flex-shrink: 0;
    display: inline-flex; align-items: center; justify-content: center;
    background: var(--paper-soft); color: var(--ink-muted);
    border: 1px solid var(--rule);
    transition: color .15s ease, border-color .15s ease, transform .2s var(--ease-out-expo);
  }
  .rv-carousel-nav:hover:not(:disabled) { color: var(--ink); border-color: var(--rule-strong); transform: scale(1.08); }
  .rv-carousel-nav:disabled { opacity: .35; cursor: not-allowed; }
  .rv-carousel-dots { display: flex; gap: 6px; }
  .rv-carousel-dot { width: 6px; height: 6px; border-radius: 999px; background: var(--rule-strong); transition: width .2s var(--ease-out-expo), background-color .2s ease; }
  .rv-carousel-dot-on { width: 18px; background: var(--primary); }

  @media (prefers-reduced-motion: reduce) {
    .rv-carousel-nav, .rv-carousel-dot { transition: none !important; }
  }
`;
