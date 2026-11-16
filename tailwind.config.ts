import type { Config } from "tailwindcss";

// Palette : bleu nuit (menu, titres, actions), doré sable (accents),
// fond gris bleuté. Doré par défaut assombri (#8a6633) pour un contraste
// texte ≥ 4,5:1 sur blanc et sur le fond (WCAG AA). Les noms ink / gold /
// cream sont gardés pour que toutes les pages suivent sans réécriture.
const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        // ink et cream passent par des variables CSS (globals.css) : le portail
        // public les redéfinit en bordeaux (.theme-portail), le back-office reste bleu.
        ink: { DEFAULT: "rgb(var(--ink) / <alpha-value>)", dark: "rgb(var(--ink-dark) / <alpha-value>)", light: "rgb(var(--ink-light) / <alpha-value>)" },
        gold: { DEFAULT: "#8a6633", light: "#e8d7bb", sand: "#c9a46c", dark: "#7a5a2e" },
        cream: "rgb(var(--cream) / <alpha-value>)",
      },
      // Couleur des textes « ink » séparée de celle des fonds : sur le portail
      // les fonds sont bordeaux mais les textes restent anthracite.
      textColor: {
        ink: { DEFAULT: "rgb(var(--ink-text) / <alpha-value>)", dark: "rgb(var(--ink-text-dark) / <alpha-value>)", light: "rgb(var(--ink-text-light) / <alpha-value>)" },
      },
      fontFamily: {
        sans: ["Montserrat", "ui-sans-serif", "system-ui", "sans-serif"],
        // Les titres utilisaient font-serif : même famille désormais.
        serif: ["Montserrat", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      boxShadow: {
        soft: "0 1px 2px rgba(22,35,90,0.04), 0 8px 24px rgba(22,35,90,0.06)",
      },
    },
  },
  plugins: [],
};
export default config;
