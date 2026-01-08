/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
    "./utils/**/*.{js,ts,jsx,tsx}"
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#f0f9ff',
          100: '#e0f2fe',
          500: '#0ea5e9',
          600: '#0284c7',
          900: '#0c4a6e',
        }
      },
      typography: (theme) => ({
        DEFAULT: {
          css: {
            maxWidth: 'none',
            code: {
              backgroundColor: theme('colors.gray.100'),
              padding: '2px 4px',
              borderRadius: '0.25rem',
              fontWeight: '400',
            },
            'code::before': {
              content: '""',
            },
            'code::after': {
              content: '""',
            },
            // Explicitly set base list styles to ensure visibility
            'ul': {
              listStyleType: 'disc',
              paddingLeft: '1.625em',
            },
            'ol': {
              listStyleType: 'decimal',
              paddingLeft: '1.625em',
            },
            'li': {
              marginTop: '0.25em',
              marginBottom: '0.25em',
            },
            // Enhanced Nested List Styling
            'ul ul': {
              listStyleType: 'circle',
              marginTop: '0.125em',
              marginBottom: '0.125em',
            },
            'ul ul ul': {
              listStyleType: 'square',
            },
            'ol ol': {
              listStyleType: 'lower-alpha',
              marginTop: '0.125em',
              marginBottom: '0.125em',
            },
            'ol ol ol': {
              listStyleType: 'lower-roman',
            },
            // Dark mode overrides
            '.dark & code': {
               backgroundColor: theme('colors.gray.800'),
            }
          },
        },
      }),
    }
  },
  plugins: [
    require('@tailwindcss/typography'),
  ],
}