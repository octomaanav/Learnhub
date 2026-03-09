/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Nunito', 'system-ui', '-apple-system', 'sans-serif'],
        display: ['Fredoka', 'system-ui', '-apple-system', 'sans-serif'],
      },
      colors: {
        // PRIMARY: Duolingo Green (playful, energetic, positive)
        primary: {
          50: '#f1fced',
          100: '#def9d7',
          200: '#c2f1b4',
          300: '#9ce487',
          400: '#7ad45e',
          500: '#58cc02', // Main Duolingo Green
          600: '#46a302', // 3D shadow color
          700: '#357c01',
          800: '#285e01',
          900: '#1e4601',
        },
        // SECONDARY: Sky Blue (creative, learning, airy)
        secondary: {
          50: '#ecf9ff',
          100: '#d5f1ff',
          200: '#b1e5ff',
          300: '#81d4ff',
          400: '#4fbfff',
          500: '#1cb0f6', // Main Sky Blue
          600: '#1899d6', // 3D shadow color
          700: '#147cb0',
          800: '#10648c',
          900: '#0d5071',
        },
        // TERTIARY: Golden Yellow (rewards, streaks, joy)
        tertiary: {
          50: '#fffbea',
          100: '#fff6c9',
          200: '#ffef98',
          300: '#ffe45d',
          400: '#ffd72b',
          500: '#ffc800', // Main Gold
          600: '#e5a300', // 3D shadow color
          700: '#ba7b00',
          800: '#945c00',
          900: '#784800',
        },
        // SURFACE: Very soft warm grays for backgrounds
        surface: {
          50: '#ffffff',
          100: '#f7f7f7',
          200: '#e5e5e5', // Border color typically
          300: '#d1d1d1',
          400: '#a3a3a3',
          500: '#777777', // Text color light
          600: '#555555', // Text color medium
          700: '#3f3f3f', // Text color dark
          800: '#2b2b2b',
          900: '#111111',
        },
        // WARNING / DANGER: Bright Red (errors, missing hearts)
        warning: {
          50: '#ffebeb',
          100: '#ffd1d1',
          200: '#ffb3b3',
          300: '#ff8a8a',
          400: '#ff6666',
          500: '#ff4b4b', // Main Red
          600: '#ea2b2b', // 3D shadow color
          700: '#c21a1a',
          800: '#9b1414',
          900: '#7f0f0f',
        },
      },
      fontSize: {
        'xs': ['0.75rem', { lineHeight: '1rem', letterSpacing: '0.01em' }],
        'sm': ['0.875rem', { lineHeight: '1.25rem', letterSpacing: '0.01em' }],
        'base': ['1rem', { lineHeight: '1.5rem' }],
        'lg': ['1.125rem', { lineHeight: '1.75rem', fontWeight: '600' }],
        'xl': ['1.25rem', { lineHeight: '1.75rem', fontWeight: '600' }],
        '2xl': ['1.5rem', { lineHeight: '2rem', fontWeight: '700' }],
        '3xl': ['1.875rem', { lineHeight: '2.25rem', fontWeight: '700' }],
        '4xl': ['2.25rem', { lineHeight: '2.5rem', fontWeight: '700' }],
        '5xl': ['3rem', { lineHeight: '1.1', fontWeight: '800' }],
        '6xl': ['3.75rem', { lineHeight: '1.1', fontWeight: '800' }],
      },
      spacing: {
        '18': '4.5rem',
        '22': '5.5rem',
      },
      borderRadius: {
        '2xl': '1rem',
        '3xl': '1.5rem',
        '4xl': '2rem',
        'full': '9999px',
      },
      boxShadow: {
        'soft': '0 2px 5px rgba(0,0,0,0.05)',
        'medium': '0 4px 10px rgba(0,0,0,0.08)',
        'elevated': '0 8px 20px rgba(0,0,0,0.1)',
        '3d-primary': '0 3px 0 0 #46a302', // Shadow for primary button
        '3d-secondary': '0 3px 0 0 #1899d6', // Shadow for secondary button
        '3d-tertiary': '0 3px 0 0 #e5a300', // Shadow for tertiary button
        '3d-surface': '0 3px 0 0 #e5e5e5', // Shadow for surface button
        '3d-danger': '0 3px 0 0 #ea2b2b', // Shadow for danger button
        '3d-primary-active': '0 0px 0 0 #46a302', // Active state (pressed)
        '3d-secondary-active': '0 0px 0 0 #1899d6',
        '3d-tertiary-active': '0 0px 0 0 #e5a300',
        '3d-surface-active': '0 0px 0 0 #e5e5e5',
        '3d-danger-active': '0 0px 0 0 #ea2b2b',
        'card-3d': '0 3px 0 0 #e5e5e5, 0 8px 15px rgba(0,0,0,0.05)',
        'card-3d-active': '0 0px 0 0 #e5e5e5, 0 3px 5px rgba(0,0,0,0.05)',
      },
      transitionTimingFunction: {
        'smooth': 'cubic-bezier(0.4, 0, 0.2, 1)',
        'ease-out-soft': 'cubic-bezier(0.25, 0.1, 0.25, 1)',
      },
      transitionDuration: {
        '150': '150ms',
        '200': '200ms',
      },
    },
  },
  plugins: [],
}

