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
        // Archivo carries every word of UI and body; Instrument Serif
        // carries the display voice; IBM Plex Mono carries every figure.
        sans: ["Archivo", "system-ui", "sans-serif"],
        display: ["Instrument Serif", "Archivo", "Georgia", "serif"],
        mono: ["IBM Plex Mono", "ui-monospace", "Consolas", "monospace"],
      },
    },
  },
  plugins: [],
};
