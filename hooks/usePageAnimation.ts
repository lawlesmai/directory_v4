import { useState, useEffect, useCallback, useRef } from 'react';

export interface PageAnimationConfig {
  // Loading animations
  enableLoadingAnimation?: boolean;
  loadingAnimationDuration?: number;
  loadingSkeletonCount?: number;
  
  // Page entrance
  enablePageEntrance?: boolean;
  entranceAnimationDuration?: number;
  entranceEasing?: string;
  entranceDelay?: number;
  
  // Page transitions
  enablePageTransitions?: boolean;
  transitionDuration?: number;
  transitionEasing?: string;
  
  // Scroll animations
  enableScrollAnimations?: boolean;
  scrollAnimationThreshold?: number;
  
  // Route changes
  enableRouteAnimations?: boolean;
  routeAnimationDuration?: number;
  
  // Performance
  reducedMotion?: boolean;
  useNativeAnimations?: boolean;
  
  // Visual effects
  enableFadeIn?: boolean;
  enableSlideUp?: boolean;
  enableScaleIn?: boolean;
  enableBlurTransition?: boolean;
  
  // Preloader
  enablePreloader?: boolean;
  preloaderMinDuration?: number;
  preloaderMaxDuration?: number;
}

export interface AnimationElement {
  element: HTMLElement;
  animationType: 'fadeIn' | 'slideUp' | 'scaleIn' | 'custom';
  delay?: number;
  duration?: number;
  hasAnimated: boolean;
}

export interface PageAnimationState {
  isLoading: boolean;
  isReady: boolean;
  isAnimating: boolean;
  currentAnimation: string | null;
  loadProgress: number;
  animatedElements: number;
  totalElements: number;
}

export interface AnimationMetrics {
  pageLoadTime: number;
  animationStartTime: number;
  animationEndTime: number;
  totalAnimationDuration: number;
  frameRate: number;
  performanceScore: number;
}

const DEFAULT_CONFIG: PageAnimationConfig = {
  enableLoadingAnimation: true,
  loadingAnimationDuration: 1500,
  loadingSkeletonCount: 6,
  enablePageEntrance: true,
  entranceAnimationDuration: 800,
  entranceEasing: 'cubic-bezier(0.4, 0, 0.2, 1)',
  entranceDelay: 100,
  enablePageTransitions: true,
  transitionDuration: 300,
  transitionEasing: 'ease-out',
  enableScrollAnimations: true,
  scrollAnimationThreshold: 0.1,
  enableRouteAnimations: true,
  routeAnimationDuration: 400,
  reducedMotion: false,
  useNativeAnimations: false,
  enableFadeIn: true,
  enableSlideUp: true,
  enableScaleIn: false,
  enableBlurTransition: true,
  enablePreloader: true,
  preloaderMinDuration: 800,
  preloaderMaxDuration: 3000
};

export const usePageAnimation = (config: PageAnimationConfig = {}) => {
  const mergedConfig = { ...DEFAULT_CONFIG, ...config };
  
  // State
  const [state, setState] = useState<PageAnimationState>({
    isLoading: true,
    isReady: false,
    isAnimating: false,
    currentAnimation: null,
    loadProgress: 0,
    animatedElements: 0,
    totalElements: 0
  });
  
  const [metrics, setMetrics] = useState<AnimationMetrics>({
    pageLoadTime: 0,
    animationStartTime: 0,
    animationEndTime: 0,
    totalAnimationDuration: 0,
    frameRate: 60,
    performanceScore: 100
  });
  
  // Refs
  const elementsRef = useRef<Map<string, AnimationElement>>(new Map());
  const observerRef = useRef<IntersectionObserver | null>(null);
  const loadStartTimeRef = useRef(0);
  const frameTimesRef = useRef<number[]>([]);
  const lastFrameTimeRef = useRef(0);
  const animationTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const preloaderTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // Check for reduced motion preference
  const prefersReducedMotion = typeof window !== 'undefined' 
    ? window.matchMedia('(prefers-reduced-motion: reduce)').matches 
    : false;
  
  const shouldAnimate = !mergedConfig.reducedMotion && !prefersReducedMotion;

  // Initialize page load tracking
  useEffect(() => {
    loadStartTimeRef.current = performance.now();
    
    const handleLoad = () => {
      const loadTime = performance.now() - loadStartTimeRef.current;
      setMetrics(prev => ({ ...prev, pageLoadTime: loadTime }));
      
      if (mergedConfig.enablePreloader) {
        const minWaitTime = Math.max(0, mergedConfig.preloaderMinDuration! - loadTime);
        const maxWaitTime = mergedConfig.preloaderMaxDuration!;
        const waitTime = Math.min(minWaitTime, maxWaitTime);
        
        preloaderTimeoutRef.current = setTimeout(() => {
          setState(prev => ({ ...prev, isLoading: false }));
        }, waitTime);
      } else {
        setState(prev => ({ ...prev, isLoading: false }));
      }
    };
    
    if (document.readyState === 'loading') {
      window.addEventListener('load', handleLoad);
    } else {
      handleLoad();
    }
    
    return () => {
      window.removeEventListener('load', handleLoad);
      if (preloaderTimeoutRef.current) {
        clearTimeout(preloaderTimeoutRef.current);
      }
    };
  }, [mergedConfig.enablePreloader, mergedConfig.preloaderMinDuration, mergedConfig.preloaderMaxDuration]);

  // Start page entrance animation when loading is complete
  useEffect(() => {
    if (!state.isLoading && !state.isReady && shouldAnimate) {
      startPageEntranceAnimation();
    } else if (!state.isLoading && (!shouldAnimate || !mergedConfig.enablePageEntrance)) {
      setState(prev => ({ ...prev, isReady: true }));
    }
  }, [state.isLoading, state.isReady, shouldAnimate, mergedConfig.enablePageEntrance]);

  // Performance monitoring
  const updateFrameRate = useCallback((timestamp: number) => {
    if (lastFrameTimeRef.current > 0) {
      const frameTime = timestamp - lastFrameTimeRef.current;
      frameTimesRef.current.push(frameTime);
      
      if (frameTimesRef.current.length > 60) {
        frameTimesRef.current.shift();
      }
      
      if (frameTimesRef.current.length >= 10) {
        const avgFrameTime = frameTimesRef.current.reduce((a, b) => a + b, 0) / frameTimesRef.current.length;
        const fps = Math.round(1000 / avgFrameTime);
        
        setMetrics(prev => ({ ...prev, frameRate: fps }));
      }
    }
    
    lastFrameTimeRef.current = timestamp;
  }, []);

  // Create animation styles
  const createAnimationStyles = useCallback((
    type: 'fadeIn' | 'slideUp' | 'scaleIn' | 'loading' | 'entrance',
    stage: 'initial' | 'animate' | 'complete'
  ): React.CSSProperties => {
    const baseTransition = {
      transitionDuration: `${mergedConfig.entranceAnimationDuration}ms`,
      transitionTimingFunction: mergedConfig.entranceEasing,
      transitionProperty: 'all'
    };
    
    switch (type) {
      case 'fadeIn':
        return {
          ...baseTransition,
          opacity: stage === 'initial' ? 0 : 1,
          willChange: 'opacity'
        };
        
      case 'slideUp':
        return {
          ...baseTransition,
          transform: stage === 'initial' ? 'translateY(30px)' : 'translateY(0)',
          opacity: stage === 'initial' ? 0 : 1,
          willChange: 'transform, opacity'
        };
        
      case 'scaleIn':
        return {
          ...baseTransition,
          transform: stage === 'initial' ? 'scale(0.95)' : 'scale(1)',
          opacity: stage === 'initial' ? 0 : 1,
          willChange: 'transform, opacity'
        };
        
      case 'loading':
        return {
          opacity: stage === 'animate' ? 1 : 0,
          transform: 'translateY(0)',
          transition: 'opacity 300ms ease-out',
          willChange: 'opacity'
        };
        
      case 'entrance':
        const combinedTransform = [];
        if (mergedConfig.enableSlideUp) combinedTransform.push('translateY(0)');
        if (mergedConfig.enableScaleIn) combinedTransform.push('scale(1)');
        
        return {
          ...baseTransition,
          opacity: stage === 'animate' ? 1 : 0,
          transform: stage === 'initial' 
            ? 'translateY(20px) scale(0.98)' 
            : combinedTransform.join(' ') || 'none',
          filter: mergedConfig.enableBlurTransition 
            ? (stage === 'initial' ? 'blur(4px)' : 'blur(0px)')
            : 'none',
          willChange: 'transform, opacity, filter'
        };
        
      default:
        return baseTransition;
    }
  }, [mergedConfig]);

  // Register element for animation
  const registerElement = useCallback((
    element: HTMLElement, 
    id: string, 
    animationType: AnimationElement['animationType'] = 'fadeIn',
    delay = 0
  ) => {
    if (!element || !shouldAnimate) return;
    
    const animationElement: AnimationElement = {
      element,
      animationType,
      delay,
      duration: mergedConfig.entranceAnimationDuration,
      hasAnimated: false
    };
    
    elementsRef.current.set(id, animationElement);
    
    // Apply initial styles
    const initialStyles = createAnimationStyles(animationType, 'initial');
    Object.assign(element.style, initialStyles);
    
    setState(prev => ({ 
      ...prev, 
      totalElements: elementsRef.current.size 
    }));
  }, [shouldAnimate, mergedConfig.entranceAnimationDuration, createAnimationStyles]);

  // Unregister element
  const unregisterElement = useCallback((id: string) => {
    elementsRef.current.delete(id);
    setState(prev => ({ 
      ...prev, 
      totalElements: elementsRef.current.size 
    }));
  }, []);

  // Animate single element
  const animateElement = useCallback((id: string) => {
    const animationElement = elementsRef.current.get(id);
    if (!animationElement || animationElement.hasAnimated || !shouldAnimate) return;
    
    const { element, animationType, delay = 0 } = animationElement;
    
    setTimeout(() => {
      const animateStyles = createAnimationStyles(animationType, 'animate');
      Object.assign(element.style, animateStyles);
      animationElement.hasAnimated = true;
      
      setState(prev => ({ 
        ...prev, 
        animatedElements: prev.animatedElements + 1 
      }));
    }, delay);
  }, [shouldAnimate, createAnimationStyles]);

  // Start page entrance animation
  const startPageEntranceAnimation = useCallback(() => {
    if (!shouldAnimate || !mergedConfig.enablePageEntrance) {
      setState(prev => ({ ...prev, isReady: true }));
      return;
    }
    
    setState(prev => ({ 
      ...prev, 
      isAnimating: true, 
      currentAnimation: 'entrance' 
    }));
    
    const startTime = performance.now();
    setMetrics(prev => ({ ...prev, animationStartTime: startTime }));
    
    // Animate elements in sequence
    Array.from(elementsRef.current.keys()).forEach((id, index) => {
      const delay = index * mergedConfig.entranceDelay!;
      setTimeout(() => {
        animateElement(id);
      }, delay);
    });
    
    // Complete animation after all elements are done
    const totalDuration = elementsRef.current.size * mergedConfig.entranceDelay! + mergedConfig.entranceAnimationDuration!;
    
    animationTimeoutRef.current = setTimeout(() => {
      const endTime = performance.now();
      setMetrics(prev => ({ 
        ...prev, 
        animationEndTime: endTime,
        totalAnimationDuration: endTime - startTime
      }));
      
      setState(prev => ({
        ...prev,
        isAnimating: false,
        isReady: true,
        currentAnimation: null
      }));
    }, totalDuration);
  }, [
    shouldAnimate,
    mergedConfig.enablePageEntrance,
    mergedConfig.entranceDelay,
    mergedConfig.entranceAnimationDuration,
    animateElement
  ]);

  // Setup intersection observer for scroll animations
  useEffect(() => {
    if (!shouldAnimate || !mergedConfig.enableScrollAnimations) return;
    
    observerRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const elementId = entry.target.getAttribute('data-animation-id');
          if (elementId && entry.isIntersecting) {
            animateElement(elementId);
          }
        });
      },
      {
        threshold: mergedConfig.scrollAnimationThreshold,
        rootMargin: '50px'
      }
    );
    
    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [shouldAnimate, mergedConfig.enableScrollAnimations, mergedConfig.scrollAnimationThreshold, animateElement]);

  // Observe element for scroll animation
  const observeElement = useCallback((element: HTMLElement, id: string) => {
    if (observerRef.current && shouldAnimate && mergedConfig.enableScrollAnimations) {
      element.setAttribute('data-animation-id', id);
      observerRef.current.observe(element);
    }
  }, [shouldAnimate, mergedConfig.enableScrollAnimations]);

  // Stop observing element
  const unobserveElement = useCallback((element: HTMLElement) => {
    if (observerRef.current) {
      observerRef.current.unobserve(element);
    }
  }, []);

  // Create loading skeleton
  const createLoadingSkeleton = useCallback(() => {
    const skeletonItems = Array.from({ length: mergedConfig.loadingSkeletonCount! }, (_, index) => ({
      id: `skeleton-${index}`,
      delay: index * 100,
      height: Math.random() * 40 + 60 // Random height between 60-100px
    }));
    
    return skeletonItems;
  }, [mergedConfig.loadingSkeletonCount]);

  // Trigger page transition
  const triggerPageTransition = useCallback((callback?: () => void) => {
    if (!shouldAnimate || !mergedConfig.enablePageTransitions) {
      callback?.();
      return;
    }
    
    setState(prev => ({ 
      ...prev, 
      isAnimating: true, 
      currentAnimation: 'transition' 
    }));
    
    // Apply exit animation to all elements
    elementsRef.current.forEach((animationElement) => {
      const exitStyles = createAnimationStyles(animationElement.animationType, 'initial');
      Object.assign(animationElement.element.style, {
        ...exitStyles,
        transitionDuration: `${mergedConfig.transitionDuration}ms`
      });
    });
    
    setTimeout(() => {
      callback?.();
      setState(prev => ({ 
        ...prev, 
        isAnimating: false, 
        currentAnimation: null 
      }));
    }, mergedConfig.transitionDuration);
  }, [shouldAnimate, mergedConfig.enablePageTransitions, mergedConfig.transitionDuration, createAnimationStyles]);

  // Reset all animations
  const resetAllAnimations = useCallback(() => {
    elementsRef.current.forEach((animationElement, id) => {
      animationElement.hasAnimated = false;
      const initialStyles = createAnimationStyles(animationElement.animationType, 'initial');
      Object.assign(animationElement.element.style, initialStyles);
    });
    
    setState(prev => ({
      ...prev,
      animatedElements: 0,
      isReady: false
    }));
  }, [createAnimationStyles]);

  // Calculate performance score
  const calculatePerformanceScore = useCallback(() => {
    let score = 100;
    
    if (metrics.pageLoadTime > 3000) score -= 20;
    if (metrics.totalAnimationDuration > 2000) score -= 10;
    if (metrics.frameRate < 55) score -= 20;
    
    return Math.max(0, score);
  }, [metrics]);

  useEffect(() => {
    const score = calculatePerformanceScore();
    setMetrics(prev => ({ ...prev, performanceScore: score }));
  }, [calculatePerformanceScore]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (animationTimeoutRef.current) {
        clearTimeout(animationTimeoutRef.current);
      }
      if (preloaderTimeoutRef.current) {
        clearTimeout(preloaderTimeoutRef.current);
      }
    };
  }, []);

  return {
    // State
    ...state,
    metrics,
    shouldAnimate,
    
    // Element management
    registerElement,
    unregisterElement,
    observeElement,
    unobserveElement,
    
    // Animation control
    animateElement,
    startPageEntranceAnimation,
    triggerPageTransition,
    resetAllAnimations,
    
    // Utilities
    createAnimationStyles,
    createLoadingSkeleton,
    updateFrameRate,
    
    // Configuration
    config: mergedConfig
  };
};

// Hook for individual element animation
export const useElementAnimation = (
  id: string,
  animationType: AnimationElement['animationType'] = 'fadeIn',
  delay = 0
) => {
  const elementRef = useRef<HTMLElement>(null);
  const {
    registerElement,
    unregisterElement,
    observeElement,
    unobserveElement,
    createAnimationStyles,
    shouldAnimate
  } = usePageAnimation();
  
  useEffect(() => {
    const element = elementRef.current;
    if (element) {
      registerElement(element, id, animationType, delay);
      observeElement(element, id);
      
      return () => {
        unobserveElement(element);
        unregisterElement(id);
      };
    }
  }, [id, animationType, delay, registerElement, unregisterElement, observeElement, unobserveElement]);
  
  return {
    elementRef,
    animationStyles: shouldAnimate ? createAnimationStyles(animationType, 'initial') : {},
    shouldAnimate
  };
};

export default usePageAnimation;