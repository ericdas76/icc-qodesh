/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#f0f4ff',
          100: '#dce6ff',
          200: '#b9ccff',
          300: '#85a3ff',
          400: '#4d6fff',
          500: '#2044ff',
          600: '#1030f5',
          700: '#0d22e1',
          800: '#1220b6',
          900: '#142090',
          950: '#0e1457',
        }
      }
    },
  },
  plugins: [],
}
