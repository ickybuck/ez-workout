/** @type {import('tailwindcss').Config} */

/**
 * Every colour is declared as `rgb(var(--token) / <alpha-value>)` rather than a
 * literal. That placeholder is what keeps Tailwind's opacity modifiers working
 * — `bg-surface-raised/50` compiles to `rgb(var(--surface-raised) / 0.5)` —
 * which is why the tokens in styles/tokens.css are raw channels rather than
 * hex.
 */
const token = (name) => `rgb(var(--${name}) / <alpha-value>)`;

export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  // 'class', not 'media': the app offers an explicit light/dark choice as
  // well as following the device, and 'media' can only do the latter.
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Named by role, so a component never asserts a colour and is therefore
        // correct in both themes without carrying a single `dark:` variant.
        surface: {
          DEFAULT: token('surface'),
          sunken: token('surface-sunken'),
          raised: token('surface-raised'),
          overlay: token('surface-overlay'),
        },
        content: {
          DEFAULT: token('content'),
          muted: token('content-muted'),
          subtle: token('content-subtle'),
          inverse: token('content-inverse'),
        },
        edge: {
          DEFAULT: token('border'),
          strong: token('border-strong'),
        },
        accent: {
          DEFAULT: token('accent'),
          hover: token('accent-hover'),
          soft: token('accent-soft'),
          content: token('accent-content'),
        },
        positive: {
          DEFAULT: token('positive'),
          soft: token('positive-soft'),
          content: token('positive-content'),
        },
        caution: {
          DEFAULT: token('caution'),
          soft: token('caution-soft'),
          content: token('caution-content'),
        },
        critical: {
          DEFAULT: token('critical'),
          soft: token('critical-soft'),
          content: token('critical-content'),
        },
      },
    },
  },
  plugins: [],
};
