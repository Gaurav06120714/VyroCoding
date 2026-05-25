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
        canvas:    '#010102',
        surface1:  '#0f1011',
        surface2:  '#141516',
        surface3:  '#18191a',
        hairline:  '#23252a',
        'hairline-strong': '#34343a',
        ink:       '#f7f8f8',
        'ink-muted':    '#d0d6e0',
        'ink-subtle':   '#8a8f98',
        'ink-tertiary': '#62666d',
        primary:        '#5e6ad2',
        'primary-hover':'#828fff',
        'primary-focus':'#5e69d1',
        'ai-thinking':  '#dfa88f',
        'ai-reading':   '#9fbbe0',
        'ai-editing':   '#c0a8dd',
        'ai-done':      '#c08532',
        easy:    '#27a644',
        medium:  '#f5a623',
        hard:    '#cf2d56',
        // legacy aliases (keep existing pages working)
        background: '#010102',
        surface:    '#0f1011',
        'surface-2':'#141516',
        'surface-3':'#18191a',
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
