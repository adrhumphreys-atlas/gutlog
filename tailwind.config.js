/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/web/**/*.{ts,tsx}'],
  theme: {
    extend: {
      screens: {
        'md-plus': '769px', // Design spec responsive breakpoint
      },
      colors: {
        green: {
          50: '#f0fdf4',
          100: '#dcfce7',
          200: '#bbf7d0',
          400: '#4ade80',
          600: '#16a34a',
          800: '#166534',
        },
      },
      borderRadius: {
        xl: '12px',
        '2xl': '16px',
        '3xl': '24px',
      },
      boxShadow: {
        'just-added': '0 0 8px rgba(74, 124, 89, 0.15)',
      },
      keyframes: {
        'entry-fade-in': {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        'entry-fade-in': 'entry-fade-in 0.4s ease-out',
      },
    },
  },
  plugins: [],
}
