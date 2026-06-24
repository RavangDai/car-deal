// frontend/src/theme.ts
// Single source of truth for typography + design tokens.
// Each page injects these into its own scoped <style> string (.rv-catalog,
// .rv-login, .rv-legal, .rv-report) — no :root stylesheet, so the existing
// scoped-wrapper pattern stays intact.
//
// Direction: editorial. A serif display (Source Serif 4) carries the headlines
// in a literary register; Manrope carries all body/UI; a warm off-white canvas
// grounds the page. Red stays the committed brand identity (CTA + savings),
// Hudson blue is the editorial link/accent. The "editorial" feel is carried by
// the serif headlines, warm paper, hairline rules, paper-like depth, a dark
// floating pill nav, and purposeful frosted glass.
//
// Type pairing: serif display + geometric sans body — a deliberate contrast
// axis (not two similar sans). --font-display is swap-safe (one token).
//
// Semantic mapping:
//   red    → primary CTA, undervalue %, savings, brand emphasis
//   blue   → inline text links + linked labels + soft accent washes (NOT a CTA,
//            NOT a savings cue) — Hudson blue, the reference's single chromatic accent
//   green  → good deal / confidence / verified
//   amber  → caution / thin margin / warnings
//   ink    → warm near-black text
//   paper  → warm off-white canvas; paper-pale → cards/inputs (warm near-white)

export const FONT_IMPORT = `@import url('https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&family=Source+Serif+4:opsz,wght@8..60,400..700&display=swap');`;

export const THEME_TOKENS = `
    /* ── Typography — serif display (headlines) + Manrope (everything else). */
    --font-display: 'Source Serif 4', 'Source Serif Pro', Georgia, 'Times New Roman', serif;
    --font-sans: 'Manrope', system-ui, -apple-system, sans-serif;

    /* ── Canvas — warm off-white, tilted to neutral-warm (not green cream).
       Red carries the brand; the paper just keeps the page from feeling clinical. */
    --paper:        #faf8f4;
    --paper-deep:   #ece6dc;
    --paper-soft:   #f3efe7;
    --paper-pale:   #fffdfa;
    --bone:         #fffdfa;

    /* ── Ink — warm near-black ramp. Muted/fade kept dark enough to clear 4.5:1. */
    --ink:          #1c1815;
    --ink-soft:     #2c2723;
    --ink-muted:    #5c554d;
    --ink-fade:     #786f63;

    /* ── Brand red — the committed identity. CTA + savings + emphasis. */
    --red:          #b8312e;
    --red-deep:     #8a1d1c;
    --red-tint:     #f4ddd5;
    --red-wash:     rgba(184,49,46,.08);

    /* ── Green — good deal / confidence. */
    --green:        #2d6a4f;
    --green-deep:   #1f4d3a;
    --green-tint:   #dde9e1;

    /* ── Amber — caution / thin margin. */
    --amber:        #b07d2b;
    --amber-deep:   #8a5f1d;
    --amber-tint:   #f3e6cf;

    /* ── Blue — Hudson-blue editorial accent: inline links + linked labels + soft
       washes. --blue is text-safe (≥4.5:1) for link text; --blue-bright (#0081c0,
       the reference's Hudson Blue) is for large-headline links + decorative washes
       only (passes 3:1 large-text, not 4.5:1 body). */
    --blue:         #136f96;
    --blue-bright:  #0081c0;
    --blue-deep:    #0d5c7e;
    --blue-tint:    #e2eef4;
    --link:         #136f96;
    --link-hover:   #0d5c7e;

    /* ── Hairlines — warm rules, in lieu of heavy borders. */
    --rule:         #eae3d8;
    --rule-strong:  #dbd3c5;
    --err:          var(--red);

    /* ── Elevation — soft, layered, light-theme tasteful; warm-black shadow color. */
    --shadow-sm:   0 1px 2px rgba(28,24,20,.04), 0 1px 3px rgba(28,24,20,.06);
    --shadow-md:   0 2px 6px rgba(28,24,20,.05), 0 8px 22px rgba(28,24,20,.08);
    --shadow-lg:   0 6px 14px rgba(28,24,20,.06), 0 22px 48px rgba(28,24,20,.13);
    --shadow-xl:   0 10px 24px rgba(28,24,20,.07), 0 36px 80px rgba(28,24,20,.18);

    /* ── Frosted glass — purposeful only: the floating pill nav + the hero
       spotlight overlay. Never a default card treatment. */
    --frost-light: rgba(255,253,250,.72);
    --frost-dark:  rgba(26,22,19,.78);
    --frost-blur:  saturate(180%) blur(14px);
    --pill-shadow: 0 2px 8px rgba(28,24,20,.14), 0 16px 44px rgba(28,24,20,.22);

    /* ── Editorial radius scale — slightly larger, paper-like. */
    --r-sm:   8px;
    --r-md:   12px;
    --r-lg:   16px;
    --r-xl:   20px;
    --r-card: 16px;
    --r-pill: 999px;

    /* ── Ambient glow — focal light only (hero / CTA), never sprayed decoration. */
    --glow-red:    radial-gradient(60% 60% at 50% 42%, rgba(184,49,46,.20), rgba(184,49,46,0) 72%);
    --glow-red-soft: radial-gradient(70% 70% at 50% 50%, rgba(184,49,46,.10), rgba(184,49,46,0) 70%);
    --ring-red:    0 0 0 3px var(--red-tint);

    /* ── Imagery */
    --img-radius:  18px;
    --img-ring:    inset 0 0 0 1px rgba(28,24,20,.07);

    /* ── Motion — one named easing carries the system. */
    --ease-out-expo: cubic-bezier(.16, 1, .3, 1);
    --dur-fast:    .15s;
    --dur-mid:     .25s;
    --dur-slow:    .5s;
`;
