import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: 'class',
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // ── New dark slate + cyan design system ──────────────────────────
        canvas:    '#0a0e17',
        surface1:  '#0f1623',
        surface2:  '#161d2e',
        surface3:  '#1e2740',
        hairline:  '#1e2d45',
        'hairline-strong': '#2a3f5f',
        ink:       '#f0f4f8',
        'ink-muted':    '#8a9bb5',
        'ink-subtle':   '#6b7d96',
        'ink-tertiary': '#4a5568',
        primary:        '#00d4ff',
        'primary-hover':'#33ddff',
        'primary-focus':'#0098b8',
        'ai-thinking':  '#dfa88f',
        'ai-reading':   '#9fbbe0',
        'ai-editing':   '#c0a8dd',
        'ai-done':      '#c08532',
        easy:    '#10b981',
        medium:  '#f59e0b',
        hard:    '#ef4444',
        // legacy aliases (keep existing pages working)
        background: '#0a0e17',
        surface:    '#0f1623',
        'surface-2':'#161d2e',
        'surface-3':'#1e2740',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
      borderRadius: {
        sm:   '6px',
        md:   '8px',
        lg:   '12px',
        xl:   '16px',
        pill: '9999px',
      },
      animation: {
        'fade-in': 'fadeIn 0.5s ease-in-out',
        'slide-up': 'slideUp 0.4s ease-out',
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'reaction-pop': 'reactionPop 0.3s cubic-bezier(0.175,0.885,0.32,1.275)',
        'fade-in-up': 'fadeInUp 0.25s ease-out',
      },
      keyframes: {
        fadeIn: {
          '0%':   { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%':   { transform: 'translateY(10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)',    opacity: '1' },
        },
        reactionPop: {
          '0%':   { transform: 'scale(0) translateY(10px)', opacity: '0' },
          '100%': { transform: 'scale(1) translateY(0)',    opacity: '1' },
        },
        fadeInUp: {
          '0%':   { transform: 'translateY(6px)', opacity: '0' },
          '100%': { transform: 'translateY(0)',   opacity: '1' },
        },
      },
    },
  },
  plugins: [],
};

export default config;
