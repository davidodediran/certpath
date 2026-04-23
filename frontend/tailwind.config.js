/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        aws: {
          orange: '#FF9900',
          navy: '#232F3E',
          'navy-light': '#37475A',
          'navy-dark': '#161E2D',
          teal: '#00A1C9',
        },
      },
    },
  },
  plugins: [require('@tailwindcss/forms')],
};
