/** @type {import('tailwindcss').Config} */
const withAlpha = (v) => `rgb(var(${v}) / <alpha-value>)`;

export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{svelte,ts,js}'],
  theme: {
    extend: {
      colors: {
        // Brand palette (existing — unchanged so existing classes keep working)
        paper: withAlpha('--c-paper'),
        surface: withAlpha('--c-surface'),
        ink: withAlpha('--c-ink'),
        muted: withAlpha('--c-muted'),
        hairline: withAlpha('--c-hairline'),
        accent: withAlpha('--c-accent'),
        income: withAlpha('--c-income'),
        expense: withAlpha('--c-expense'),
        warn: withAlpha('--c-warn'),
        // Shadcn-svelte semantic tokens (added alongside, no name collisions)
        background: withAlpha('--background'),
        foreground: withAlpha('--foreground'),
        card: {
          DEFAULT: withAlpha('--card'),
          foreground: withAlpha('--card-foreground')
        },
        popover: {
          DEFAULT: withAlpha('--popover'),
          foreground: withAlpha('--popover-foreground')
        },
        primary: {
          DEFAULT: withAlpha('--primary'),
          foreground: withAlpha('--primary-foreground')
        },
        secondary: {
          DEFAULT: withAlpha('--secondary'),
          foreground: withAlpha('--secondary-foreground')
        },
        destructive: {
          DEFAULT: withAlpha('--destructive'),
          foreground: withAlpha('--destructive-foreground')
        },
        border: withAlpha('--border'),
        input: withAlpha('--input'),
        ring: withAlpha('--ring')
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
      spacing: {},
      borderRadius: {
        // Existing
        card: '8px',
        control: '6px',
        // Shadcn semantic (derived from --radius token)
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)'
      },
      transitionTimingFunction: {
        out: 'cubic-bezier(0.16, 1, 0.3, 1)'
      }
    }
  },
  plugins: [require('tailwindcss-animate')]
};
