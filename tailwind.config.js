/** @type {import('tailwindcss').Config} */
const withAlpha = (v) => `rgb(var(${v}) / <alpha-value>)`;

export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{svelte,ts,js}'],
  theme: {
    extend: {
      colors: {
        paper: withAlpha('--c-paper'),
        surface: withAlpha('--c-surface'),
        ink: withAlpha('--c-ink'),
        muted: withAlpha('--c-muted'),
        hairline: withAlpha('--c-hairline'),
        accent: withAlpha('--c-accent'),
        income: withAlpha('--c-income'),
        expense: withAlpha('--c-expense'),
        warn: withAlpha('--c-warn')
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif']
      },
      fontSize: {
        xs: ['0.75rem', { lineHeight: '1rem' }],
        sm: ['0.875rem', { lineHeight: '1.25rem' }],
        base: ['1rem', { lineHeight: '1.5rem' }],
        lg: ['1.25rem', { lineHeight: '1.75rem' }],
        xl: ['1.75rem', { lineHeight: '2.125rem' }],
        '2xl': ['2.25rem', { lineHeight: '2.5rem' }]
      },
      spacing: {
        // 4px base scale already covered by defaults; explicit aliases for clarity
      },
      borderRadius: {
        card: '8px',
        control: '6px'
      },
      transitionTimingFunction: {
        out: 'cubic-bezier(0.16, 1, 0.3, 1)'
      }
    }
  },
  plugins: []
};
