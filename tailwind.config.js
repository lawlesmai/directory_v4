/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Primary Palette
        'navy-dark': '#001219',
        'teal-primary': '#005F73',
        'teal-secondary': '#0A9396',
        'sage': '#94D2BD',
        'cream': '#E9D8A6',
        'gold-primary': '#EE9B00',
        'gold-secondary': '#CA6702',
        'red-warning': '#BB3E03',
        'red-error': '#AE2012',
        'red-critical': '#9B2226',
        
        // Extended Palette for UI
        'navy-90': 'rgba(0, 18, 25, 0.9)',
        'navy-70': 'rgba(0, 18, 25, 0.7)',
        'navy-50': 'rgba(0, 18, 25, 0.5)',
        'teal-20': 'rgba(0, 95, 115, 0.2)',
        'teal-10': 'rgba(0, 95, 115, 0.1)',
        
        // Semantic Colors
        'text-primary': '#E9D8A6',
        'text-secondary': '#94D2BD',
        'text-muted': 'rgba(233, 216, 166, 0.7)',
        'border': 'rgba(148, 210, 189, 0.2)',
        'overlay': 'rgba(0, 18, 25, 0.85)',
      },
      backgroundImage: {
        'gradient-premium': 'linear-gradient(135deg, #EE9B00 0%, #CA6702 100%)',
        'gradient-trust': 'linear-gradient(135deg, #005F73 0%, #0A9396 100%)',
        'gradient-dark': 'linear-gradient(180deg, #001219 0%, #005F73 100%)',
        'gradient-bg': 'linear-gradient(-45deg, #001219, #005F73, #0A9396, #005F73)',
      },
      fontFamily: {
        'poppins': ['var(--font-poppins)', 'Poppins', 'sans-serif'],
        'inter': ['var(--font-inter)', 'Inter', 'sans-serif'],
      },
      fontSize: {
        'xs': '0.75rem',
        'sm': '0.875rem',
        'base': '1rem',
        'lg': '1.125rem',
        'xl': '1.25rem',
        '2xl': '1.5rem',
        '3xl': '1.875rem',
        '4xl': '2.25rem',
        '5xl': '3rem',
        '6xl': '3.75rem',
      },
      spacing: {
        '18': '4.5rem',
        '22': '5.5rem',
        '88': '22rem',
        '100': '25rem',
      },
      backdropBlur: {
        'xs': '2px',
        'sm': '4px',
        'md': '12px',
        'lg': '16px',
        'xl': '24px',
        '2xl': '40px',
        '3xl': '64px',
      },
      animation: {
        'fade-in': 'fadeIn 0.6s ease-out',
        'slide-up': 'slideUp 0.6s ease-out',
        'scale-in': 'scaleIn 0.4s ease-out',
        'shimmer': 'shimmer 2s linear infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(20px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        scaleIn: {
          '0%': { transform: 'scale(0.95)', opacity: '0' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
      },
      transitionTimingFunction: {
        'smooth': 'cubic-bezier(0.25, 0.46, 0.45, 0.94)',
        'bounce-soft': 'cubic-bezier(0.68, -0.55, 0.265, 1.55)',
      },
    },
  },
  plugins: [],
}