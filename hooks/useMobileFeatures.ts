import { useState, useEffect, useCallback, useRef } from 'react';
import { useMobileGestures } from './useMobileGestures';

export interface DeviceInfo {
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  isTouchDevice: boolean;
  isIOS: boolean;
  isAndroid: boolean;
  devicePixelRatio: number;
  screenWidth: number;
  screenHeight: number;
  orientation: 'portrait' | 'landscape';
  platform: string;
  userAgent: string;
}

export interface NetworkInfo {
  connectionType: string;
  effectiveType: string;
  downlink: number;
  saveData: boolean;
  isOnline: boolean;
  estimatedSpeed: 'slow' | 'medium' | 'fast';
}

export interface BatteryInfo {
  level: number;
  charging: boolean;
  chargingTime: number;
  dischargingTime: number;
  isLowBattery: boolean;
}

export interface MotionSensorData {
  acceleration: { x: number; y: number; z: number } | null;
  accelerationIncludingGravity: { x: number; y: number; z: number } | null;
  rotationRate: { alpha: number; beta: number; gamma: number } | null;
  orientation: { alpha: number; beta: number; gamma: number } | null;
  isSupported: boolean;
}

export interface MobileInteractionState {
  isScrolling: boolean;
  scrollDirection: 'up' | 'down' | 'none';
  scrollVelocity: number;
  isNearEdge: { top: boolean; bottom: boolean; left: boolean; right: boolean };
  lastInteraction: number;
  idleTime: number;
  isUserActive: boolean;
}

export interface MobileFeaturesConfig {
  enableGestures: boolean;
  enableMotionSensors: boolean;
  enableNetworkMonitoring: boolean;
  enableBatteryMonitoring: boolean;
  enableScrollTracking: boolean;
  enablePullToRefresh: boolean;
  enableSwipeNavigation: boolean;
  enableHapticFeedback: boolean;
  adaptivePerformance: boolean;
  lowPowerModeThreshold: number;
  idleTimeThreshold: number;
}

export interface UseMobileFeaturesOptions {
  config?: Partial<MobileFeaturesConfig>;
  onSwipeRefresh?: () => void;
  onSwipeNavigation?: (direction: 'left' | 'right') => void;
  onOrientationChange?: (orientation: 'portrait' | 'landscape') => void;
  onNetworkChange?: (networkInfo: NetworkInfo) => void;
  onBatteryChange?: (batteryInfo: BatteryInfo) => void;
  onMotionDetected?: (motionData: MotionSensorData) => void;
  onScrollThreshold?: (position: number, direction: 'up' | 'down') => void;
  onUserIdleChange?: (isIdle: boolean, idleTime: number) => void;
}

const DEFAULT_CONFIG: MobileFeaturesConfig = {
  enableGestures: true,
  enableMotionSensors: false,
  enableNetworkMonitoring: true,
  enableBatteryMonitoring: true,
  enableScrollTracking: true,
  enablePullToRefresh: true,
  enableSwipeNavigation: true,
  enableHapticFeedback: true,
  adaptivePerformance: true,
  lowPowerModeThreshold: 20,
  idleTimeThreshold: 30000 // 30 seconds
};

export const useMobileFeatures = (
  elementRef: React.RefObject<HTMLElement>,
  options: UseMobileFeaturesOptions = {}
) => {
  const {
    config: userConfig = {},
    onSwipeRefresh,
    onSwipeNavigation,
    onOrientationChange,
    onNetworkChange,
    onBatteryChange,
    onMotionDetected,
    onScrollThreshold,
    onUserIdleChange
  } = options;

  const config = { ...DEFAULT_CONFIG, ...userConfig };

  // State
  const [deviceInfo, setDeviceInfo] = useState<DeviceInfo>({
    isMobile: false,
    isTablet: false,
    isDesktop: true,
    isTouchDevice: false,
    isIOS: false,
    isAndroid: false,
    devicePixelRatio: 1,
    screenWidth: 0,
    screenHeight: 0,
    orientation: 'portrait',
    platform: '',
    userAgent: ''
  });

  const [networkInfo, setNetworkInfo] = useState<NetworkInfo>({
    connectionType: 'unknown',
    effectiveType: 'unknown',
    downlink: 0,
    saveData: false,
    isOnline: typeof navigator !== "undefined" ? navigator.onLine : true,
    estimatedSpeed: 'medium'
  });

  const [batteryInfo, setBatteryInfo] = useState<BatteryInfo>({
    level: 1,
    charging: false,
    chargingTime: 0,
    dischargingTime: 0,
    isLowBattery: false
  });

  const [motionData, setMotionData] = useState<MotionSensorData>({
    acceleration: null,
    accelerationIncludingGravity: null,
    rotationRate: null,
    orientation: null,
    isSupported: false
  });

  const [interactionState, setInteractionState] = useState<MobileInteractionState>({
    isScrolling: false,
    scrollDirection: 'none',
    scrollVelocity: 0,
    isNearEdge: { top: true, bottom: false, left: false, right: false },
    lastInteraction: Date.now(),
    idleTime: 0,
    isUserActive: true
  });

  // Refs
  const lastScrollYRef = useRef(0);
  const scrollVelocityRef = useRef(0);
  const idleTimerRef = useRef<NodeJS.Timeout | null>(null);
  const motionPermissionRef = useRef<'granted' | 'denied' | 'prompt'>('prompt');

  // Device detection
  const detectDevice = useCallback(() => {
    if (typeof window === 'undefined') return;

    const userAgent = navigator.userAgent;
    const platform = navigator.platform;
    const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    const screenWidth = window.screen.width;
    const screenHeight = window.screen.height;
    const devicePixelRatio = window.devicePixelRatio || 1;
    
    const isIOS = /iPad|iPhone|iPod/.test(userAgent);
    const isAndroid = /Android/.test(userAgent);
    const isMobile = /Mobi|Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent);
    const isTablet = /(ipad|tablet|(android(?!.*mobile))|(windows(?!.*phone)(.*touch))|kindle|playbook|silk|(puffin(?!.*(IP|AP|WP))))/i.test(userAgent);
    const isDesktop = !isMobile && !isTablet;

    const orientation = screenWidth > screenHeight ? 'landscape' : 'portrait';

    setDeviceInfo({
      isMobile,
      isTablet,
      isDesktop,
      isTouchDevice,
      isIOS,
      isAndroid,
      devicePixelRatio,
      screenWidth,
      screenHeight,
      orientation,
      platform,
      userAgent
    });
  }, []);

  // Network monitoring
  const updateNetworkInfo = useCallback(() => {
    if (!config.enableNetworkMonitoring) return;

    const connection = (navigator as any).connection || (navigator as any).mozConnection || (navigator as any).webkitConnection;
    
    if (connection) {
      const effectiveType = connection.effectiveType || 'unknown';
      const downlink = connection.downlink || 0;
      const saveData = connection.saveData || false;
      
      const estimatedSpeed = 
        effectiveType === '4g' ? 'fast' :
        effectiveType === '3g' ? 'medium' : 'slow';

      const newNetworkInfo = {
        connectionType: connection.type || 'unknown',
        effectiveType,
        downlink,
        saveData,
        isOnline: typeof navigator !== "undefined" ? navigator.onLine : true,
        estimatedSpeed
      };

      setNetworkInfo(prev => {
        if (JSON.stringify(prev) !== JSON.stringify(newNetworkInfo)) {
          onNetworkChange?.(newNetworkInfo);
        }
        return newNetworkInfo;
      });
    }
  }, [config.enableNetworkMonitoring, onNetworkChange]);

  // Battery monitoring
  const updateBatteryInfo = useCallback(async () => {
    if (!config.enableBatteryMonitoring || !('getBattery' in navigator)) return;

    try {
      const battery = await (navigator as any).getBattery();
      
      const newBatteryInfo = {
        level: battery.level,
        charging: battery.charging,
        chargingTime: battery.chargingTime,
        dischargingTime: battery.dischargingTime,
        isLowBattery: battery.level < (config.lowPowerModeThreshold / 100)
      };

      setBatteryInfo(prev => {
        if (JSON.stringify(prev) !== JSON.stringify(newBatteryInfo)) {
          onBatteryChange?.(newBatteryInfo);
        }
        return newBatteryInfo;
      });
    } catch (error) {
      console.warn('Battery API not supported:', error);
    }
  }, [config.enableBatteryMonitoring, config.lowPowerModeThreshold, onBatteryChange]);

  // Motion sensors
  const requestMotionPermission = useCallback(async () => {
    if (!config.enableMotionSensors) return false;

    if (typeof (DeviceMotionEvent as any).requestPermission === 'function') {
      try {
        const permission = await (DeviceMotionEvent as any).requestPermission();
        motionPermissionRef.current = permission;
        return permission === 'granted';
      } catch (error) {
        console.warn('Motion permission request failed:', error);
        return false;
      }
    }

    // For non-iOS devices, assume permission is granted
    motionPermissionRef.current = 'granted';
    return true;
  }, [config.enableMotionSensors]);

  const handleDeviceMotion = useCallback((event: DeviceMotionEvent) => {
    const newMotionData: MotionSensorData = {
      acceleration: event.acceleration ? {
        x: event.acceleration.x || 0,
        y: event.acceleration.y || 0,
        z: event.acceleration.z || 0
      } : null,
      accelerationIncludingGravity: event.accelerationIncludingGravity ? {
        x: event.accelerationIncludingGravity.x || 0,
        y: event.accelerationIncludingGravity.y || 0,
        z: event.accelerationIncludingGravity.z || 0
      } : null,
      rotationRate: event.rotationRate ? {
        alpha: event.rotationRate.alpha || 0,
        beta: event.rotationRate.beta || 0,
        gamma: event.rotationRate.gamma || 0
      } : null,
      orientation: null,
      isSupported: true
    };

    setMotionData(newMotionData);
    onMotionDetected?.(newMotionData);
  }, [onMotionDetected]);

  const handleDeviceOrientation = useCallback((event: DeviceOrientationEvent) => {
    setMotionData(prev => ({
      ...prev,
      orientation: {
        alpha: event.alpha || 0,
        beta: event.beta || 0,
        gamma: event.gamma || 0
      }
    }));
  }, []);

  // Scroll tracking
  const handleScroll = useCallback(() => {
    if (!config.enableScrollTracking) return;

    const currentScrollY = window.scrollY;
    const scrollDelta = currentScrollY - lastScrollYRef.current;
    const scrollDirection = scrollDelta > 0 ? 'down' : scrollDelta < 0 ? 'up' : 'none';
    const scrollVelocity = Math.abs(scrollDelta);

    // Update velocity with smoothing
    scrollVelocityRef.current = scrollVelocityRef.current * 0.8 + scrollVelocity * 0.2;

    // Check if near edges
    const windowHeight = window.innerHeight;
    const documentHeight = document.documentElement.scrollHeight;
    const isNearTop = currentScrollY < 100;
    const isNearBottom = currentScrollY > documentHeight - windowHeight - 100;

    setInteractionState(prev => ({
      ...prev,
      isScrolling: scrollVelocity > 1,
      scrollDirection,
      scrollVelocity: scrollVelocityRef.current,
      isNearEdge: {
        top: isNearTop,
        bottom: isNearBottom,
        left: false,
        right: false
      },
      lastInteraction: Date.now(),
      isUserActive: true
    }));

    // Call threshold callback
    if (scrollDirection !== 'none') {
      onScrollThreshold?.(currentScrollY, scrollDirection);
    }

    lastScrollYRef.current = currentScrollY;
  }, [config.enableScrollTracking, onScrollThreshold]);

  // Idle detection
  const resetIdleTimer = useCallback(() => {
    if (idleTimerRef.current) {
      clearTimeout(idleTimerRef.current);
    }

    setInteractionState(prev => ({
      ...prev,
      lastInteraction: Date.now(),
      idleTime: 0,
      isUserActive: true
    }));

    idleTimerRef.current = setTimeout(() => {
      setInteractionState(prev => {
        const newState = {
          ...prev,
          idleTime: Date.now() - prev.lastInteraction,
          isUserActive: false
        };

        onUserIdleChange?.(false, newState.idleTime);
        return newState;
      });
    }, config.idleTimeThreshold);
  }, [config.idleTimeThreshold, onUserIdleChange]);

  // Mobile gestures integration
  const gestureOptions = config.enableGestures ? {
    enableHapticFeedback: config.enableHapticFeedback,
    onSwipe: (gesture: any) => {
      // Handle pull to refresh
      if (config.enablePullToRefresh && gesture.direction === 'down' && interactionState.isNearEdge.top) {
        onSwipeRefresh?.();
      }
      
      // Handle swipe navigation
      if (config.enableSwipeNavigation && (gesture.direction === 'left' || gesture.direction === 'right')) {
        onSwipeNavigation?.(gesture.direction);
      }
      
      resetIdleTimer();
    },
    onTap: () => resetIdleTimer(),
    onLongPress: () => resetIdleTimer(),
    onTouchStart: () => resetIdleTimer(),
  } : {};

  const mobileGestures = useMobileGestures(elementRef, gestureOptions);

  // Adaptive performance based on device capabilities
  const getPerformanceLevel = useCallback(() => {
    if (!config.adaptivePerformance) return 'high';

    const factors = {
      lowBattery: batteryInfo.isLowBattery,
      slowConnection: networkInfo.estimatedSpeed === 'slow',
      lowEndDevice: deviceInfo.devicePixelRatio < 2,
      reducedMotion: typeof window !== "undefined" && window.matchMedia('(prefers-reduced-motion: reduce)').matches
    };

    const negativeFactors = Object.values(factors).filter(Boolean).length;
    
    if (negativeFactors >= 3) return 'low';
    if (negativeFactors >= 2) return 'medium';
    return 'high';
  }, [config.adaptivePerformance, batteryInfo.isLowBattery, networkInfo.estimatedSpeed, deviceInfo.devicePixelRatio]);

  // Wake lock API for preventing screen sleep
  const requestWakeLock = useCallback(async () => {
    if ('wakeLock' in navigator) {
      try {
        const wakeLock = await (navigator as any).wakeLock.request('screen');
        return wakeLock;
      } catch (error) {
        console.warn('Wake lock request failed:', error);
      }
    }
    return null;
  }, []);

  // Share API integration
  const shareContent = useCallback(async (data: { title?: string; text?: string; url?: string }) => {
    if ('share' in navigator) {
      try {
        await navigator.share(data);
        return true;
      } catch (error) {
        console.warn('Share failed:', error);
      }
    }
    return false;
  }, []);

  // Clipboard API
  const copyToClipboard = useCallback(async (text: string) => {
    if ('clipboard' in navigator) {
      try {
        await navigator.clipboard.writeText(text);
        return true;
      } catch (error) {
        console.warn('Clipboard write failed:', error);
      }
    }
    
    // Fallback for older browsers
    const textArea = document.createElement('textarea');
    textArea.value = text;
    document.body.appendChild(textArea);
    textArea.select();
    try {
      document.execCommand('copy');
      document.body.removeChild(textArea);
      return true;
    } catch (error) {
      document.body.removeChild(textArea);
      return false;
    }
  }, []);

  // Initialize device detection
  useEffect(() => {
    detectDevice();
  }, [detectDevice]);

  // Set up network monitoring
  useEffect(() => {
    if (!config.enableNetworkMonitoring) return;

    updateNetworkInfo();
    
    const handleOnline = () => setNetworkInfo(prev => ({ ...prev, isOnline: true }));
    const handleOffline = () => setNetworkInfo(prev => ({ ...prev, isOnline: false }));
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    const connection = (navigator as any).connection;
    if (connection) {
      connection.addEventListener('change', updateNetworkInfo);
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      if (connection) {
        connection.removeEventListener('change', updateNetworkInfo);
      }
    };
  }, [config.enableNetworkMonitoring, updateNetworkInfo]);

  // Set up battery monitoring
  useEffect(() => {
    if (!config.enableBatteryMonitoring) return;

    updateBatteryInfo();
    
    const interval = setInterval(updateBatteryInfo, 60000); // Update every minute
    
    return () => clearInterval(interval);
  }, [config.enableBatteryMonitoring, updateBatteryInfo]);

  // Set up motion sensors
  useEffect(() => {
    if (!config.enableMotionSensors) return;

    const setupMotionSensors = async () => {
      const hasPermission = await requestMotionPermission();
      
      if (hasPermission) {
        window.addEventListener('devicemotion', handleDeviceMotion);
        window.addEventListener('deviceorientation', handleDeviceOrientation);
        
        setMotionData(prev => ({ ...prev, isSupported: true }));
      }
    };

    setupMotionSensors();

    return () => {
      window.removeEventListener('devicemotion', handleDeviceMotion);
      window.removeEventListener('deviceorientation', handleDeviceOrientation);
    };
  }, [config.enableMotionSensors, requestMotionPermission, handleDeviceMotion, handleDeviceOrientation]);

  // Set up scroll tracking
  useEffect(() => {
    if (!config.enableScrollTracking) return;

    window.addEventListener('scroll', handleScroll, { passive: true });
    
    return () => window.removeEventListener('scroll', handleScroll);
  }, [config.enableScrollTracking, handleScroll]);

  // Set up orientation change detection
  useEffect(() => {
    const handleOrientationChange = () => {
      setTimeout(() => {
        const orientation = window.screen.width > window.screen.height ? 'landscape' : 'portrait';
        setDeviceInfo(prev => ({ ...prev, orientation }));
        onOrientationChange?.(orientation);
      }, 100); // Small delay to ensure dimensions are updated
    };

    window.addEventListener('orientationchange', handleOrientationChange);
    window.addEventListener('resize', handleOrientationChange);

    return () => {
      window.removeEventListener('orientationchange', handleOrientationChange);
      window.removeEventListener('resize', handleOrientationChange);
    };
  }, [onOrientationChange]);

  // Set up idle detection
  useEffect(() => {
    resetIdleTimer();

    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'];
    events.forEach(event => {
      document.addEventListener(event, resetIdleTimer, { passive: true });
    });

    return () => {
      if (idleTimerRef.current) {
        clearTimeout(idleTimerRef.current);
      }
      events.forEach(event => {
        document.removeEventListener(event, resetIdleTimer);
      });
    };
  }, [resetIdleTimer]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (idleTimerRef.current) {
        clearTimeout(idleTimerRef.current);
      }
    };
  }, []);

  return {
    // Device information
    deviceInfo,
    networkInfo,
    batteryInfo,
    motionData,
    interactionState,

    // Gesture integration
    ...mobileGestures,

    // Utilities
    getPerformanceLevel: getPerformanceLevel(),
    requestWakeLock,
    shareContent,
    copyToClipboard,
    requestMotionPermission,

    // Configuration
    config
  };
};

export default useMobileFeatures;