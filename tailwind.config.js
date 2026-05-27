/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: [
          '-apple-system', 'BlinkMacSystemFont', 'SF Pro Text', 'SF Pro Display',
          'system-ui', 'Segoe UI', 'Roboto', 'Helvetica', 'Arial', 'sans-serif',
        ],
      },
      colors: {
        ink: {
          DEFAULT: '#0a0a0a',
          muted: '#737373',
          subtle: '#525252',
        },
        surface: {
          DEFAULT: '#ffffff',
          alt: '#fafafa',
          alt2: '#f4f4f5',
          line: '#e5e5e5',
        },
        // Couleurs marque Silverlit — rouge & blanc, inspiration silverlit.com
        silverlit: {
          red: '#e30613',
          'red-deep': '#b8050f',
          'red-soft': '#fff1f2',
          'red-tint': '#ffe4e6',
        },
        brand: {
          red: '#ff3b30',     // alertes critiques (Apple system red)
          orange: '#ff9500',
          green: '#34c759',
          blue: '#007aff',
        },
        // Accent ANIZIA — bleu officiel de la marque (logo wordmark "ia").
        // Distinct du rouge Silverlit et du bleu système. Lisible en clair
        // comme en sombre (variante `light` plus claire pour fond foncé).
        anizia: {
          DEFAULT: '#2266dd',
          light: '#5b9dff',
        },
        night: {
          bg: '#0a0a0a',
          surface: '#171717',
          alt: '#262626',
          line: '#3a3a3c',
          ink: '#f5f5f7',
          muted: '#98989d',
        },
      },
      letterSpacing: {
        tightish: '-0.02em',
        tighter2: '-0.025em',
        tighter3: '-0.035em',
      },
      fontSize: {
        '2xs': ['0.6875rem', { lineHeight: '1rem' }],
      },
      borderWidth: {
        hair: '0.5px',
      },
      transitionTimingFunction: {
        'apple': 'cubic-bezier(0.4, 0, 0.2, 1)',
      },
      animation: {
        'fade-in': 'fadeIn 200ms ease-out',
        'slide-up': 'slideUp 240ms cubic-bezier(0.4, 0, 0.2, 1)',
        'page-in': 'pageIn 320ms cubic-bezier(0.16, 1, 0.3, 1)',
        'card-in': 'cardIn 380ms cubic-bezier(0.16, 1, 0.3, 1) both',
        'pulse-soft': 'pulseSoft 2.8s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'pulse-soft-delayed': 'pulseSoft 2.8s cubic-bezier(0.4, 0, 0.6, 1) 1.4s infinite',
        'bob': 'bob 5s cubic-bezier(0.4, 0, 0.2, 1) infinite',
        'wiggle': 'wiggle 600ms cubic-bezier(0.4, 0, 0.2, 1)',
        'pop': 'pop 320ms cubic-bezier(0.34, 1.56, 0.64, 1)',
        'sheen': 'sheen 2.4s ease-out infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        pageIn: {
          '0%': { opacity: '0', transform: 'translateY(12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        cardIn: {
          '0%': { opacity: '0', transform: 'translateY(14px) scale(0.98)' },
          '100%': { opacity: '1', transform: 'translateY(0) scale(1)' },
        },
        pulseSoft: {
          '0%, 100%': { transform: 'scale(1)', opacity: '1' },
          '50%': { transform: 'scale(1.12)', opacity: '0.88' },
        },
        bob: {
          '0%, 88%, 100%': { transform: 'translateY(0) rotate(0deg)' },
          '92%': { transform: 'translateY(-3px) rotate(-3deg)' },
          '96%': { transform: 'translateY(-2px) rotate(3deg)' },
        },
        wiggle: {
          '0%, 100%': { transform: 'rotate(0deg)' },
          '25%': { transform: 'rotate(-3deg)' },
          '75%': { transform: 'rotate(3deg)' },
        },
        pop: {
          '0%': { transform: 'scale(0.9)', opacity: '0' },
          '60%': { transform: 'scale(1.05)' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        sheen: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
      },
    },
  },
  plugins: [],
}
