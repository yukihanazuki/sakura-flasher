/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/renderer/**/*.{js,ts,jsx,tsx}', './src/shared/**/*.{js,ts,jsx,tsx}'],
  darkMode: ['class', '[data-theme="dark"]'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Zen Kaku Gothic New"', 'system-ui', 'sans-serif'],
        display: ['"Dela Gothic One"', '"Zen Kaku Gothic New"', 'sans-serif'],
        mono: ['"JetBrains Mono Variable"', 'ui-monospace', 'monospace'],
      },
      colors: {
        bg: 'rgb(var(--bg) / <alpha-value>)',
        surface: 'rgb(var(--surface) / <alpha-value>)',
        surface2: 'rgb(var(--surface-2) / <alpha-value>)',
        surface3: 'rgb(var(--surface-3) / <alpha-value>)',
        line: 'rgb(var(--line) / <alpha-value>)',
        lineStrong: 'rgb(var(--line-strong) / <alpha-value>)',
        text: 'rgb(var(--text) / <alpha-value>)',
        muted: 'rgb(var(--muted) / <alpha-value>)',
        faint: 'rgb(var(--faint) / <alpha-value>)',
        accent: 'rgb(var(--accent) / <alpha-value>)',
        sakura: 'rgb(var(--sakura) / <alpha-value>)',
        'accent-fg': 'rgb(var(--accent-fg) / <alpha-value>)',
        success: 'rgb(var(--success) / <alpha-value>)',
        warning: 'rgb(var(--warning) / <alpha-value>)',
        danger: 'rgb(var(--danger) / <alpha-value>)',
        info: 'rgb(var(--info) / <alpha-value>)',
      },
      borderRadius: { sm: '2px', md: '4px', lg: '6px' },
      boxShadow: {
        manga: '4px 4px 0 0 rgb(var(--line-strong) / 0.35)',
        'manga-lg': '6px 6px 0 0 rgb(var(--line-strong) / 0.5)',
      },
      keyframes: {
        sakuraFall: {
          '0%': { transform: 'translateY(-12px) rotate(0deg)', opacity: 0 },
          '12%': { opacity: 0.9 },
          '88%': { opacity: 0.75 },
          '100%': { transform: 'translateY(150px) rotate(420deg)', opacity: 0 },
        },
      },
      animation: {
        sakuraFall: 'sakuraFall 7s linear infinite',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
};
