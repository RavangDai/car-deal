// Fixed left "road" rail for the landing page. Section mile-markers track the
// active section; a progress fill + a car marker track scroll position. On wide
// desktop with motion enabled the marker is a real WebGL car (lazy-loaded);
// otherwise it falls back to the 2D CarSilhouette glyph. Hidden on small screens.

import { Suspense, lazy, useEffect, useState } from "react";
import { CarSilhouette } from "./CarGlyphs";

const ScrollCar = lazy(() => import("./ScrollCar"));

const SECTIONS: { id: string; label: string }[] = [
  { id: "hero", label: "Intro" },
  { id: "how", label: "How" },
  { id: "deals", label: "Deals" },
  { id: "compare", label: "Buyers" },
  { id: "cta", label: "Start" },
];

export default function ScrollRail({ activeSection }: { activeSection: string }) {
  const [progress, setProgress] = useState(0);
  // WebGL car only on wide desktop with motion enabled; otherwise the 2D fallback.
  const [enable3d] = useState(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const wide = window.matchMedia("(min-width: 1440px)").matches;
    return wide && !reduce;
  });

  useEffect(() => {
    let raf = 0;
    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        const max = document.documentElement.scrollHeight - window.innerHeight;
        setProgress(max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0);
      });
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div className="rv-rail" aria-hidden>
      <style>{RAIL_STYLES}</style>
      <div className="rv-rail-track">
        <div className="rv-rail-fill" style={{ height: `${progress * 100}%` }} />
        {SECTIONS.map((s, i) => (
          <span
            key={s.id}
            className={`rv-rail-mark ${s.id === activeSection ? "rv-rail-mark-on" : ""}`}
            style={{ top: `${(i / (SECTIONS.length - 1)) * 100}%` }}
          >
            <span className="rv-rail-dot" />
            <span className="rv-rail-label">{s.label}</span>
          </span>
        ))}
        <div className="rv-rail-car" style={{ top: `${progress * 100}%` }}>
          {enable3d ? (
            <Suspense fallback={<CarSilhouette size={40} className="rv-rail-fallback" />}>
              <ScrollCar />
            </Suspense>
          ) : (
            <CarSilhouette size={40} className="rv-rail-fallback" />
          )}
        </div>
      </div>
    </div>
  );
}

const RAIL_STYLES = `
  .rv-rail {
    position: fixed;
    left: 22px;
    top: 110px;
    bottom: 56px;
    width: 60px;
    z-index: 40;
    pointer-events: none;
    display: none;
  }
  @media (min-width: 1280px) { .rv-rail { display: block; } }

  .rv-rail-track {
    position: relative;
    height: 100%;
    width: 2px;
    margin-left: 6px;
    background: rgba(24, 19, 10, 0.18);
  }
  .rv-rail-fill {
    position: absolute;
    top: 0; left: 0;
    width: 2px;
    background: #b8312e;
    transition: height 0.1s linear;
  }
  .rv-rail-mark {
    position: absolute;
    left: 1px;
    transform: translate(-50%, -50%);
    display: flex;
    align-items: center;
    gap: 9px;
  }
  .rv-rail-dot {
    width: 7px; height: 7px;
    border-radius: 50%;
    background: #ece2cd;
    border: 1.5px solid rgba(24, 19, 10, 0.4);
    flex-shrink: 0;
    transition: background 0.25s ease, border-color 0.25s ease, transform 0.25s ease;
  }
  .rv-rail-label {
    font-family: 'JetBrains Mono', monospace;
    font-size: 9px;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: rgba(24, 19, 10, 0.45);
    white-space: nowrap;
    transition: color 0.25s ease, opacity 0.25s ease;
    opacity: 0.7;
  }
  .rv-rail-mark-on .rv-rail-dot {
    background: #b8312e;
    border-color: #b8312e;
    transform: scale(1.25);
  }
  .rv-rail-mark-on .rv-rail-label {
    color: #b8312e;
    opacity: 1;
  }

  .rv-rail-car {
    position: absolute;
    left: 1px;
    width: 54px;
    height: 54px;
    transform: translate(-50%, -50%);
    transition: top 0.1s linear;
    display: flex;
    align-items: center;
    justify-content: center;
    filter: drop-shadow(0 4px 8px rgba(24, 19, 10, 0.22));
  }
  .rv-rail-fallback { color: #b8312e; }
`;
