// frontend/tailwind.config.cjs
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        // Plus Jakarta Sans carries every word of UI and body; Urbanist
        // carries the display voice AND every figure. The figure role is a
        // role, not a separate family — Urbanist is proportional, so
        // anything set in `font-mono` must also carry tabular-nums.
        sans: ["Plus Jakarta Sans", "system-ui", "sans-serif"],
        display: ["Urbanist", "Plus Jakarta Sans", "system-ui", "sans-serif"],
        mono: ["Urbanist", "Plus Jakarta Sans", "ui-monospace", "monospace"],
      },

      // ── shadcn token bridge ────────────────────────────────────────────
      // The vendored components in src/components/ui/ are pasted from
      // ui.shadcn.com unmodified, so they reference shadcn's semantic color
      // names (bg-card, text-muted-foreground, border). None of those existed
      // here: theme.css speaks --paper / --ink / --rule instead. Rather than
      // introduce a second palette, each shadcn name is aliased onto the
      // house token it corresponds to, so a pasted component inherits the
      // instrument's colors automatically.
      //
      // Values are plain hex behind var(), not HSL triplets, so Tailwind's
      // slash-opacity modifier (text-primary/15) does NOT work on these.
      // Call sites needing alpha must write an explicit rgba().
      colors: {
        border: "var(--rule)",
        input: "var(--rule)",
        ring: "var(--ink)",
        background: "var(--paper)",
        foreground: "var(--ink)",
        card: {
          DEFAULT: "var(--paper-pale)",
          foreground: "var(--ink)",
        },
        muted: {
          DEFAULT: "var(--rule)",
          foreground: "var(--ink-muted)",
        },
        primary: {
          DEFAULT: "var(--primary)",
          foreground: "var(--paper)",
        },
      },

      // `border` with no color would fall back to currentColor (ink), which
      // is far too strong for this system. Hairlines are --rule.
      borderColor: {
        DEFAULT: "var(--rule)",
      },

      // shadcn's Card ships rounded-lg. Map it to the house card radius so a
      // pasted component lands on the same corner scale as .rv-sm-compose.
      borderRadius: {
        lg: "var(--r-card)",
        md: "var(--r-md)",
        sm: "var(--r-sm)",
      },

      boxShadow: {
        sm: "var(--shadow-sm)",
        DEFAULT: "var(--shadow-md)",
        md: "var(--shadow-md)",
        lg: "var(--shadow-lg)",
      },
    },
  },
  plugins: [],
};
