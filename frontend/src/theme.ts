// frontend/src/theme.ts
// Single source of truth for typography + design tokens.
// Each page injects these into its own scoped <style> string (.rv-catalog,
// .rv-login, .rv-legal, .rv-report) — no :root stylesheet, so the existing
// scoped-wrapper pattern stays intact.
//
// Direction: clean, light, content-first. One typeface (Manrope) carries the
// whole hierarchy through weight + size; one accent (red) carries CTA + savings.
//
// Semantic mapping:
//   red    → primary CTA, undervalue %, savings
//   green  → good deal / confidence / verified
//   amber  → caution / thin margin / warnings
//   ink    → text
//   paper  → near-white background; paper-pale → cards/inputs (white)

export const FONT_IMPORT = `@import url('https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&display=swap');`;

export const THEME_TOKENS = `
    --paper:        #fafafa;
    --paper-deep:   #f0f0ee;
    --paper-soft:   #f4f4f3;
    --paper-pale:   #ffffff;
    --ink:          #18181b;
    --ink-soft:     #27272a;
    --ink-muted:    #52525b;
    --ink-fade:     #71717a;
    --red:          #b8312e;
    --red-deep:     #8a1d1c;
    --red-tint:     #f3d9d4;
    --green:        #2d6a4f;
    --green-deep:   #1f4d3a;
    --green-tint:   #dce9e2;
    --amber:        #b07d2b;
    --amber-deep:   #8a5f1d;
    --amber-tint:   #f3e6cf;
    --bone:         #ffffff;
    --rule:         #e5e5e3;
    --rule-strong:  #d4d4d1;
    --err:          var(--red);
`;
