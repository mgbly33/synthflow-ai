/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        studio: {
          bg: '#0D1117',
          panel: '#121822',
          surface: '#161E2B',
          elevated: '#1C2536',
          border: '#253146',
        },
        lab: {
          bg: '#F7F8FA',
          panel: '#FFFFFF',
          surface: '#F1F4F9',
          border: '#E2E8F0',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      animation: {
        'node-pulse': 'nodePulse 1.8s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'flow-dash': 'flowDash 0.9s linear infinite',
      },
      keyframes: {
        nodePulse: {
          '0%, 100%': { boxShadow: '0 0 0 0 rgba(139, 92, 246, 0.55), 0 0 22px 2px rgba(139, 92, 246, 0.35)' },
          '50%': { boxShadow: '0 0 0 6px rgba(139, 92, 246, 0.08), 0 0 32px 6px rgba(139, 92, 246, 0.55)' },
        },
        flowDash: {
          '0%': { strokeDashoffset: '24' },
          '100%': { strokeDashoffset: '0' },
        },
      },
    },
  },
  plugins: [],
}
