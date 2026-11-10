/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: { DEFAULT: '#16181B', 2: '#3A3F45' },
        muted: '#6E747B',
        line: '#E4E5E1',
        canvas: '#F4F4F1',
        pacer: { DEFAULT: '#EE4F17', soft: '#FDEDE6' },
        ahead: { DEFAULT: '#0D7A53', soft: '#E3F3EC' },
        behind: { DEFAULT: '#C93322', soft: '#FBE9E6' },
        gps: { DEFAULT: '#1B66D6', soft: '#E6EFFC' },
      },
      fontFamily: {
        sans: ['Roboto', 'ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'Helvetica Neue', 'Arial', 'sans-serif'],
      },
      boxShadow: {
        sheet: '0 -8px 30px rgba(22, 24, 27, 0.12)',
        float: '0 2px 10px rgba(22, 24, 27, 0.16)',
      },
    },
  },
  plugins: [],
};
