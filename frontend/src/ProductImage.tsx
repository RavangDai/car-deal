// frontend/src/ProductImage.tsx
// Reusable image with an aspect-ratio box, a quiet skeleton shimmer while the
// photo decodes, and a soft fade-in on load. Never a broken-image icon, never a
// bare colored div. Styles are injected once into <head> so the component works
// inside every scoped page wrapper.
import { useEffect, useState, type CSSProperties } from "react";
import { placeholderImage, type ImageAsset } from "./images";

const STYLE_ID = "wicimg-styles";
const CSS = `
.wicimg {
  position: relative;
  overflow: hidden;
  background: var(--paper-soft, #f4f4f3);
  box-shadow: var(--img-ring, inset 0 0 0 1px rgba(24,24,27,.07));
}
.wicimg::after {
  content: "";
  position: absolute; inset: 0;
  background: linear-gradient(100deg,
    rgba(255,255,255,0) 30%,
    rgba(255,255,255,.55) 50%,
    rgba(255,255,255,0) 70%);
  background-size: 220% 100%;
  animation: wicimg-shimmer 1.4s var(--ease-out-expo, ease) infinite;
  opacity: 1;
  transition: opacity .4s ease;
}
.wicimg.is-loaded::after { opacity: 0; }
.wicimg > img {
  display: block; width: 100%; height: 100%;
  object-fit: cover;
  opacity: 0;
  transform: scale(1.015);
  transition: opacity .6s var(--ease-out-expo, ease), transform .9s var(--ease-out-expo, ease);
}
.wicimg.is-loaded > img { opacity: 1; transform: none; }
@keyframes wicimg-shimmer { to { background-position: -120% 0; } }
@media (prefers-reduced-motion: reduce) {
  .wicimg::after { animation: none; }
  .wicimg > img { transition: opacity .2s ease; transform: none; }
}
`;

if (typeof document !== "undefined" && !document.getElementById(STYLE_ID)) {
  const el = document.createElement("style");
  el.id = STYLE_ID;
  el.textContent = CSS;
  document.head.appendChild(el);
}

export function ProductImage({
  image,
  ratio,
  className,
  style,
  position,
  eager = false,
  sizes,
}: {
  image: ImageAsset;
  /** aspect-ratio for the box, e.g. "16 / 10" or "3 / 4". */
  ratio?: string;
  className?: string;
  style?: CSSProperties;
  /** object-position, e.g. "center 60%". */
  position?: string;
  eager?: boolean;
  sizes?: string;
}) {
  const [loaded, setLoaded] = useState(false);
  // When a hotlinked photo 404s/expires, fall back to the neutral placeholder
  // instead of a broken-image icon. Reset both flags when the source changes
  // so a reused component re-evaluates the new image.
  const [errored, setErrored] = useState(false);
  useEffect(() => {
    setLoaded(false);
    setErrored(false);
  }, [image.src]);

  const shown = errored ? placeholderImage : image;
  return (
    <div
      className={`wicimg${loaded ? " is-loaded" : ""}${className ? ` ${className}` : ""}`}
      style={{ aspectRatio: ratio, ...style }}
    >
      <img
        src={shown.src}
        alt={shown.alt}
        loading={eager ? "eager" : "lazy"}
        decoding="async"
        sizes={sizes}
        // no-referrer improves hotlink success and avoids leaking the visitor's
        // page URL to the image host.
        referrerPolicy="no-referrer"
        onLoad={() => setLoaded(true)}
        onError={() => setErrored(true)}
        style={position ? { objectPosition: position } : undefined}
      />
    </div>
  );
}
