/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: '#1B4332',
        surface: '#f4f4f1',
        card: '#f9f9f7',
      },
    },
  },
  plugins: [],
};
