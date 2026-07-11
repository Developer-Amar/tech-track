/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Tech Track design tokens — UIUX_Design_Brief.md
        void: "#0B0E14",
        panel: "#151A24",
        dormant: "#3A4356",
        signal: "#E8A33D",
        danger: "#E85D4A",
        text: "#E8EAED",
      },
      fontFamily: {
        // Display: headlines, section titles
        display: ['"Space Grotesk"', "sans-serif"],
        // Body: readable text, riddles, instructions
        body: ['"IBM Plex Sans"', "sans-serif"],
        // Mono: code editor, secret codes, timestamps, admin data
        mono: ['"JetBrains Mono"', "monospace"],
      },
    },
  },
  plugins: [],
};
