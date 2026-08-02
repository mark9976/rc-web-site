/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/**/*.{js,jsx,ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        field: {
          green: '#2D5A27',
          darkgreen: '#1A3D17',
          grass: '#4A7C42',
        },
        sky: {
          light: '#B8D4E8',
          DEFAULT: '#4A8FCA',
          deep: '#2A5F8F',
        },
        flyday: {
          go: '#2E7D32',
          maybe: '#E8890C',
          nogo: '#C62828',
        },
        surface: {
          warm: '#FAF9F6',
          card: '#FFFFFF',
          muted: '#F0EFEB',
        },
        ink: {
          DEFAULT: '#1A1A2E',
          muted: '#5A5A6E',
          light: '#8A8A9E',
        },
      },
      fontFamily: {
        display: ['Barlow Condensed', 'sans-serif'],
        body: ['Inter', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
