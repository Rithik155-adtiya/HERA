/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#eef4ff',
          100: '#dae5ff',
          200: '#bcd0ff',
          300: '#8eb1ff',
          400: '#5986ff',
          500: '#3358f5',
          600: '#2139db',
          700: '#1c2eaf',
          800: '#1c2a8a',
          900: '#1c296c',
          950: '#141a42',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
