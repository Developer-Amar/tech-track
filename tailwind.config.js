/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Red & Carbon-Black modern tech tokens
        void: "#06080E",
        panel: "rgba(15, 18, 27, 0.65)",
        dormant: "#94A3B8",
        signal: "#FF1E56",
        danger: "#EF4444",
        text: "#F8FAFC",
      },
      fontFamily: {
        display: ['"Space Grotesk"', "sans-serif"],
        body: ['"Inter"', "sans-serif"],
        mono: ['"JetBrains Mono"', "monospace"],
      },
    },
  },
  plugins: [],
};
