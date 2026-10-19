/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        gallery: {
          bg: '#F6F4EF',
          panel: '#EFECE6',
          surface: '#FFFFFF',
          ink: '#161514',
          graphite: '#5C5852',
          terracotta: '#B85D3B',
          forest: '#2E4A3E',
          border: '#E2DDD3',
        },
      },
      fontFamily: {
        serif: ['"Instrument Serif"', '"Playfair Display"', 'Georgia', 'serif'],
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
    },
  },
  plugins: [],
};
