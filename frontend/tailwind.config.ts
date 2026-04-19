import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./hooks/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        soseguro: {
          emergency: "#E63946",
          navy: "#0D1B2A",
          light: "#F4F6F8",
        },
      },
      boxShadow: {
        panel: "0 10px 30px rgba(17, 24, 39, 0.12)",
      },
      borderRadius: {
        card: "10px",
      }
    },
  },
  plugins: [],
};

export default config;
