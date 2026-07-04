// frontent/src/images.ts
// Product imagery is real, per-product data (Product.image_url from the API —
// either a hotlinked source photo or a seeded LoremFlickr URL), never curated
// stock photography. This module only holds the shared image type and the
// neutral placeholder shown when a product has no photo or its image fails
// to load.

export type ImageAsset = { src: string; alt: string };

// Neutral placeholder shown when a product has no photo or the hotlinked
// source image fails to load. Inline SVG so it never makes a request and
// never flashes a broken-image icon.
const PLACEHOLDER_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300" viewBox="0 0 400 300">' +
  '<rect width="400" height="300" fill="#f1f5f9"/>' +
  '<g fill="none" stroke="#cbd5e1" stroke-width="9" stroke-linecap="round" stroke-linejoin="round">' +
  '<rect x="96" y="110" width="208" height="130" rx="10"/>' +
  '<path d="M96 150h208M150 110v-18a10 10 0 0 1 10-10h80a10 10 0 0 1 10 10v18"/>' +
  '<circle cx="150" cy="205" r="4" fill="#cbd5e1"/>' +
  '</g></svg>';

export const placeholderImage: ImageAsset = {
  src: `data:image/svg+xml,${encodeURIComponent(PLACEHOLDER_SVG)}`,
  alt: "No photo available for this product",
};

// Real listing photo, or the neutral placeholder when a product has none.
export function productImage(src: string | null | undefined, alt: string): ImageAsset {
  return src ? { src, alt } : placeholderImage;
}
