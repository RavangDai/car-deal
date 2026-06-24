// frontend/src/CarImage.tsx
// Reusable image with an aspect-ratio box, a quiet skeleton shimmer while the
// photo decodes, and a soft fade-in on load. Never a broken-image icon, never a
// bare colored div. Styles are injected once into <head> so the component works
// inside every scoped page wrapper (.rv-catalog / .rv-login / .rv-report).
import { useState, type CSSProperties } from "react";
import type { ImageAsset } from "./images";

const STYLE_ID = "rvimg-styles";
const CSS = `
.rvimg {
  position: relative;
  overflow: hidden;
  background: var(--paper-soft, #f4f4f3);
  box-shadow: var(--img-ring, inset 0 0 0 1px rgba(24,24,27,.07));
}
.rvimg::after {
  content: "";
  position: absolute; inset: 0;
  background: linear-gradient(100deg,
    rgba(255,255,255,0) 30%,
    rgba(255,255,255,.55) 50%,
    rgba(255,255,255,0) 70%);
  background-size: 220% 100%;
  animation: rvimg-shimmer 1.4s var(--ease-out-expo, ease) infinite;
  opacity: 1;
  transition: opacity .4s ease;
}
.rvimg.is-loaded::after { opacity: 0; }
.rvimg > img {
  display: block; width: 100%; height: 100%;
  object-fit: cover;
  opacity: 0;
  transform: scale(1.015);
  transition: opacity .6s var(--ease-out-expo, ease), transform .9s var(--ease-out-expo, ease);
}
.rvimg.is-loaded > img { opacity: 1; transform: none; }
@keyframes rvimg-shimmer { to { background-position: -120% 0; } }
@media (prefers-reduced-motion: reduce) {
  .rvimg::after { animation: none; }
  .rvimg > img { transition: opacity .2s ease; transform: none; }
}
`;

if (typeof document !== "undefined" && !document.getElementById(STYLE_ID)) {
  const el = document.createElement("style");
  el.id = STYLE_ID;
  el.textContent = CSS;
  document.head.appendChild(el);
}

export function CarImage({
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
  return (
    <div
      className={`rvimg${loaded ? " is-loaded" : ""}${className ? ` ${className}` : ""}`}
      style={{ aspectRatio: ratio, ...style }}
    >
      <img
        src={image.src}
        alt={image.alt}
        loading={eager ? "eager" : "lazy"}
        decoding="async"
        sizes={sizes}
        onLoad={() => setLoaded(true)}
        style={position ? { objectPosition: position } : undefined}
      />
    </div>
  );
}
