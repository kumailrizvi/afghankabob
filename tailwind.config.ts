import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{js,ts,jsx,tsx}", "./components/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        kabob: {
          green: "#10583f",
          dark: "#1f1b18",
          cream: "#f7f3ed",
          sand: "#e7dacb",
          orange: "#c9512e"
        }
      }
    }
  },
  plugins: []
};
export default config;
