/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        indigo: {
          50: "rgb(var(--indigo-50) / <alpha-value>)",
          100: "rgb(var(--indigo-100) / <alpha-value>)",
          200: "rgb(var(--indigo-200) / <alpha-value>)",
          300: "rgb(var(--indigo-300) / <alpha-value>)",
          400: "rgb(var(--indigo-400) / <alpha-value>)",
          500: "rgb(var(--indigo-500) / <alpha-value>)",
          600: "rgb(var(--indigo-600) / <alpha-value>)",
          700: "rgb(var(--indigo-700) / <alpha-value>)",
          800: "rgb(var(--indigo-800) / <alpha-value>)",
          900: "rgb(var(--indigo-900) / <alpha-value>)",
          950: "rgb(var(--indigo-950) / <alpha-value>)",
        },
        success: {
          400: "rgb(var(--success-400) / <alpha-value>)",
          500: "rgb(var(--success-500) / <alpha-value>)",
          600: "rgb(var(--success-600) / <alpha-value>)",
        },
        danger: {
          400: "rgb(var(--danger-400) / <alpha-value>)",
          500: "rgb(var(--danger-500) / <alpha-value>)",
          600: "rgb(var(--danger-600) / <alpha-value>)",
        },
        warning: {
          400: "rgb(var(--warning-400) / <alpha-value>)",
          500: "rgb(var(--warning-500) / <alpha-value>)",
          600: "rgb(var(--warning-600) / <alpha-value>)",
        },
        info: {
          400: "rgb(var(--info-400) / <alpha-value>)",
          500: "rgb(var(--info-500) / <alpha-value>)",
          600: "rgb(var(--info-600) / <alpha-value>)",
        },
      },
      typography: {
        DEFAULT: {
          css: {
            maxWidth: 'none',
            color: 'rgb(203 213 225)', // slate-300
            strong: { color: 'rgb(255 255 255)' }, // white
            h1: { color: 'rgb(255 255 255)' },
            h2: { color: 'rgb(255 255 255)' },
            h3: { color: 'rgb(255 255 255)' },
            h4: { color: 'rgb(255 255 255)' },
            code: { color: 'rgb(165 180 252)', backgroundColor: 'rgb(30 41 59)', padding: '0.125rem 0.375rem', borderRadius: '0.25rem' },
            'code::before': { content: '""' },
            'code::after': { content: '""' },
            a: { color: 'rgb(165 180 252)', textDecoration: 'underline' },
            blockquote: { borderLeftColor: 'rgb(99 102 241)', color: 'rgb(148 163 184)' },
          },
        },
      },
    },
  },
  plugins: [require('@tailwindcss/typography')],
};
