// shadcn's class-composition helper. The rest of this codebase composes class
// names by hand with template literals (see primitives.tsx); cn() exists only
// so the vendored ui/ components can be pasted and updated unmodified.
import { clsx } from "clsx";
import type { ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
