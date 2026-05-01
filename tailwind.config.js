/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        navy: {
          50:  '#e6edf5',
          100: '#ccdaeb',
          200: '#99b5d6',
          300: '#6690c2',
          400: '#336bad',
          500: '#003366',
          600: '#002952',
          700: '#001f3d',
          800: '#001429',
          900: '#000a14',
        },
        gold: {
          50:  '#fdf8e8',
          100: '#faf1d0',
          200: '#f5e3a1',
          300: '#efd473',
          400: '#eac644',
          500: '#D4AF37',
          600: '#aa8c2c',
          700: '#7f6921',
          800: '#554616',
          900: '#2a230b',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
