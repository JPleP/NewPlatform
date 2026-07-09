/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ['class'],
  content: [
    './index.html',
    './src/**/*.{ts,tsx,js,jsx}',
  ],
  theme: {
    extend: {
      colors: {
        // SDN brand palette
        sdn: {
          50:  '#eef7ff',
          100: '#d9edff',
          200: '#bbdeff',
          300: '#8cc8ff',
          400: '#57a8ff',
          500: '#2f83fc',
          600: '#1a62f1',
          700: '#154bde',
          800: '#173db4',
          900: '#18388e',
          950: '#132357',
        },
        // Device-type accent colors
        controller: '#8b5cf6',  // purple  - ONOS controller
        switch:     '#0ea5e9',  // sky     - OVS switch
        host:       '#22c55e',  // green   - Raspberry Pi host
        // Utilization gradient stops
        util: {
          low:    '#22c55e',   // green   0-50%
          medium: '#f59e0b',   // amber   50-75%
          high:   '#ef4444',   // red     75-100%
        },
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'Fira Code', 'Consolas', 'monospace'],
      },
      keyframes: {
        'pulse-ring': {
          '0%, 100%': { transform: 'scale(1)', opacity: '1' },
          '50%': { transform: 'scale(1.15)', opacity: '0.7' },
        },
        'slide-in-right': {
          from: { transform: 'translateX(100%)', opacity: '0' },
          to: { transform: 'translateX(0)', opacity: '1' },
        },
        'fade-in': {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
      },
      animation: {
        'pulse-ring': 'pulse-ring 2s ease-in-out infinite',
        'slide-in-right': 'slide-in-right 0.25s ease-out',
        'fade-in': 'fade-in 0.2s ease-out',
      },
    },
  },
  plugins: [],
}
