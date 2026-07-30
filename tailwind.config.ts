import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        paper: "#F8F8F1",
        brand: "#0038e5",
        ink: "#020c44",
        sky: "#448af5",
        mist: "#b4d2ed",
        ok: "#376e32",
        warn: "#e8bc03",
        danger: "#d13700",
        ember: "#ed885f",
        teal: "#70bcba",
      },
      fontFamily: {
        title: ["var(--font-title)", "sans-serif"],
        body: ["var(--font-body)", "sans-serif"],
      },
    },
  },
  plugins: [],
};
export default config;
