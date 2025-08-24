# The Lawless Directory - CSS Design System

**Created:** 2024-08-23  
**Purpose:** Complete catalog of CSS custom properties and design tokens  
**Scope:** Comprehensive design system analysis  

## Table of Contents

1. [Design System Overview](#design-system-overview)
2. [Color Palette](#color-palette)
3. [Typography System](#typography-system)
4. [Spacing & Layout](#spacing--layout)
5. [Component Design](#component-design)
6. [Animation System](#animation-system)

## Design System Overview

The CSS design system uses 80+ custom properties organized into semantic categories. The system follows a mobile-first, glass morphism aesthetic with premium business directory styling.

### CSS Custom Properties Structure
```css
:root {
  /* 85 custom properties total */
  /* Primary Palette: 10 properties */
  /* Extended UI Colors: 5 properties */
  /* Gradients: 4 properties */
  /* Semantic Colors: 5 properties */
  /* Typography: 15 properties */
  /* Spacing: 6 properties */
  /* Border Radius: 5 properties */
  /* Shadows: 5 properties */
  /* Transitions: 4 properties */
}
```

## Color Palette

### Primary Palette (10 Properties)
The color scheme uses a sophisticated navy-to-teal gradient with gold accents:

```css
--color-navy-dark: #001219        /* Deep navy background */
--color-teal-primary: #005F73     /* Primary teal for headers */
--color-teal-secondary: #0A9396   /* Secondary teal for accents */
--color-sage: #94D2BD             /* Sage green for text/borders */
--color-cream: #E9D8A6            /* Warm cream for primary text */
--color-gold-primary: #EE9B00     /* Gold for premium elements */
--color-gold-secondary: #CA6702   /* Darker gold for gradients */
--color-red-warning: #BB3E03      /* Warning state color */
--color-red-error: #AE2012        /* Error state color */
--color-red-critical: #9B2226     /* Critical alert color */
```

### Extended Palette for UI (5 Properties)
Semi-transparent variants for glass morphism effects:

```css
--color-navy-90: rgba(0, 18, 25, 0.9)    /* Modal backgrounds */
--color-navy-70: rgba(0, 18, 25, 0.7)    /* Overlay effects */
--color-navy-50: rgba(0, 18, 25, 0.5)    /* Subtle backgrounds */
--color-teal-20: rgba(0, 95, 115, 0.2)   /* Hover states */
--color-teal-10: rgba(0, 95, 115, 0.1)   /* Very subtle backgrounds */
```

### Semantic Colors (5 Properties)
Context-specific color assignments:

```css
--color-text-primary: #E9D8A6             /* Main text color */
--color-text-secondary: #94D2BD           /* Secondary text */
--color-text-muted: rgba(233, 216, 166, 0.7)  /* Muted text */
--color-border: rgba(148, 210, 189, 0.2)  /* Border color */
--color-overlay: rgba(0, 18, 25, 0.85)    /* Backdrop overlays */
```

### Gradient Definitions (4 Properties)
Premium gradient combinations:

```css
--gradient-premium: linear-gradient(135deg, #EE9B00 0%, #CA6702 100%)
--gradient-trust: linear-gradient(135deg, #005F73 0%, #0A9396 100%)
--gradient-dark: linear-gradient(180deg, #001219 0%, #005F73 100%)
--gradient-bg: linear-gradient(-45deg, #001219, #005F73, #0A9396, #005F73)
```

## Typography System

### Font Configuration (4 Properties)
```css
--font-family-heading: 'Poppins', sans-serif    /* Premium headings */
--font-family-body: 'Inter', -apple-system, sans-serif  /* Body text */
```

Font loading is optimized with preconnect and preload:
```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preload" href="https://fonts.googleapis.com/css2?family=Poppins:wght@500;600;700&family=Inter:wght@400;500&display=swap" as="style">
```

### Type Scale (9 Properties)
Modular scale from 0.75rem to 3rem:

```css
--text-xs: 0.75rem      /* 12px - Small labels */
--text-sm: 0.875rem     /* 14px - Secondary text */
--text-base: 1rem       /* 16px - Body text */
--text-lg: 1.125rem     /* 18px - Large body text */
--text-xl: 1.25rem      /* 20px - Small headings */
--text-2xl: 1.5rem      /* 24px - Section headings */
--text-3xl: 1.875rem    /* 30px - Page headings */
--text-4xl: 2.25rem     /* 36px - Hero text */
--text-5xl: 3rem        /* 48px - Large hero text */
```

### Font Weights (5 Properties)
```css
--font-light: 300       /* Light text (not used) */
--font-regular: 400     /* Body text */
--font-medium: 500      /* Emphasized text */
--font-semibold: 600    /* Strong emphasis */
--font-bold: 700        /* Headings and CTAs */
```

## Spacing & Layout

### Spacing Scale (6 Properties)
Consistent spacing system based on 0.25rem increments:

```css
--space-xs: 0.25rem     /* 4px - Tight spacing */
--space-sm: 0.5rem      /* 8px - Small gaps */
--space-md: 1rem        /* 16px - Standard spacing */
--space-lg: 1.5rem      /* 24px - Large spacing */
--space-xl: 2rem        /* 32px - Section spacing */
--space-2xl: 3rem       /* 48px - Major sections */
```

### Border Radius (5 Properties)
Rounded corner system for modern UI:

```css
--radius-sm: 0.375rem   /* 6px - Small elements */
--radius-md: 0.5rem     /* 8px - Cards, buttons */
--radius-lg: 0.75rem    /* 12px - Large cards */
--radius-xl: 1rem       /* 16px - Panels */
--radius-full: 50px     /* Pill-shaped elements */
```

## Component Design

### Shadow System (5 Properties)
Layered shadow system for depth:

```css
--shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.05)      /* Subtle depth */
--shadow-md: 0 4px 6px rgba(0, 0, 0, 0.1)       /* Cards */
--shadow-lg: 0 10px 15px rgba(0, 0, 0, 0.1)     /* Elevated elements */
--shadow-xl: 0 20px 25px rgba(0, 0, 0, 0.1)     /* Floating elements */
--shadow-glow: 0 0 20px rgba(238, 155, 0, 0.3)  /* Premium glow */
```

### Glass Morphism Implementation
Glass effects use backdrop-filter and semi-transparent backgrounds:

```css
.header-glass {
  background: var(--color-navy-90);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
}

.business-card {
  background: rgba(0, 95, 115, 0.1);
  backdrop-filter: blur(10px);
}
```

## Animation System

### Transition Properties (4 Properties)
Consistent timing functions:

```css
--transition-base: all 0.3s ease        /* Standard transitions */
--transition-fast: all 0.15s ease       /* Quick interactions */
--transition-slow: all 0.6s ease        /* Smooth animations */
--ease-out-back: cubic-bezier(0.175, 0.885, 0.32, 1.275)  /* Bouncy effect */
```

### Key Animations

**Gradient Background Animation:**
```css
@keyframes gradientShift {
  0% { background-position: 0% 50%; }
  50% { background-position: 100% 50%; }
  100% { background-position: 0% 50%; }
}
.gradient-bg {
  animation: gradientShift 15s ease infinite;
}
```

**Card Reveal Animation:**
```css
@keyframes cardReveal {
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
.business-card {
  opacity: 0;
  transform: translateY(20px);
  animation: cardReveal 0.6s ease-out forwards;
}
```

**Premium Pulse Effect:**
```css
@keyframes premiumPulse {
  0%, 100% { box-shadow: 0 0 20px rgba(238, 155, 0, 0.3); }
  50% { box-shadow: 0 0 30px rgba(238, 155, 0, 0.5); }
}
.business-card.premium {
  animation: cardReveal 0.6s ease-out forwards, premiumPulse 3s ease-in-out infinite;
}
```

**Skeleton Loading Animation:**
```css
@keyframes skeletonWave {
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}
.skeleton {
  animation: skeletonWave 1.5s ease-in-out infinite;
}
```

The design system provides a cohesive, premium aesthetic with consistent spacing, color usage, and animation patterns throughout the application.
