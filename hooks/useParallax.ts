import { useEffect, useRef, useCallback } from 'react';

interface ParallaxElement {
  element: HTMLElement;
  speed: number;
}

interface UseParallaxOptions {
  elements: Array<{
    selector: string;
    speed: number;
  }>;
  enabled?: boolean;
  performanceMode?: 'auto' | 'force' | 'disable';
}

interface ParallaxMetrics {
  frameRate: number;
  averageFrameTime: number;
  droppedFrames: number;
}

export const useParallax = (options: UseParallaxOptions) => {
  const elementsRef = useRef<ParallaxElement[]>([]);
  const tickingRef = useRef(false);
  const lastFrameTimeRef = useRef(0);
  const frameTimesRef = useRef<number[]>([]);
  const metricsRef = useRef<ParallaxMetrics>({
    frameRate: 60,
    averageFrameTime: 16.67,
    droppedFrames: 0
  });

  const {
    elements = [],
    enabled = true,
    performanceMode = 'auto'
  } = options;

  // Performance monitoring
  const updateMetrics = useCallback((currentTime: number) => {
    if (lastFrameTimeRef.current > 0) {
      const frameTime = currentTime - lastFrameTimeRef.current;
      frameTimesRef.current.push(frameTime);
      
      // Keep only last 60 frames for rolling average
      if (frameTimesRef.current.length > 60) {
        frameTimesRef.current.shift();
      }
      
      const averageFrameTime = frameTimesRef.current.reduce((a, b) => a + b, 0) / frameTimesRef.current.length;
      const frameRate = 1000 / averageFrameTime;
      const droppedFrames = frameTimesRef.current.filter(time => time > 20).length; // Frames over 20ms
      
      metricsRef.current = {
        frameRate: Math.round(frameRate),
        averageFrameTime: Math.round(averageFrameTime * 100) / 100,
        droppedFrames
      };
    }
    lastFrameTimeRef.current = currentTime;
  }, []);

  // Optimized parallax update function
  const updateParallax = useCallback((timestamp: number) => {
    if (!enabled) return;
    
    // Update performance metrics
    updateMetrics(timestamp);
    
    // Auto-disable if performance is poor
    if (performanceMode === 'auto' && metricsRef.current.frameRate < 30) {
      console.warn('🐌 Parallax disabled due to poor performance');
      return;
    }
    
    const scrolled = window.pageYOffset;
    
    elementsRef.current.forEach(({ element, speed }) => {
      if (element && element.offsetParent !== null) {
        const yPos = -(scrolled * speed);
        
        // Use transform3d for hardware acceleration
        element.style.transform = `translate3d(0, ${yPos}px, 0)`;
        
        // Optional: Add will-change hint for better performance
        if (!element.style.willChange) {
          element.style.willChange = 'transform';
        }
      }
    });
    
    tickingRef.current = false;
  }, [enabled, performanceMode, updateMetrics]);

  // Throttled scroll handler using requestAnimationFrame
  const requestTick = useCallback(() => {
    if (!tickingRef.current) {
      requestAnimationFrame(updateParallax);
      tickingRef.current = true;
    }
  }, [updateParallax]);

  // Initialize and cleanup parallax elements
  useEffect(() => {
    if (!enabled) return;

    // Find and setup parallax elements
    const parallaxElements: ParallaxElement[] = [];
    
    elements.forEach(({ selector, speed }) => {
      const element = document.querySelector(selector) as HTMLElement;
      if (element) {
        parallaxElements.push({ element, speed });
        
        // Optimize element for animations
        element.style.willChange = 'transform';
        element.style.backfaceVisibility = 'hidden';
        element.style.perspective = '1000px';
      }
    });
    
    elementsRef.current = parallaxElements;
    
    // Add scroll listener
    window.addEventListener('scroll', requestTick, { passive: true });
    
    // Initial update
    requestTick();
    
    return () => {
      window.removeEventListener('scroll', requestTick);
      
      // Clean up will-change properties
      elementsRef.current.forEach(({ element }) => {
        if (element) {
          element.style.willChange = 'auto';
          element.style.transform = '';
        }
      });
    };
  }, [elements, enabled, requestTick]);

  // Pause/resume parallax (useful for performance optimization)
  const pause = useCallback(() => {
    window.removeEventListener('scroll', requestTick);
  }, [requestTick]);

  const resume = useCallback(() => {
    if (enabled) {
      window.addEventListener('scroll', requestTick, { passive: true });
    }
  }, [enabled, requestTick]);

  // Get current performance metrics
  const getMetrics = useCallback(() => ({ ...metricsRef.current }), []);

  // Utility to add new parallax element dynamically
  const addElement = useCallback((selector: string, speed: number) => {
    const element = document.querySelector(selector) as HTMLElement;
    if (element && !elementsRef.current.find(item => item.element === element)) {
      element.style.willChange = 'transform';
      element.style.backfaceVisibility = 'hidden';
      element.style.perspective = '1000px';
      
      elementsRef.current.push({ element, speed });
    }
  }, []);

  // Utility to remove parallax element
  const removeElement = useCallback((selector: string) => {
    const element = document.querySelector(selector) as HTMLElement;
    if (element) {
      element.style.willChange = 'auto';
      element.style.transform = '';
      
      elementsRef.current = elementsRef.current.filter(item => item.element !== element);
    }
  }, []);

  return {
    pause,
    resume,
    getMetrics,
    addElement,
    removeElement,
    isEnabled: enabled
  };
};

export default useParallax;