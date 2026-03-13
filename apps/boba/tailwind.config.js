/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: "#fafaf8",
        ink: "#1a1a1a",
        muted: "#888888",
        faint: "#e8e8e4",
        accent: "#2d6a4f",
        "accent-light": "#e8f4ee",
        warning: "#c9a84c",
      },
      fontFamily: {
        hand: ["'Caveat'", "cursive"],
        serif: ["'DM Serif Display'", "Georgia", "serif"],
        sans: ["'DM Sans'", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
}
