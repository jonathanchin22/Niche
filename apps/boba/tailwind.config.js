/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{ts,tsx}",
    "./src/app/**/*.{ts,tsx}",
    "./src/components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        nunito: ["var(--font-nunito)", "sans-serif"],
      },
      colors: {
        boba: {
          accent:    "#7C3AED",
          soft:      "#F3EEFF",
          mid:       "#DDD6FE",
          card:      "#FFFFFF",
          text:      "#12082A",
          secondary: "#6B5B8A",
          tertiary:  "#B0A0CC",
          divider:   "#EDE8FA",
        },
      },
      borderRadius: {
        "2xl": "16px",
        "3xl": "24px",
      },
      boxShadow: {
        card: "0 2px 16px rgba(0,0,0,0.07)",
        nav:  "0 -4px 20px rgba(0,0,0,0.08)",
      },
    },
  },
  plugins: [],
}