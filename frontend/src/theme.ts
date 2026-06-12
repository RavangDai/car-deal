// frontend/src/theme.ts
// Single source of truth for the editorial design tokens and font loading.
// Each page injects these into its own scoped <style> string (.rv-catalog,
// .rv-login, .rv-legal, .rv-report) — no :root stylesheet, so the existing
// scoped-wrapper pattern stays intact.
//
// Semantic mapping (approved palette — "premium editorial + buyer-report"):
//   red    → primary CTA, undervalue %, savings, live scan dot
//   green  → confidence, verified, clean title, "good deal" range
//   amber  → medium confidence, recalls, verify warnings
//   ink    → text, footer, premium contrast blocks
//   paper  → main background; paper-pale → cards and panels

export const FONT_IMPORT = `@import url('https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght,SOFT,WONK@0,9..144,300..900,0..100,0..1;1,9..144,300..900,0..100,0..1&family=Newsreader:ital,opsz,wght@0,6..72,300..700;1,6..72,300..700&family=JetBrains+Mono:wght@400;500;600;700&display=swap');`;

export const THEME_TOKENS = `
    --paper:        #ece2cd;
    --paper-deep:   #ddd0b4;
    --paper-soft:   #f3eada;
    --paper-pale:   #f7f0df;
    --ink:          #18130a;
    --ink-soft:     #2a2418;
    --ink-muted:    #6f6244;
    --ink-fade:     #968866;
    --red:          #b8312e;
    --red-deep:     #8a1d1c;
    --red-tint:     #e3c2b0;
    --green:        #2d6a4f;
    --green-deep:   #1f4d3a;
    --green-tint:   #d3d2bd;
    --amber:        #b07d2b;
    --amber-deep:   #8a5f1d;
    --amber-tint:   #e1d0b0;
    --bone:         #efe9dd;
    --rule:         var(--paper-deep);
    --rule-strong:  var(--ink-fade);
    --err:          var(--red);
`;
