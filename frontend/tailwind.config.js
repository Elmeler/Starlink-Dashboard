/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg:          'var(--bg-base)',
        card:        'var(--bg-card)',
        border:      'var(--border)',
        accent:      'var(--accent)',
        success:     'var(--good)',
        warning:     'var(--warn)',
        danger:      'var(--bad)',
        textprimary: 'var(--text-1)',
        textmuted:   'var(--text-4)',
        activebg:    'var(--accent-bg)',
        hoverbg:     'var(--bg-input)',
        alertbg:     'var(--alert-bg)',
        alertborder: 'var(--alert-border)',
      },
      fontFamily: {
        sans: ['"Space Grotesk"', 'Inter', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
    },
  },
  plugins: [],
}
