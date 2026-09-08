/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        bakery: {
          50: '#fdfbf7',
          100: '#f7f1e5',
          200: '#eddcc5',
          300: '#e1c39f',
          400: '#d2a373',
          500: '#c5854f',
          600: '#b77042',
          700: '#985838',
          800: '#7b4833',
          900: '#643c2c',
        },
        cream: {
          light: '#fdfbf7',
          base: '#f5eee6',
          warm: '#e6d5c3',
        }
      },
      fontFamily: {
        sans: ['Outfit', 'Inter', 'sans-serif'],
      },
      backdropBlur: {
        xs: '2px',
        glass: '16px',
        heavy: '24px',
      },
      boxShadow: {
        glass: '0 8px 32px 0 rgba(197, 133, 79, 0.08)',
        'glass-hover': '0 12px 40px 0 rgba(197, 133, 79, 0.15)',
        'glass-inset': 'inset 0 1px 1px 0 rgba(255, 255, 255, 0.6)',
      }
    },
  },
  plugins: [],
}
