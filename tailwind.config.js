/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: '#4F46E5', // Indigo 600
        secondary: '#10B981', // Emerald 500
        background: '#F3F4F6', // Gray 100
        surface: '#FFFFFF',
        textMain: '#1F2937', // Gray 800
        textMuted: '#6B7280', // Gray 500
        border: '#E5E7EB', // Gray 200
        danger: '#EF4444', // Red 500
        warning: '#F59E0B', // Amber 500
      }
    },
  },
  plugins: [],
}
