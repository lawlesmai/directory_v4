'use client';

import React from 'react';

export interface GlassMorphismProps {
  children: React.ReactNode;
  variant?: 'subtle' | 'medium' | 'strong' | 'custom';
  className?: string;
  style?: React.CSSProperties;
  backdrop?: 'blur' | 'saturate' | 'both';
  intensity?: 'light' | 'medium' | 'heavy';
  tint?: 'neutral' | 'warm' | 'cool' | 'brand';
  border?: boolean;
  shadow?: boolean;
  animated?: boolean;
  interactive?: boolean;
  as?: keyof JSX.IntrinsicElements;
  onClick?: (event: React.MouseEvent) => void;
  onHover?: (isHovered: boolean) => void;
}

const VARIANT_PRESETS = {
  subtle: {
    backdropFilter: 'blur(8px) saturate(120%)',
    background: 'rgba(255, 255, 255, 0.05)',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    boxShadow: '0 2px 16px rgba(0, 0, 0, 0.05)'
  },
  medium: {
    backdropFilter: 'blur(12px) saturate(150%)',
    background: 'rgba(255, 255, 255, 0.1)',
    border: '1px solid rgba(255, 255, 255, 0.15)',
    boxShadow: '0 4px 24px rgba(0, 0, 0, 0.1)'
  },
  strong: {
    backdropFilter: 'blur(16px) saturate(180%)',
    background: 'rgba(255, 255, 255, 0.15)',
    border: '1px solid rgba(255, 255, 255, 0.2)',
    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.15)'
  },
  custom: {}
};

const TINT_COLORS = {
  neutral: 'rgba(255, 255, 255, 0.1)',
  warm: 'rgba(255, 248, 240, 0.1)',
  cool: 'rgba(240, 248, 255, 0.1)',
  brand: 'rgba(59, 130, 246, 0.05)'
};

const INTENSITY_MODIFIERS = {
  light: { opacity: 0.7, blur: 0.8, shadow: 0.6 },
  medium: { opacity: 1, blur: 1, shadow: 1 },
  heavy: { opacity: 1.3, blur: 1.2, shadow: 1.4 }
};

export const GlassMorphism: React.FC<GlassMorphismProps> = ({
  children,
  variant = 'medium',
  className = '',
  style = {},
  backdrop = 'both',
  intensity = 'medium',
  tint = 'neutral',
  border = true,
  shadow = true,
  animated = false,
  interactive = false,
  as: Component = 'div',
  onClick,
  onHover
}) => {
  const [isHovered, setIsHovered] = React.useState(false);
  
  // Get base preset
  const preset = VARIANT_PRESETS[variant];
  const intensityMod = INTENSITY_MODIFIERS[intensity];
  const tintColor = TINT_COLORS[tint];
  
  // Build backdrop filter
  const backdropFilters = [];
  if (backdrop === 'blur' || backdrop === 'both') {
    const blurAmount = parseInt(preset.backdropFilter?.match(/blur\((\d+)px\)/)?.[1] || '12');
    backdropFilters.push(`blur(${blurAmount * intensityMod.blur}px)`);
  }
  if (backdrop === 'saturate' || backdrop === 'both') {
    const saturateAmount = parseInt(preset.backdropFilter?.match(/saturate\((\d+)%\)/)?.[1] || '150');
    backdropFilters.push(`saturate(${saturateAmount}%)`);
  }
  
  // Build background
  let background = preset.background || 'rgba(255, 255, 255, 0.1)';
  if (tint !== 'neutral') {
    // Mix tint with base background
    const baseOpacity = parseFloat(background.match(/[\d.]+(?=\))/)?.[0] || '0.1');
    const adjustedOpacity = Math.min(baseOpacity * intensityMod.opacity, 0.3);
    background = tintColor.replace(/[\d.]+(?=\))/, adjustedOpacity.toString());
  }
  
  // Build box shadow
  let boxShadow = preset.boxShadow || '0 4px 24px rgba(0, 0, 0, 0.1)';
  if (shadow && intensityMod.shadow !== 1) {
    // Adjust shadow opacity
    boxShadow = boxShadow.replace(/rgba\(0, 0, 0, ([\d.]+)\)/, (match, opacity) => 
      `rgba(0, 0, 0, ${parseFloat(opacity) * intensityMod.shadow})`
    );
  }
  
  // Build border
  const borderStyle = border && preset.border ? preset.border : 'none';
  
  // Interactive hover effects
  const hoverStyles: React.CSSProperties = interactive ? {
    background: background.replace(/rgba\(([\d,\s]+),\s*([\d.]+)\)/, (match, rgb, alpha) => 
      `rgba(${rgb}, ${Math.min(parseFloat(alpha) * 1.2, 0.3)})`,
    ),
    transform: 'translateY(-1px)',
    boxShadow: boxShadow.replace(/rgba\(0, 0, 0, ([\d.]+)\)/, (match, opacity) => 
      `rgba(0, 0, 0, ${Math.min(parseFloat(opacity) * 1.5, 0.25)})`
    )
  } : {};
  
  // Animation styles
  const animationStyles: React.CSSProperties = animated ? {
    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
    willChange: 'transform, background, box-shadow, backdrop-filter'
  } : {};
  
  // Combined styles
  const combinedStyles: React.CSSProperties = {
    backdropFilter: backdropFilters.join(' '),
    WebkitBackdropFilter: backdropFilters.join(' '), // Safari support
    background,
    border: borderStyle,
    boxShadow: shadow ? boxShadow : 'none',
    borderRadius: '12px',
    position: 'relative',
    overflow: 'hidden',
    ...animationStyles,
    ...(interactive && isHovered ? hoverStyles : {}),
    ...style
  };
  
  // Event handlers
  const handleMouseEnter = React.useCallback(() => {
    if (interactive) {
      setIsHovered(true);
      onHover?.(true);
    }
  }, [interactive, onHover]);
  
  const handleMouseLeave = React.useCallback(() => {
    if (interactive) {
      setIsHovered(false);
      onHover?.(false);
    }
  }, [interactive, onHover]);
  
  const handleClick = React.useCallback((event: React.MouseEvent) => {
    onClick?.(event);
  }, [onClick]);
  
  // Add noise texture for enhanced glass effect (optional)
  const NoiseTexture = React.memo(() => (
    <div
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        opacity: 0.03,
        mixBlendMode: 'overlay' as const,
        backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cdefs%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3C/defs%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
        pointerEvents: 'none'
      }}
    />
  ));
  
  NoiseTexture.displayName = 'NoiseTexture';
  
  return React.createElement(
    Component,
    {
      className: `glassmorphism ${className}`.trim(),
      style: combinedStyles,
      onClick: onClick ? handleClick : undefined,
      onMouseEnter: interactive ? handleMouseEnter : undefined,
      onMouseLeave: interactive ? handleMouseLeave : undefined,
      'data-variant': variant,
      'data-intensity': intensity,
      'data-tint': tint,
      'data-interactive': interactive,
      'data-animated': animated
    },
    <>
      {variant === 'strong' && <NoiseTexture />}
      {children}
    </>
  );
};

// Utility hook for programmatic glassmorphism styles
export const useGlassMorphism = (
  variant: GlassMorphismProps['variant'] = 'medium',
  options: Partial<Pick<GlassMorphismProps, 'intensity' | 'tint' | 'backdrop'>> = {}
) => {
  const { intensity = 'medium', tint = 'neutral', backdrop = 'both' } = options;
  
  return React.useMemo(() => {
    const preset = VARIANT_PRESETS[variant];
    const intensityMod = INTENSITY_MODIFIERS[intensity];
    const tintColor = TINT_COLORS[tint];
    
    // Build backdrop filter
    const backdropFilters = [];
    if (backdrop === 'blur' || backdrop === 'both') {
      const blurAmount = parseInt(preset.backdropFilter?.match(/blur\((\d+)px\)/)?.[1] || '12');
      backdropFilters.push(`blur(${blurAmount * intensityMod.blur}px)`);
    }
    if (backdrop === 'saturate' || backdrop === 'both') {
      const saturateAmount = parseInt(preset.backdropFilter?.match(/saturate\((\d+)%\)/)?.[1] || '150');
      backdropFilters.push(`saturate(${saturateAmount}%)`);
    }
    
    // Build background
    let background = preset.background || 'rgba(255, 255, 255, 0.1)';
    if (tint !== 'neutral') {
      const baseOpacity = parseFloat(background.match(/[\d.]+(?=\))/)?.[0] || '0.1');
      const adjustedOpacity = Math.min(baseOpacity * intensityMod.opacity, 0.3);
      background = tintColor.replace(/[\d.]+(?=\))/, adjustedOpacity.toString());
    }
    
    return {
      backdropFilter: backdropFilters.join(' '),
      WebkitBackdropFilter: backdropFilters.join(' '),
      background,
      border: preset.border,
      boxShadow: preset.boxShadow?.replace(/rgba\(0, 0, 0, ([\d.]+)\)/, (match, opacity) => 
        `rgba(0, 0, 0, ${parseFloat(opacity) * intensityMod.shadow})`
      ),
      borderRadius: '12px'
    } as React.CSSProperties;
  }, [variant, intensity, tint, backdrop]);
};

// Helper component for glassmorphism containers
export const GlassContainer: React.FC<{
  children: React.ReactNode;
  className?: string;
  variant?: GlassMorphismProps['variant'];
}> = ({ children, className = '', variant = 'medium' }) => (
  <GlassMorphism
    variant={variant}
    className={`p-6 ${className}`}
    animated
    border
    shadow
  >
    {children}
  </GlassMorphism>
);

// Helper component for glassmorphism cards
export const GlassCard: React.FC<{
  children: React.ReactNode;
  className?: string;
  interactive?: boolean;
  onClick?: (event: React.MouseEvent) => void;
}> = ({ children, className = '', interactive = false, onClick }) => (
  <GlassMorphism
    variant="medium"
    className={`p-4 ${className}`}
    animated
    interactive={interactive}
    border
    shadow
    onClick={onClick}
  >
    {children}
  </GlassMorphism>
);

export default GlassMorphism;