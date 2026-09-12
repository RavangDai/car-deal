// src/images.ts
// Product imagery is real, per-product data (Product.image_url from the API,
// a hotlinked source photo), never curated stock photography. This module
// holds the shared image type and the placeholder shown when a product has
// no photo or its photo fails to load.
//
// The placeholder is CATEGORY-AWARE. That matters more than it sounds:
// demo rows used to carry `picsum.photos/seed/<slug>` URLs, which return a
// real but topically unrelated photo per product — a street cat on a
// cookware card, a landscape on a headset card. A branded glyph that says
// "kitchen" is more honest than a photograph of the wrong thing, and it
// costs no network request.

export type ImageAsset = { src: string; alt: string };

// Palette is inlined rather than tokenised: a data: URI has no access to the
// document's custom properties. Keep these in step with theme.css by hand —
// --plate, --ink-fade and --mint respectively.
const PLATE = "#F4F5F7";
const LINE = "#52627A";
const ACCENT = "#A8F0CB";

/** 24x24 line glyphs, drawn centred and scaled into the 400x300 plate. */
const GLYPHS: Record<string, string> = {
  // laptop
  electronics:
    '<rect x="3" y="5" width="18" height="11" rx="1.5"/><path d="M2 19h20"/>',
  // saucepan
  kitchen:
    '<path d="M4 10h13v6a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3z"/><path d="M17 12h3a1.5 1.5 0 0 1 0 3h-3"/><path d="M7 7V5M11 7V4M15 7V5"/>',
  // controller
  gaming:
    '<rect x="2" y="8" width="20" height="10" rx="5"/><path d="M7 11v4M5 13h4M16 12h.01M18.5 14.5h.01"/>',
  // house
  home: '<path d="M4 11 12 4l8 7"/><path d="M6 10v9h12v-9"/><path d="M10 19v-5h4v5"/>',
  // t-shirt
  fashion:
    '<path d="M8 4 4 6l2 4 2-1v10h8V9l2 1 2-4-4-2-2 2h-4z"/>',
  // dumbbell
  fitness:
    '<path d="M4 8v8M7 6v12M17 6v12M20 8v8M7 12h10"/>',
  // bottle
  beauty:
    '<path d="M10 3h4v3l2 3v11H8V9l2-3z"/><path d="M8 13h8"/>',
  // wrench
  tools:
    '<path d="M14.7 6.3a4 4 0 0 0 5 5L21 10l-7 7-1.3 3.7-2.4-2.4L14 17l-7 7-3-3 7-7-1.3-2.3 2.4-2.4L14.7 6.3z"/>',
  // plain box
  default:
    '<path d="M4 8.5 12 4l8 4.5v7L12 20l-8-4.5z"/><path d="M4 8.5 12 13l8-4.5M12 13v7"/>',
};

function placeholderFor(category: string | null | undefined): string {
  const key = category && GLYPHS[category] ? category : "default";
  return (
    '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300" viewBox="0 0 400 300">' +
    `<rect width="400" height="300" fill="${PLATE}"/>` +
    // A soft mint disc, so the placeholder reads as part of the brand rather
    // than as a broken image.
    `<circle cx="200" cy="150" r="66" fill="${ACCENT}" opacity="0.34"/>` +
    '<g transform="translate(200 150) scale(3.2) translate(-12 -12)" ' +
    `fill="none" stroke="${LINE}" stroke-width="1.6" ` +
    'stroke-linecap="round" stroke-linejoin="round">' +
    GLYPHS[key] +
    "</g></svg>"
  );
}

/** Cached so a grid of 12 cards does not re-encode the same SVG 12 times. */
const cache = new Map<string, ImageAsset>();

function asset(category: string | null | undefined, alt: string): ImageAsset {
  const key = category && GLYPHS[category] ? category : "default";
  let hit = cache.get(key);
  if (!hit) {
    hit = {
      src: `data:image/svg+xml,${encodeURIComponent(placeholderFor(key))}`,
      alt: "",
    };
    cache.set(key, hit);
  }
  // alt varies per product, the src does not.
  return { src: hit.src, alt };
}

/** The generic placeholder, for callers with no category to hand. */
export const placeholderImage: ImageAsset = asset(
  null,
  "No photo available for this product",
);

/**
 * A product's real photo, or a category-appropriate placeholder.
 *
 * `category` is optional because `Product.category` is nullable — it stays
 * NULL permanently when no classifier key is configured — so the generic
 * glyph has to remain a valid outcome, not an error path.
 */
export function productImage(
  src: string | null | undefined,
  alt: string,
  category?: string | null,
): ImageAsset {
  return src ? { src, alt } : asset(category, alt || "No photo available for this product");
}
