/** @type {import('tailwindcss').Config} */
module.exports = {
  // Purge/Content configuration: Scans the index.html file for used Tailwind classes
  content: ["./dist/index.html"],
  theme: {
    extend: {
      // Define the custom R1 color palette
      colors: {
        'r1-dark': '#18181b', // Primary background (Zinc 900 equivalent)
        'r1-card': '#27272a', // Card background (Zinc 800 equivalent)
        'r1-neon': '#FF6600', // Neon Orange accent
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'], // Set Inter as the default font
      }
    },
  },
  plugins: [],
}
