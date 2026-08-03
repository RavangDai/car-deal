// frontend/src/chartHooks.ts
// Hover behaviour for the charts, kept out of the file that renders them.
//
// An SVG chart on a page IS interactive, so a hover read-out is the default
// here rather than an extra: every chart in this app except the index-row
// sparklines ships one. Sparklines are excluded on purpose — at 132×34 with
// two dozen on screen they are a glance mark, and a tooltip on each would
// turn a quiet index into a minefield.
import { useCallback, useRef, useState, type ReactNode } from "react";

export type HoverState = { x: number; y: number; content: ReactNode } | null;

/**
 * Per-mark hover for bar/segment/cell charts. Marks report their own centre
 * as a percentage of the plot box, so the tooltip positions correctly
 * regardless of how the SVG is scaled by its viewBox.
 */
export function useMarkHover() {
  const [hover, setHover] = useState<HoverState>(null);
  const show = useCallback((x: number, y: number, content: ReactNode) => {
    setHover({ x, y, content });
  }, []);
  const hide = useCallback(() => setHover(null), []);
  return { hover, show, hide };
}

/**
 * Crosshair hover for a continuous series. Converts a pointer position into
 * a viewBox x, so callers can snap to the nearest real observation
 * themselves — this never interpolates a price that was not recorded.
 * `vx` is null once the pointer leaves.
 */
export function usePointerTrack(viewBoxWidth: number) {
  const ref = useRef<SVGSVGElement | null>(null);
  const [vx, setVx] = useState<number | null>(null);

  const onMove = useCallback(
    (e: React.PointerEvent<SVGSVGElement>) => {
      const el = ref.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      if (r.width === 0) return;
      setVx(((e.clientX - r.left) / r.width) * viewBoxWidth);
    },
    [viewBoxWidth]
  );

  const onLeave = useCallback(() => setVx(null), []);

  return { ref, vx, onMove, onLeave };
}
