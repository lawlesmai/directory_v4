import { useEffect, useCallback, useRef, useState } from 'react';

interface TouchCoordinates {
  x: number;
  y: number;
}

interface SwipeGesture {
  direction: 'left' | 'right' | 'up' | 'down';
  distance: number;
  velocity: number;
  duration: number;
}

interface TapGesture {
  coordinates: TouchCoordinates;
  tapCount: number;
  timestamp: number;
}

interface PinchGesture {
  scale: number;
  velocity: number;
  center: TouchCoordinates;
}

interface PullToRefreshGesture {
  distance: number;
  velocity: number;
  isTriggered: boolean;
}

interface EdgeSwipeGesture {
  edge: 'left' | 'right' | 'top' | 'bottom';
  distance: number;
  velocity: number;
}

interface GestureCallbacks {
  onSwipe?: (gesture: SwipeGesture, element: HTMLElement) => void;
  onTap?: (gesture: TapGesture, element: HTMLElement) => void;
  onDoubleTap?: (gesture: TapGesture, element: HTMLElement) => void;
  onLongPress?: (coordinates: TouchCoordinates, element: HTMLElement) => void;
  onPinch?: (gesture: PinchGesture, element: HTMLElement) => void;
  onTouchStart?: (coordinates: TouchCoordinates, element: HTMLElement) => void;
  onTouchEnd?: (coordinates: TouchCoordinates, element: HTMLElement) => void;
  onPullToRefresh?: (gesture: PullToRefreshGesture, element: HTMLElement) => void;
  onEdgeSwipe?: (gesture: EdgeSwipeGesture, element: HTMLElement) => void;
}

interface UseMobileGesturesOptions extends GestureCallbacks {
  swipeThreshold?: number;
  velocityThreshold?: number;
  longPressDelay?: number;
  doubleTapDelay?: number;
  pinchThreshold?: number;
  enableHapticFeedback?: boolean;
  gesturePreventDefault?: boolean;
  debugMode?: boolean;
  enablePullToRefresh?: boolean;
  pullToRefreshThreshold?: number;
  enableEdgeSwipes?: boolean;
  edgeSwipeThreshold?: number;
}

interface TouchState {
  startTime: number;
  startCoordinates: TouchCoordinates;
  currentCoordinates: TouchCoordinates;
  lastTapTime: number;
  tapCount: number;
  longPressTimer: NodeJS.Timeout | null;
  isLongPress: boolean;
  initialDistance: number;
  currentScale: number;
  pullToRefreshDistance: number;
  isPullToRefreshActive: boolean;
  isEdgeSwipe: boolean;
  edgeSwipeDirection: 'left' | 'right' | 'top' | 'bottom' | null;
}

export const useMobileGestures = (
  elementRef: React.RefObject<HTMLElement>,
  options: UseMobileGesturesOptions = {}
) => {
  const {
    swipeThreshold = 50,
    velocityThreshold = 0.5,
    longPressDelay = 500,
    doubleTapDelay = 300,
    pinchThreshold = 10,
    enableHapticFeedback = true,
    gesturePreventDefault = false,
    debugMode = false,
    enablePullToRefresh = true,
    pullToRefreshThreshold = 80,
    enableEdgeSwipes = true,
    edgeSwipeThreshold = 20,
    onSwipe,
    onTap,
    onDoubleTap,
    onLongPress,
    onPinch,
    onTouchStart,
    onTouchEnd,
    onPullToRefresh,
    onEdgeSwipe
  } = options;

  const touchStateRef = useRef<TouchState>({
    startTime: 0,
    startCoordinates: { x: 0, y: 0 },
    currentCoordinates: { x: 0, y: 0 },
    lastTapTime: 0,
    tapCount: 0,
    longPressTimer: null,
    isLongPress: false,
    initialDistance: 0,
    currentScale: 1,
    pullToRefreshDistance: 0,
    isPullToRefreshActive: false,
    isEdgeSwipe: false,
    edgeSwipeDirection: null
  });

  const [isGestureActive, setIsGestureActive] = useState(false);
  const [currentGesture, setCurrentGesture] = useState<string>('');

  // Enhanced haptic feedback utility
  const triggerHapticFeedback = useCallback((intensity: 'light' | 'medium' | 'heavy' | 'success' | 'warning' | 'error' = 'light') => {
    if (!enableHapticFeedback) return;
    
    // Modern haptic feedback API with enhanced patterns
    if ('vibrate' in navigator) {
      const patterns = {
        light: [10],
        medium: [20],
        heavy: [30],
        success: [10, 10, 10], // Triple light tap
        warning: [20, 10, 20], // Medium-light-medium
        error: [50, 20, 50] // Heavy-light-heavy
      };
      navigator.vibrate(patterns[intensity] || patterns.light);
    }
    
    // iOS Haptic Feedback API (if available) - enhanced for iOS 15+
    if ('HapticFeedback' in window && (window as any).HapticFeedback) {
      const impacts = {
        light: 'impactLight',
        medium: 'impactMedium', 
        heavy: 'impactHeavy',
        success: 'notificationSuccess',
        warning: 'notificationWarning',
        error: 'notificationError'
      };
      try {
        (window as any).HapticFeedback[impacts[intensity] || impacts.light]();
      } catch (error) {
        if (debugMode) console.warn('Haptic feedback failed:', error);
      }
    }
    
    // Web Vibration API fallback with type-specific patterns
    if ('vibrate' in navigator && !('HapticFeedback' in window)) {
      const customPatterns = {
        pullToRefresh: [15, 5, 15],
        edgeSwipe: [8, 3, 8, 3, 8],
        longPress: [25],
        pinchZoom: [5]
      };
      
      if (customPatterns[intensity as keyof typeof customPatterns]) {
        navigator.vibrate(customPatterns[intensity as keyof typeof customPatterns]);
      }
    }
  }, [enableHapticFeedback, debugMode]);

  // Get touch coordinates from event
  const getTouchCoordinates = useCallback((event: TouchEvent): TouchCoordinates => {
    const touch = event.touches[0] || event.changedTouches[0];
    return {
      x: touch.clientX,
      y: touch.clientY
    };
  }, []);

  // Calculate distance between two touches
  const getDistance = useCallback((touch1: Touch, touch2: Touch): number => {
    const dx = touch1.clientX - touch2.clientX;
    const dy = touch1.clientY - touch2.clientY;
    return Math.sqrt(dx * dx + dy * dy);
  }, []);

  // Calculate velocity
  const calculateVelocity = useCallback((distance: number, time: number): number => {
    return time > 0 ? distance / time : 0;
  }, []);

  // Determine swipe direction
  const getSwipeDirection = useCallback((start: TouchCoordinates, end: TouchCoordinates): 'left' | 'right' | 'up' | 'down' => {
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    
    if (Math.abs(dx) > Math.abs(dy)) {
      return dx > 0 ? 'right' : 'left';
    } else {
      return dy > 0 ? 'down' : 'up';
    }
  }, []);

  // Detect if touch started from screen edge
  const detectEdgeSwipe = useCallback((coordinates: TouchCoordinates): 'left' | 'right' | 'top' | 'bottom' | null => {
    if (!enableEdgeSwipes) return null;
    
    const { innerWidth, innerHeight } = window;
    const { x, y } = coordinates;
    
    if (x <= edgeSwipeThreshold) return 'left';
    if (x >= innerWidth - edgeSwipeThreshold) return 'right';
    if (y <= edgeSwipeThreshold) return 'top';
    if (y >= innerHeight - edgeSwipeThreshold) return 'bottom';
    
    return null;
  }, [enableEdgeSwipes, edgeSwipeThreshold]);

  // Check if gesture qualifies as pull-to-refresh
  const checkPullToRefresh = useCallback((start: TouchCoordinates, current: TouchCoordinates): PullToRefreshGesture => {
    const deltaY = current.y - start.y;
    const isDownwardSwipe = deltaY > 0;
    const isFromTop = start.y <= 100; // Started near top of screen
    const distance = Math.abs(deltaY);
    
    return {
      distance,
      velocity: 0, // Will be calculated later
      isTriggered: enablePullToRefresh && isDownwardSwipe && isFromTop && distance >= pullToRefreshThreshold
    };
  }, [enablePullToRefresh, pullToRefreshThreshold]);

  // Handle touch start
  const handleTouchStart = useCallback((event: TouchEvent) => {
    if (!elementRef.current) return;

    const element = elementRef.current;
    const coordinates = getTouchCoordinates(event);
    const now = Date.now();
    
    setIsGestureActive(true);
    
    if (gesturePreventDefault) {
      event.preventDefault();
    }

    // Clear any existing long press timer
    if (touchStateRef.current.longPressTimer) {
      clearTimeout(touchStateRef.current.longPressTimer);
    }

    // Detect edge swipe
    const edgeDirection = detectEdgeSwipe(coordinates);
    const isEdgeSwipe = edgeDirection !== null;

    // Update touch state
    touchStateRef.current = {
      ...touchStateRef.current,
      startTime: now,
      startCoordinates: coordinates,
      currentCoordinates: coordinates,
      isLongPress: false,
      pullToRefreshDistance: 0,
      isPullToRefreshActive: false,
      isEdgeSwipe,
      edgeSwipeDirection: edgeDirection,
      longPressTimer: setTimeout(() => {
        touchStateRef.current.isLongPress = true;
        setCurrentGesture('longpress');
        triggerHapticFeedback('longPress');
        onLongPress?.(coordinates, element);
        if (debugMode) console.log('Long press detected', coordinates);
      }, longPressDelay)
    };

    // Handle pinch start (two fingers)
    if (event.touches.length === 2) {
      const distance = getDistance(event.touches[0], event.touches[1]);
      touchStateRef.current.initialDistance = distance;
      touchStateRef.current.currentScale = 1;
      setCurrentGesture('pinch');
      if (debugMode) console.log('Pinch start', distance);
    }

    onTouchStart?.(coordinates, element);
    if (debugMode) console.log('Touch start', coordinates);
  }, [elementRef, getTouchCoordinates, gesturePreventDefault, longPressDelay, triggerHapticFeedback, onLongPress, getDistance, onTouchStart, debugMode]);

  // Handle touch move
  const handleTouchMove = useCallback((event: TouchEvent) => {
    if (!elementRef.current || !isGestureActive) return;

    const coordinates = getTouchCoordinates(event);
    touchStateRef.current.currentCoordinates = coordinates;

    // Handle pull-to-refresh
    if (enablePullToRefresh && event.touches.length === 1) {
      const pullGesture = checkPullToRefresh(touchStateRef.current.startCoordinates, coordinates);
      touchStateRef.current.pullToRefreshDistance = pullGesture.distance;
      
      if (pullGesture.isTriggered && !touchStateRef.current.isPullToRefreshActive) {
        touchStateRef.current.isPullToRefreshActive = true;
        setCurrentGesture('pullToRefresh');
        triggerHapticFeedback('pullToRefresh');
        if (debugMode) console.log('Pull to refresh triggered');
      }
      
      // Continue tracking pull-to-refresh during move
      if (touchStateRef.current.isPullToRefreshActive) {
        onPullToRefresh?.(pullGesture, elementRef.current);
      }
    }

    // Handle edge swipe tracking
    if (touchStateRef.current.isEdgeSwipe && touchStateRef.current.edgeSwipeDirection) {
      const distance = Math.sqrt(
        Math.pow(coordinates.x - touchStateRef.current.startCoordinates.x, 2) +
        Math.pow(coordinates.y - touchStateRef.current.startCoordinates.y, 2)
      );
      
      if (distance > swipeThreshold) {
        setCurrentGesture('edgeSwipe');
        if (debugMode) console.log('Edge swipe in progress', touchStateRef.current.edgeSwipeDirection);
      }
    }

    // Handle pinch gesture
    if (event.touches.length === 2 && touchStateRef.current.initialDistance > 0) {
      const currentDistance = getDistance(event.touches[0], event.touches[1]);
      const scale = currentDistance / touchStateRef.current.initialDistance;
      
      // Only trigger if significant scale change
      if (Math.abs(scale - touchStateRef.current.currentScale) > 0.1) {
        touchStateRef.current.currentScale = scale;
        
        const centerX = (event.touches[0].clientX + event.touches[1].clientX) / 2;
        const centerY = (event.touches[0].clientY + event.touches[1].clientY) / 2;
        
        const pinchGesture: PinchGesture = {
          scale,
          velocity: 0, // Could calculate velocity if needed
          center: { x: centerX, y: centerY }
        };
        
        triggerHapticFeedback('pinchZoom');
        onPinch?.(pinchGesture, elementRef.current);
        if (debugMode) console.log('Pinch move', scale);
      }
    }

    // Cancel long press if finger moves too much (unless it's pull-to-refresh)
    const distance = Math.abs(coordinates.x - touchStateRef.current.startCoordinates.x) + 
                    Math.abs(coordinates.y - touchStateRef.current.startCoordinates.y);
    
    if (distance > 10 && touchStateRef.current.longPressTimer && !touchStateRef.current.isPullToRefreshActive) {
      clearTimeout(touchStateRef.current.longPressTimer);
      touchStateRef.current.longPressTimer = null;
    }
  }, [elementRef, isGestureActive, getTouchCoordinates, enablePullToRefresh, checkPullToRefresh, triggerHapticFeedback, onPullToRefresh, swipeThreshold, getDistance, onPinch, debugMode]);

  // Handle touch end
  const handleTouchEnd = useCallback((event: TouchEvent) => {
    if (!elementRef.current || !isGestureActive) return;

    const element = elementRef.current;
    const endCoordinates = getTouchCoordinates(event);
    const now = Date.now();
    const duration = now - touchStateRef.current.startTime;
    
    setIsGestureActive(false);
    setCurrentGesture('');

    // Clear long press timer
    if (touchStateRef.current.longPressTimer) {
      clearTimeout(touchStateRef.current.longPressTimer);
      touchStateRef.current.longPressTimer = null;
    }

    // Handle pull-to-refresh completion
    if (touchStateRef.current.isPullToRefreshActive) {
      const pullGesture = checkPullToRefresh(touchStateRef.current.startCoordinates, endCoordinates);
      pullGesture.velocity = calculateVelocity(pullGesture.distance, duration);
      
      if (pullGesture.isTriggered) {
        triggerHapticFeedback('success');
        onPullToRefresh?.(pullGesture, element);
        if (debugMode) console.log('Pull to refresh completed', pullGesture);
      }
      
      onTouchEnd?.(endCoordinates, element);
      return;
    }

    // Handle edge swipe completion
    if (touchStateRef.current.isEdgeSwipe && touchStateRef.current.edgeSwipeDirection) {
      const deltaX = endCoordinates.x - touchStateRef.current.startCoordinates.x;
      const deltaY = endCoordinates.y - touchStateRef.current.startCoordinates.y;
      const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
      const velocity = calculateVelocity(distance, duration);
      
      if (distance > swipeThreshold && velocity > velocityThreshold) {
        const edgeSwipeGesture: EdgeSwipeGesture = {
          edge: touchStateRef.current.edgeSwipeDirection,
          distance,
          velocity
        };
        
        triggerHapticFeedback('edgeSwipe');
        onEdgeSwipe?.(edgeSwipeGesture, element);
        if (debugMode) console.log('Edge swipe completed', edgeSwipeGesture);
        
        onTouchEnd?.(endCoordinates, element);
        return;
      }
    }

    // Skip other gestures if long press was detected
    if (touchStateRef.current.isLongPress) {
      onTouchEnd?.(endCoordinates, element);
      return;
    }

    // Calculate swipe
    const deltaX = endCoordinates.x - touchStateRef.current.startCoordinates.x;
    const deltaY = endCoordinates.y - touchStateRef.current.startCoordinates.y;
    const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
    const velocity = calculateVelocity(distance, duration);

    // Handle swipe gesture
    if (distance > swipeThreshold && velocity > velocityThreshold) {
      const direction = getSwipeDirection(touchStateRef.current.startCoordinates, endCoordinates);
      
      const swipeGesture: SwipeGesture = {
        direction,
        distance,
        velocity,
        duration
      };
      
      triggerHapticFeedback('light');
      onSwipe?.(swipeGesture, element);
      if (debugMode) console.log('Swipe detected', swipeGesture);
    } 
    // Handle tap/double tap
    else if (distance < 20 && duration < 300) {
      // Check for double tap
      const timeSinceLastTap = now - touchStateRef.current.lastTapTime;
      
      if (timeSinceLastTap < doubleTapDelay && touchStateRef.current.tapCount === 1) {
        // Double tap
        touchStateRef.current.tapCount = 2;
        
        const doubleTapGesture: TapGesture = {
          coordinates: endCoordinates,
          tapCount: 2,
          timestamp: now
        };
        
        triggerHapticFeedback('medium');
        onDoubleTap?.(doubleTapGesture, element);
        if (debugMode) console.log('Double tap detected', doubleTapGesture);
        
        // Reset tap count
        touchStateRef.current.tapCount = 0;
      } else {
        // Single tap (delayed to check for double tap)
        touchStateRef.current.tapCount = 1;
        touchStateRef.current.lastTapTime = now;
        
        setTimeout(() => {
          if (touchStateRef.current.tapCount === 1) {
            const tapGesture: TapGesture = {
              coordinates: endCoordinates,
              tapCount: 1,
              timestamp: now
            };
            
            triggerHapticFeedback('light');
            onTap?.(tapGesture, element);
            if (debugMode) console.log('Single tap detected', tapGesture);
            
            touchStateRef.current.tapCount = 0;
          }
        }, doubleTapDelay);
      }
    }

    onTouchEnd?.(endCoordinates, element);
    if (debugMode) console.log('Touch end', endCoordinates);
  }, [elementRef, isGestureActive, getTouchCoordinates, calculateVelocity, swipeThreshold, velocityThreshold, getSwipeDirection, triggerHapticFeedback, onSwipe, doubleTapDelay, onDoubleTap, onTap, onTouchEnd, debugMode]);

  // Set up event listeners
  useEffect(() => {
    if (!elementRef || !elementRef.current) return;
    const element = elementRef.current;
    if (!element) return;

    // Add touch event listeners
    element.addEventListener('touchstart', handleTouchStart, { passive: !gesturePreventDefault });
    element.addEventListener('touchmove', handleTouchMove, { passive: !gesturePreventDefault });
    element.addEventListener('touchend', handleTouchEnd, { passive: !gesturePreventDefault });

    return () => {
      element.removeEventListener('touchstart', handleTouchStart);
      element.removeEventListener('touchmove', handleTouchMove);
      element.removeEventListener('touchend', handleTouchEnd);
      
      // Clear any pending timers
      if (touchStateRef.current.longPressTimer) {
        clearTimeout(touchStateRef.current.longPressTimer);
      }
    };
  }, [elementRef, handleTouchStart, handleTouchMove, handleTouchEnd, gesturePreventDefault]);

  // Utility function to check if device supports touch
  const isTouchDevice = useCallback(() => {
    if (typeof window === 'undefined') return false;
    return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  }, []);

  // Get current gesture state
  const getGestureState = useCallback(() => ({
    isActive: isGestureActive,
    currentGesture,
    touchSupported: isTouchDevice()
  }), [isGestureActive, currentGesture, isTouchDevice]);

  return {
    isGestureActive,
    currentGesture,
    isTouchDevice: isTouchDevice(),
    getGestureState,
    triggerHapticFeedback
  };
};

export default useMobileGestures;