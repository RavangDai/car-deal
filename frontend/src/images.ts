// frontend/src/images.ts
// Single manifest for the site's car photography. Swap-safe, two ways:
//   1. Quick: drop an already-optimized replacement into frontend/public/cars/
//      keeping the same filename.
//   2. From a raw photo: drop it into frontend/design-assets/carimages/ (NOT
//      public/ — raw multi-MB files must never ship), add/adjust a JOBS entry in
//      scripts/optimize-images.mjs, then run `node scripts/optimize-images.mjs`.
//
// Every asset here is an optimized WebP generated from the user's raw photos.
// Alt text is part of the voice — describe the actual car, not "car image".

export type ImageAsset = { src: string; alt: string };

export const IMAGES = {
  // Hero — candy-red '65 Mustang in sunlit pines. Red ties to the brand accent.
  heroFeature: {
    src: "/cars/hero-mustang.webp",
    alt: "Candy-red 1965 Ford Mustang coupe parked among sunlit pines",
  },
  // Cinematic full-bleed CTA band — golden-hour Challenger in the mountains.
  bandFeature: {
    src: "/cars/band-challenger.webp",
    alt: "Hemi-orange 1970 Dodge Challenger R/T on a mountain road at golden hour",
  },
  // Login brand panel — silver '67 Mustang on a city street (portrait).
  loginFeature: {
    src: "/cars/login-mustang.webp",
    alt: "Silver 1967 Ford Mustang on a European city street in afternoon light",
  },
  // Supporting detail — chrome dual-headlight close-up (portrait).
  detailChrome: {
    src: "/cars/detail-chrome.webp",
    alt: "Chrome dual-headlight and grille detail of a classic American coupe",
  },
} as const satisfies Record<string, ImageAsset>;

// Representative thumbnails used in compact rows (hero spotlight, table, etc.).
// These stand in for per-listing photos the sample/live data doesn't carry.
export const THUMBS: ImageAsset[] = [
  { src: "/cars/thumb-mustang.webp", alt: "Red 1965 Ford Mustang" },
  { src: "/cars/thumb-silver.webp", alt: "Silver 1967 Ford Mustang" },
  { src: "/cars/thumb-challenger.webp", alt: "Orange 1970 Dodge Challenger" },
  { src: "/cars/thumb-chrome.webp", alt: "Chrome grille detail of a classic coupe" },
];

// Deterministic thumbnail for a row index, so the same listing always shows the
// same photo across renders.
export const thumbFor = (i: number): ImageAsset => THUMBS[i % THUMBS.length];
