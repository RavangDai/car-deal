// A minimal, reduced-motion-aware loading spinner. Inherits text color via
// `currentColor`. Replaces the old skeuomorphic car-wheel glyph.
import { motion, useReducedMotion } from "framer-motion";

export function Spinner({
  size = 16,
  className,
}: {
  size?: number;
  className?: string;
}) {
  const reduce = useReducedMotion();
  return (
    <motion.span
      role="status"
      aria-label="Loading"
      className={className}
      style={{
        display: "inline-block",
        width: size,
        height: size,
        borderRadius: "50%",
        border: "2px solid currentColor",
        borderTopColor: "transparent",
        opacity: 0.9,
        verticalAlign: "middle",
        flexShrink: 0,
      }}
      animate={reduce ? undefined : { rotate: 360 }}
      transition={reduce ? undefined : { repeat: Infinity, ease: "linear", duration: 0.7 }}
    />
  );
}
