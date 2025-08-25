import { useRef, useCallback, useEffect, useState } from 'react';
import { useIntersectionObserver } from './useIntersectionObserver';

interface AnimationConfig {
  staggerDelay?: number;
  animationDuration?: number;
  easing?: string;
  enableHover?: boolean;
  enablePremiumEffects?: boolean;
  reducedMotion?: boolean;
}

interface CardAnimationState {
  isRevealed: boolean;
  isHovered: boolean;
  isPremium: boolean;
  isAnimating: boolean;
  animationType?: 'fadeIn' | 'slideUp' | 'scaleIn' | 'premium';
}

interface UseCardAnimationsOptions extends AnimationConfig {
  onCardReveal?: (cardId: string, index: number) => void;
  onCardHover?: (cardId: string, isHovered: boolean) => void;
  onAnimationComplete?: (cardId: string) => void;
}

const DEFAULT_CONFIG: AnimationConfig = {
  staggerDelay: 150,
  animationDuration: 600,
  easing: 'cubic-bezier(0.4, 0, 0.2, 1)',
  enableHover: true,
  enablePremiumEffects: true,
  reducedMotion: false
};

export const useCardAnimations = (options: UseCardAnimationsOptions = {}) => {
  const config = { ...DEFAULT_CONFIG, ...options };
  const { onCardReveal, onCardHover, onAnimationComplete } = options;

  // Track animation states for multiple cards
  const [cardStates, setCardStates] = useState<Map<string, CardAnimationState>>(new Map());
  const animationTimeouts = useRef<Map<string, NodeJS.Timeout>>(new Map());
  const cardRefs = useRef<Map<string, HTMLElement>>(new Map());

  // Check for reduced motion preference
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    
    const handleChange = (e: MediaQueryListEvent) => {
      config.reducedMotion = e.matches;
    };
    
    config.reducedMotion = mediaQuery.matches;
    mediaQuery.addEventListener('change', handleChange);
    
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  // Register a card for animation
  const registerCard = useCallback((
    ref: React.RefObject<HTMLElement> | HTMLElement,
    cardId: string,
    index: number = 0,
    isPremium: boolean = false
  ) => {
    const element = 'current' in ref ? ref.current : ref;
    if (!element) return;

    // Store ref for later use
    cardRefs.current.set(cardId, element);

    // Initialize card state
    setCardStates(prev => {
      const newStates = new Map(prev);
      if (!newStates.has(cardId)) {
        newStates.set(cardId, {
          isRevealed: false,
          isHovered: false,
          isPremium,
          isAnimating: false
        });
      }
      return newStates;
    });

    // Apply initial styles
    if (!config.reducedMotion) {
      element.style.opacity = '0';
      element.style.transform = 'translateY(30px)';
      element.style.transition = `all ${config.animationDuration}ms ${config.easing}`;
      element.style.transitionDelay = `${index * config.staggerDelay}ms`;
    }

    // Set up hover effects
    if (config.enableHover && !('ontouchstart' in window)) {
      element.addEventListener('mouseenter', () => handleHover(cardId, true));
      element.addEventListener('mouseleave', () => handleHover(cardId, false));
    }

    // Add premium class if applicable
    if (isPremium && config.enablePremiumEffects) {
      element.classList.add('card-premium');
      applyPremiumEffects(element);
    }

    return () => unregisterCard(cardId);
  }, [config]);

  // Unregister a card
  const unregisterCard = useCallback((cardId: string) => {
    // Clear any pending animations
    const timeout = animationTimeouts.current.get(cardId);
    if (timeout) {
      clearTimeout(timeout);
      animationTimeouts.current.delete(cardId);
    }

    // Remove from refs and state
    cardRefs.current.delete(cardId);
    setCardStates(prev => {
      const newStates = new Map(prev);
      newStates.delete(cardId);
      return newStates;
    });
  }, []);

  // Animate card reveal
  const revealCard = useCallback((cardId: string, index: number = 0) => {
    const element = cardRefs.current.get(cardId);
    if (!element) return;

    setCardStates(prev => {
      const newStates = new Map(prev);
      const state = newStates.get(cardId);
      if (state) {
        newStates.set(cardId, { ...state, isAnimating: true });
      }
      return newStates;
    });

    if (config.reducedMotion) {
      // Instant reveal for reduced motion
      element.style.opacity = '1';
      element.style.transform = 'translateY(0)';
      onCardReveal?.(cardId, index);
      onAnimationComplete?.(cardId);
    } else {
      // Delayed animation based on index
      const delay = index * config.staggerDelay;
      
      const timeout = setTimeout(() => {
        element.style.opacity = '1';
        element.style.transform = 'translateY(0)';
        
        // Mark as revealed after animation
        setTimeout(() => {
          setCardStates(prev => {
            const newStates = new Map(prev);
            const state = newStates.get(cardId);
            if (state) {
              newStates.set(cardId, { 
                ...state, 
                isRevealed: true, 
                isAnimating: false 
              });
            }
            return newStates;
          });
          
          onCardReveal?.(cardId, index);
          onAnimationComplete?.(cardId);
        }, config.animationDuration);
      }, delay);

      animationTimeouts.current.set(cardId, timeout);
    }
  }, [config, onCardReveal, onAnimationComplete]);

  // Handle hover effects
  const handleHover = useCallback((cardId: string, isHovered: boolean) => {
    const element = cardRefs.current.get(cardId);
    const state = cardStates.get(cardId);
    
    if (!element || !state?.isRevealed || config.reducedMotion) return;

    setCardStates(prev => {
      const newStates = new Map(prev);
      const currentState = newStates.get(cardId);
      if (currentState) {
        newStates.set(cardId, { ...currentState, isHovered });
      }
      return newStates;
    });

    if (isHovered) {
      element.style.transform = 'translateY(-4px) scale(1.02)';
      element.style.boxShadow = '0 8px 30px rgba(0, 0, 0, 0.15)';
      element.style.zIndex = '10';
    } else {
      element.style.transform = 'translateY(0) scale(1)';
      element.style.boxShadow = '';
      element.style.zIndex = '';
    }

    onCardHover?.(cardId, isHovered);
  }, [cardStates, config.reducedMotion, onCardHover]);

  // Apply premium card effects
  const applyPremiumEffects = useCallback((element: HTMLElement) => {
    if (config.reducedMotion) return;

    // Add shimmer effect
    const shimmer = document.createElement('div');
    shimmer.className = 'premium-shimmer';
    shimmer.style.cssText = `
      position: absolute;
      top: -50%;
      left: -50%;
      width: 200%;
      height: 200%;
      background: linear-gradient(
        105deg,
        transparent 40%,
        rgba(255, 215, 0, 0.2) 50%,
        transparent 60%
      );
      animation: shimmer 3s infinite;
      pointer-events: none;
    `;
    element.appendChild(shimmer);

    // Add glow effect
    element.style.boxShadow = '0 0 20px rgba(255, 215, 0, 0.3)';
    
    // Add pulse animation
    element.style.animation = 'pulse 2s infinite';
  }, [config.reducedMotion]);

  // Animate specific card with custom animation
  const animateCard = useCallback((
    cardId: string,
    animationType: 'shake' | 'bounce' | 'flash' | 'wiggle'
  ) => {
    const element = cardRefs.current.get(cardId);
    if (!element || config.reducedMotion) return;

    // Remove any existing animation class
    element.classList.remove('animate-shake', 'animate-bounce', 'animate-flash', 'animate-wiggle');
    
    // Force reflow to restart animation
    void element.offsetHeight;
    
    // Add new animation class
    element.classList.add(`animate-${animationType}`);
    
    // Remove class after animation completes
    setTimeout(() => {
      element.classList.remove(`animate-${animationType}`);
    }, 600);
  }, [config.reducedMotion]);

  // Highlight premium card
  const highlightPremium = useCallback((cardId: string) => {
    const element = cardRefs.current.get(cardId);
    if (!element || config.reducedMotion) return;

    // Add highlight animation
    element.style.animation = 'premium-highlight 1s ease-out';
    
    // Add temporary glow
    const originalShadow = element.style.boxShadow;
    element.style.boxShadow = '0 0 40px rgba(255, 215, 0, 0.6)';
    
    setTimeout(() => {
      element.style.animation = '';
      element.style.boxShadow = originalShadow;
    }, 1000);
  }, [config.reducedMotion]);

  // Reset all animations
  const resetAnimations = useCallback(() => {
    // Clear all timeouts
    animationTimeouts.current.forEach(timeout => clearTimeout(timeout));
    animationTimeouts.current.clear();

    // Reset all card states
    cardRefs.current.forEach((element, cardId) => {
      element.style.opacity = '0';
      element.style.transform = 'translateY(30px)';
      element.classList.remove('animate-shake', 'animate-bounce', 'animate-flash', 'animate-wiggle');
    });

    setCardStates(new Map());
  }, []);

  // Batch reveal cards
  const revealCards = useCallback((cardIds: string[]) => {
    cardIds.forEach((cardId, index) => {
      revealCard(cardId, index);
    });
  }, [revealCard]);

  // Get card state
  const getCardState = useCallback((cardId: string): CardAnimationState | undefined => {
    return cardStates.get(cardId);
  }, [cardStates]);

  // Check if all cards are revealed
  const areAllCardsRevealed = useCallback(() => {
    if (cardStates.size === 0) return false;
    
    for (const state of cardStates.values()) {
      if (!state.isRevealed) return false;
    }
    return true;
  }, [cardStates]);

  return {
    // Methods
    registerCard,
    unregisterCard,
    revealCard,
    revealCards,
    animateCard,
    highlightPremium,
    resetAnimations,
    
    // State getters
    getCardState,
    areAllCardsRevealed,
    
    // Direct state access
    cardStates: Array.from(cardStates.entries()).map(([id, state]) => ({ id, ...state })),
    totalCards: cardStates.size,
    revealedCount: Array.from(cardStates.values()).filter(s => s.isRevealed).length
  };
};

// Hook for individual card
export const useCardAnimation = (
  cardId: string,
  index: number = 0,
  options: UseCardAnimationsOptions = {}
) => {
  const ref = useRef<HTMLDivElement>(null);
  const { registerCard, revealCard, getCardState } = useCardAnimations(options);
  
  // Use intersection observer to trigger reveal
  const { isIntersecting, hasIntersected } = useIntersectionObserver(ref, {
    threshold: 0.1,
    rootMargin: '0px 0px -50px 0px',
    triggerOnce: true
  });

  useEffect(() => {
    if (ref.current) {
      const cleanup = registerCard(ref, cardId, index);
      return cleanup;
    }
  }, [cardId, index, registerCard]);

  useEffect(() => {
    if (isIntersecting && !hasIntersected) {
      revealCard(cardId, index);
    }
  }, [isIntersecting, hasIntersected, cardId, index, revealCard]);

  const state = getCardState(cardId);

  return {
    ref,
    isRevealed: state?.isRevealed || false,
    isHovered: state?.isHovered || false,
    isAnimating: state?.isAnimating || false,
    isPremium: state?.isPremium || false
  };
};

export default useCardAnimations;