/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#0EA5E9',
          foreground: '#0B5EA8',
        },
        surface: '#0B1220',
        card: '#11182a',
        accent: '#7C3AED',
      },
      fontFamily: {
        display: ['"Space Grotesk"', 'Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        card: '0 20px 60px -20px rgba(0,0,0,0.35)',
      },
    },
  },
  plugins: [],
};
