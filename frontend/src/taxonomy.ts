// frontend/src/taxonomy.ts
// Mirror of backend/app/taxonomy.py. Kept in sync manually: a slug the API
// accepts but this file cannot label is a category users can never pick, and
// a slug here that the API rejects is silently dropped on save.
//
// Deliberately coarse — see the note in the Python module. Every extra
// category is another checkbox between a new user and their first price.

export type CategorySlug =
  | "electronics"
  | "kitchen"
  | "gaming"
  | "home"
  | "fashion"
  | "fitness"
  | "beauty"
  | "tools";

export const CATEGORIES: { slug: CategorySlug; label: string; hint: string }[] = [
  { slug: "electronics", label: "Electronics", hint: "Laptops, phones, audio, TVs" },
  { slug: "kitchen", label: "Kitchen", hint: "Cookware, appliances, coffee" },
  { slug: "gaming", label: "Gaming", hint: "Consoles, GPUs, peripherals" },
  { slug: "home", label: "Home & garden", hint: "Furniture, bedding, tools for the house" },
  { slug: "fashion", label: "Clothing & shoes", hint: "Apparel, footwear, bags" },
  { slug: "fitness", label: "Fitness & outdoors", hint: "Training gear, camping, bikes" },
  { slug: "beauty", label: "Beauty & personal care", hint: "Skincare, haircare, grooming" },
  { slug: "tools", label: "Tools & DIY", hint: "Power tools, hardware, workshop" },
];

const SLUGS = new Set<string>(CATEGORIES.map((c) => c.slug));

export function isCategorySlug(v: string): v is CategorySlug {
  return SLUGS.has(v);
}

export function categoryLabel(slug: string): string {
  return CATEGORIES.find((c) => c.slug === slug)?.label ?? slug;
}
