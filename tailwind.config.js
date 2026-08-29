/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  // 'class', not 'media': the app offers an explicit light/dark choice as
  // well as following the device, and 'media' can only do the latter.
  darkMode: 'class',
  theme: {
    extend: {},
  },
  plugins: [],
};