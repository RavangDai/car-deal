// frontend/src/chartView.ts
// User-adjustable chart view, persisted so a preference survives a reload.
//
// Deliberately small: a view setting is a preference, not server state, so it
// lives in localStorage rather than TanStack Query.
import { useCallback, useState } from "react";

export type ChartView = "line" | "bars" | "table";

export type ChartPrefs = {
  view: ChartView;
  /** The dashed 90-day median datum. */
  showMedian: boolean;
  /** The green fill between the price line and the median. */
  showBand: boolean;
  /** The lowest-ever marker and its drop line. */
  showLowest: boolean;
};

export const DEFAULT_CHART_PREFS: ChartPrefs = {
  view: "line",
  showMedian: true,
  showBand: true,
  showLowest: true,
};

const KEY = "wic:chart-prefs";

function read(): ChartPrefs {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULT_CHART_PREFS;
    const parsed = JSON.parse(raw) as Partial<ChartPrefs>;
    // Merge over the defaults so a stored blob from an older shape can't
    // leave a field undefined and silently switch an overlay off.
    return {
      view: parsed.view === "bars" || parsed.view === "table" ? parsed.view : "line",
      showMedian: parsed.showMedian !== false,
      showBand: parsed.showBand !== false,
      showLowest: parsed.showLowest !== false,
    };
  } catch {
    // Private mode, disabled storage, corrupt JSON — never break the chart
    // over a preference.
    return DEFAULT_CHART_PREFS;
  }
}

export function useChartPrefs() {
  // Lazy initializer, not a mount effect: this is a client-only SPA with no
  // SSR to hydrate against, so reading storage once up front is both correct
  // and avoids a second render that would flash the default view first.
  const [prefs, setPrefs] = useState<ChartPrefs>(read);

  const update = useCallback((patch: Partial<ChartPrefs>) => {
    setPrefs((prev) => {
      const next = { ...prev, ...patch };
      try {
        localStorage.setItem(KEY, JSON.stringify(next));
      } catch {
        // Preference just won't persist; the session still honours it.
      }
      return next;
    });
  }, []);

  return { prefs, update };
}
