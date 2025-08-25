import { useEffect, useRef, useCallback, useState } from 'react';

interface IntersectionOptions extends IntersectionObserverInit {
  threshold?: number | number[];
  rootMargin?: string;
  triggerOnce?: boolean;
  skip?: boolean;
  delayMs?: number;
  onEnter?: (entry: IntersectionObserverEntry) => void;
  onLeave?: (entry: IntersectionObserverEntry) => void;
}

interface AnimationConfig {
  duration?: number;
  delay?: number;
  easing?: string;
  from?: Record<string, string | number>;
  to?: Record<string, string | number>;
  staggerDelay?: number;
}

interface UseIntersectionObserverReturn {
  isIntersecting: boolean;
  hasIntersected: boolean;
  intersectionRatio: number;
  entry: IntersectionObserverEntry | null;
}

export const useIntersectionObserver = (
  elementRef: React.RefObject<HTMLElement>,
  options: IntersectionOptions = {}
): UseIntersectionObserverReturn => {
  const {
    threshold = 0.1,
    rootMargin = '0px 0px -50px 0px',
    triggerOnce = false,
    skip = false,
    delayMs = 0,
    onEnter,
    onLeave
  } = options;

  const [isIntersecting, setIsIntersecting] = useState(false);
  const [hasIntersected, setHasIntersected] = useState(false);
  const [intersectionRatio, setIntersectionRatio] = useState(0);
  const [entry, setEntry] = useState<IntersectionObserverEntry | null>(null);
  
  const observerRef = useRef<IntersectionObserver | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleIntersection = useCallback((entries: IntersectionObserverEntry[]) => {
    const [entry] = entries;
    setEntry(entry);
    setIntersectionRatio(entry.intersectionRatio);
    
    const handleStateUpdate = () => {
      const wasIntersecting = isIntersecting;
      const nowIntersecting = entry.isIntersecting;
      
      setIsIntersecting(nowIntersecting);
      
      if (nowIntersecting) {
        setHasIntersected(true);
        onEnter?.(entry);
        
        // If triggerOnce is true, disconnect after first intersection
        if (triggerOnce && observerRef.current) {
          observerRef.current.disconnect();
        }
      } else if (wasIntersecting) {
        onLeave?.(entry);
      }
    };

    // Apply delay if specified
    if (delayMs > 0) {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      timeoutRef.current = setTimeout(handleStateUpdate, delayMs);
    } else {
      handleStateUpdate();
    }
  }, [isIntersecting, triggerOnce, delayMs, onEnter, onLeave]);

  useEffect(() => {
    const element = elementRef.current;
    
    if (!element || skip) {
      return;
    }

    // Check if IntersectionObserver is supported
    if (!('IntersectionObserver' in window)) {
      console.warn('IntersectionObserver is not supported');
      // Fallback: assume element is always visible
      setIsIntersecting(true);
      setHasIntersected(true);
      return;
    }

    // Create observer
    observerRef.current = new IntersectionObserver(handleIntersection, {
      root: options.root,
      rootMargin,
      threshold
    });

    // Start observing
    observerRef.current.observe(element);

    // Cleanup
    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [elementRef, skip, threshold, rootMargin, handleIntersection, options.root]);

  return {
    isIntersecting,
    hasIntersected,
    intersectionRatio,
    entry
  };
};

// Enhanced hook for multiple elements with animations
export const useIntersectionObserverList = (
  elementsSelector: string,
  options: IntersectionOptions & { animationConfig?: AnimationConfig } = {}
) => {
  const {
    threshold = 0.1,
    rootMargin = '0px 0px -50px 0px',
    triggerOnce = true,
    animationConfig = {},
    onEnter,
    onLeave
  } = options;

  const [intersectingElements, setIntersectingElements] = useState<Set<Element>>(new Set());
  const observerRef = useRef<IntersectionObserver | null>(null);
  const elementsRef = useRef<Element[]>([]);

  const applyAnimation = useCallback((element: Element, config: AnimationConfig, isEntering: boolean) => {
    const {
      duration = 600,
      delay = 0,
      easing = 'cubic-bezier(0.4, 0, 0.2, 1)',
      from = { opacity: '0', transform: 'translateY(30px)' },
      to = { opacity: '1', transform: 'translateY(0)' }
    } = config;

    const htmlElement = element as HTMLElement;
    
    if (isEntering) {
      // Apply initial state
      Object.assign(htmlElement.style, {
        ...from,
        transition: `all ${duration}ms ${easing}`,
        transitionDelay: `${delay}ms`
      });
      
      // Force reflow to ensure initial state is applied
      htmlElement.offsetHeight;
      
      // Apply final state
      requestAnimationFrame(() => {
        Object.assign(htmlElement.style, to);
      });
    } else {
      // Reverse animation
      Object.assign(htmlElement.style, from);
    }
  }, []);

  const handleIntersection = useCallback((entries: IntersectionObserverEntry[]) => {
    entries.forEach((entry, index) => {
      const isIntersecting = entry.isIntersecting;
      const element = entry.target;
      
      setIntersectingElements(prev => {
        const newSet = new Set(prev);
        if (isIntersecting) {
          newSet.add(element);
        } else {
          newSet.delete(element);
        }
        return newSet;
      });

      // Apply staggered animation delay
      const staggerDelay = animationConfig.staggerDelay ? index * animationConfig.staggerDelay : 0;
      const totalDelay = (animationConfig.delay || 0) + staggerDelay;
      
      if (isIntersecting) {
        element.setAttribute('data-revealed', 'true');
        
        if (animationConfig) {
          applyAnimation(element, { ...animationConfig, delay: totalDelay }, true);
        }
        
        onEnter?.(entry);
      } else {
        element.setAttribute('data-revealed', 'false');
        
        if (!triggerOnce && animationConfig) {
          applyAnimation(element, animationConfig, false);
        }
        
        onLeave?.(entry);
      }
    });
  }, [animationConfig, applyAnimation, triggerOnce, onEnter, onLeave]);

  // Setup observer and find elements
  useEffect(() => {
    // Check if IntersectionObserver is supported
    if (!('IntersectionObserver' in window)) {
      console.warn('IntersectionObserver is not supported');
      return;
    }

    // Find elements
    const elements = Array.from(document.querySelectorAll(elementsSelector));
    elementsRef.current = elements;

    if (elements.length === 0) {
      console.warn(`No elements found for selector: ${elementsSelector}`);
      return;
    }

    // Create observer
    observerRef.current = new IntersectionObserver(handleIntersection, {
      threshold,
      rootMargin
    });

    // Observe all elements
    elements.forEach((element, index) => {
      // Set initial animation delay as data attribute
      if (animationConfig.staggerDelay) {
        (element as HTMLElement).dataset.animationDelay = `${index * animationConfig.staggerDelay}ms`;
      }
      
      observerRef.current?.observe(element);
    });

    // Cleanup
    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [elementsSelector, threshold, rootMargin, handleIntersection, animationConfig.staggerDelay]);

  // Get intersection status for all elements
  const getIntersectionStatus = useCallback(() => {
    return elementsRef.current.map(element => ({
      element,
      isIntersecting: intersectingElements.has(element),
      hasRevealed: element.getAttribute('data-revealed') === 'true'
    }));
  }, [intersectingElements]);

  return {
    intersectingElements: Array.from(intersectingElements),
    totalElements: elementsRef.current.length,
    getIntersectionStatus,
    observer: observerRef.current
  };
};

// Predefined animation presets
export const animationPresets = {
  fadeIn: {
    from: { opacity: '0' },
    to: { opacity: '1' },
    duration: 600,
    easing: 'ease-out'
  },
  slideUp: {
    from: { opacity: '0', transform: 'translateY(30px)' },
    to: { opacity: '1', transform: 'translateY(0)' },
    duration: 600,
    easing: 'cubic-bezier(0.4, 0, 0.2, 1)'
  },
  slideDown: {
    from: { opacity: '0', transform: 'translateY(-30px)' },
    to: { opacity: '1', transform: 'translateY(0)' },
    duration: 600,
    easing: 'cubic-bezier(0.4, 0, 0.2, 1)'
  },
  slideLeft: {
    from: { opacity: '0', transform: 'translateX(30px)' },
    to: { opacity: '1', transform: 'translateX(0)' },
    duration: 600,
    easing: 'cubic-bezier(0.4, 0, 0.2, 1)'
  },
  slideRight: {
    from: { opacity: '0', transform: 'translateX(-30px)' },
    to: { opacity: '1', transform: 'translateX(0)' },
    duration: 600,
    easing: 'cubic-bezier(0.4, 0, 0.2, 1)'
  },
  scaleIn: {
    from: { opacity: '0', transform: 'scale(0.8)' },
    to: { opacity: '1', transform: 'scale(1)' },
    duration: 600,
    easing: 'cubic-bezier(0.34, 1.56, 0.64, 1)'
  },
  rotateIn: {
    from: { opacity: '0', transform: 'rotate(-10deg) scale(0.8)' },
    to: { opacity: '1', transform: 'rotate(0deg) scale(1)' },
    duration: 800,
    easing: 'cubic-bezier(0.34, 1.56, 0.64, 1)'
  },
  bounceIn: {
    from: { opacity: '0', transform: 'scale(0.3)' },
    to: { opacity: '1', transform: 'scale(1)' },
    duration: 800,
    easing: 'cubic-bezier(0.68, -0.55, 0.265, 1.55)'
  }
};

export default useIntersectionObserver;