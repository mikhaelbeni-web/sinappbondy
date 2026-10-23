import type { Config } from "tailwindcss";

// Palette : bleu nuit (menu, titres, actions), doré sable (accents),
// fond gris bleuté. Les noms ink / gold / cream sont gardés pour que
// toutes les pages suivent sans réécriture.
const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        ink: { DEFAULT: "#0b2e6f", dark: "#071a46", light: "#1a46a0" },
        gold: { DEFAULT: "#9c7640", light: "#e8d7bb", sand: "#c9a46c", dark: "#7a5a2e" },
        cream: "#f3f5fa",
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
