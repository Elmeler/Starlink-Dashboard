/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg:          'var(--sl-bg)',
        card:        'var(--sl-surface)',
        border:      'var(--sl-border)',
        accent:      'var(--sl-accent)',
        success:     'var(--sl-success)',
        warning:     'var(--sl-warning)',
        danger:      'var(--sl-danger)',
        textprimary: 'var(--sl-text-hi)',
        textmuted:   'var(--sl-text-lo)',
        activebg:    'var(--sl-accent-bg)',
        hoverbg:     'var(--sl-surface-alt)',
        alertbg:     'var(--sl-alert-bg)',
        alertborder: 'var(--sl-alert-border)',
      },
      fontFamily: {
        sans: ['"Space Grotesk"', 'Inter', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
    },
  },
  plugins: [],
}
