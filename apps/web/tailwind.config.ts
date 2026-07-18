import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./features/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        leaf: { 50: "#EEF9F1", 100: "#D9F1DF", 300: "#8ED49E", 500: "#4AAA64", 700: "#2A7041", 900: "#1C472C" },
        forest: "#173622",
        sunny: "#FFD66E"
      },
      boxShadow: { float: "0 18px 50px rgba(28, 71, 44, .12)" },
      borderRadius: { "4xl": "2rem" }
    }
  },
  plugins: []
};

export default config;
