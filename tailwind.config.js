/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Contrast-audited Antigravity v2 tokens
        void: "#0D1017",                    // Lifted card bg (was #06080E)
        panel: "rgba(18, 22, 35, 0.75)",    // Glass panel (was 0.65)
        dormant: "#A0AEC0",                 // Brighter muted text (was #94A3B8)
        signal: "#00E5FF",                  // Electric Cyan — unified with CSS
        crimson: "#FF1E56",                 // Preserved red for badges/active tabs
        gold: "#F59E0B",                    // Warm ranking accent
        danger: "#EF4444",
        text: "#F8FAFC",
      },
      fontFamily: {
        display: ['"Outfit"', "sans-serif"],
        body: ['"Inter"', "sans-serif"],
        mono: ['"JetBrains Mono"', "monospace"],
      },
      screens: {
        fold: "280px",
        xs: "375px",
      },
    },
  },
  plugins: [],
};
