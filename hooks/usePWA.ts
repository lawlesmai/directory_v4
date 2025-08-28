import { useEffect, useState, useCallback } from 'react';

interface PWAInstallPrompt {
  prompt: () => void;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

interface PWAState {
  isInstalled: boolean;
  isInstallable: boolean;
  isOffline: boolean;
  isUpdateAvailable: boolean;
}

interface UsePWAOptions {
  onInstallPrompt?: () => void;
  onInstallSuccess?: () => void;
  onInstallDeclined?: () => void;
  onOffline?: () => void;
  onOnline?: () => void;
  onUpdateAvailable?: () => void;
  enableNotifications?: boolean;
  autoRegisterSW?: boolean;
}

export const usePWA = (options: UsePWAOptions = {}) => {
  const {
    onInstallPrompt,
    onInstallSuccess,
    onInstallDeclined,
    onOffline,
    onOnline,
    onUpdateAvailable,
    enableNotifications = false,
    autoRegisterSW = true
  } = options;

  const [pwaState, setPWAState] = useState<PWAState>({
    isInstalled: false,
    isInstallable: false,
    isOffline: false,
    isUpdateAvailable: false
  });

  const [deferredPrompt, setDeferredPrompt] = useState<PWAInstallPrompt | null>(null);
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);

  // Check if app is running in standalone mode (installed)
  const checkInstallStatus = useCallback(() => {
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches ||
                        (window.navigator as any).standalone ||
                        document.referrer.includes('android-app://');
    
    setPWAState(prev => ({ ...prev, isInstalled: isStandalone }));
  }, []);

  // Register service worker
  const registerServiceWorker = useCallback(async () => {
    if ('serviceWorker' in navigator && autoRegisterSW) {
      try {
        const registration = await navigator.serviceWorker.register('/sw.js', {
          scope: '/'
        });
        
        setRegistration(registration);
        
        // Check for updates
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                setPWAState(prev => ({ ...prev, isUpdateAvailable: true }));
                onUpdateAvailable?.();
              }
            });
          }
        });
        
        // Listen for waiting service worker
        if (registration.waiting) {
          setPWAState(prev => ({ ...prev, isUpdateAvailable: true }));
          onUpdateAvailable?.();
        }
        
        console.log('PWA: Service Worker registered successfully');
        return registration;
      } catch (error) {
        console.error('PWA: Service Worker registration failed:', error);
        return null;
      }
    }
    return null;
  }, [autoRegisterSW, onUpdateAvailable]);

  // Update service worker
  const updateServiceWorker = useCallback(() => {
    if (registration?.waiting) {
      registration.waiting.postMessage({ type: 'SKIP_WAITING' });
      window.location.reload();
    }
  }, [registration]);

  // Show install prompt
  const showInstallPrompt = useCallback(async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      
      const { outcome } = await deferredPrompt.userChoice;
      
      if (outcome === 'accepted') {
        onInstallSuccess?.();
      } else {
        onInstallDeclined?.();
      }
      
      setDeferredPrompt(null);
      setPWAState(prev => ({ ...prev, isInstallable: false }));
    }
  }, [deferredPrompt, onInstallSuccess, onInstallDeclined]);

  // Request notification permission
  const requestNotificationPermission = useCallback(async () => {
    if ('Notification' in window && enableNotifications) {
      const permission = await Notification.requestPermission();
      
      if (permission === 'granted' && registration) {
        try {
          // Subscribe to push notifications
          const subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
          });
          
          // Send subscription to server
          await fetch('/api/push-subscribe', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(subscription)
          });
          
          return true;
        } catch (error) {
          console.error('PWA: Failed to subscribe to push notifications:', error);
          return false;
        }
      }
    }
    return false;
  }, [enableNotifications, registration]);

  // Share content using Web Share API
  const shareContent = useCallback(async (shareData: ShareData) => {
    if (navigator.share) {
      try {
        await navigator.share(shareData);
        return true;
      } catch (error) {
        console.error('PWA: Web Share failed:', error);
        return false;
      }
    }
    return false;
  }, []);

  // Get app install banner info
  const getInstallBannerInfo = useCallback(() => {
    return {
      canInstall: !!deferredPrompt,
      isInstalled: pwaState.isInstalled,
      isStandalone: window.matchMedia('(display-mode: standalone)').matches
    };
  }, [deferredPrompt, pwaState.isInstalled]);

  // Get offline storage info
  const getStorageInfo = useCallback(async () => {
    if ('storage' in navigator && 'estimate' in navigator.storage) {
      try {
        const estimate = await navigator.storage.estimate();
        return {
          quota: estimate.quota || 0,
          usage: estimate.usage || 0,
          available: (estimate.quota || 0) - (estimate.usage || 0)
        };
      } catch (error) {
        console.error('PWA: Failed to get storage estimate:', error);
        return null;
      }
    }
    return null;
  }, []);

  // Clear app cache
  const clearCache = useCallback(async () => {
    try {
      const cacheNames = await caches.keys();
      await Promise.all(
        cacheNames.map(cacheName => caches.delete(cacheName))
      );
      
      if (registration) {
        await registration.unregister();
        window.location.reload();
      }
      
      return true;
    } catch (error) {
      console.error('PWA: Failed to clear cache:', error);
      return false;
    }
  }, [registration]);

  // Background sync
  const backgroundSync = useCallback(async (tag: string) => {
    if (registration && 'sync' in window.ServiceWorkerRegistration.prototype) {
      try {
        await (registration as any).sync.register(tag);
        return true;
      } catch (error) {
        console.error('PWA: Background sync registration failed:', error);
        return false;
      }
    }
    return false;
  }, [registration]);

  // Initialize PWA functionality
  useEffect(() => {
    checkInstallStatus();
    registerServiceWorker();

    // Listen for beforeinstallprompt event
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as any);
      setPWAState(prev => ({ ...prev, isInstallable: true }));
      onInstallPrompt?.();
    };

    // Listen for app installed event
    const handleAppInstalled = () => {
      setPWAState(prev => ({ ...prev, isInstalled: true, isInstallable: false }));
      setDeferredPrompt(null);
      onInstallSuccess?.();
    };

    // Listen for online/offline events
    const handleOnline = () => {
      setPWAState(prev => ({ ...prev, isOffline: false }));
      onOnline?.();
    };

    const handleOffline = () => {
      setPWAState(prev => ({ ...prev, isOffline: true }));
      onOffline?.();
    };

    // Set initial offline state
    setPWAState(prev => ({ ...prev, isOffline: !navigator.onLine }));

    // Add event listeners
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Listen for display mode changes
    const mediaQuery = window.matchMedia('(display-mode: standalone)');
    const handleDisplayModeChange = () => {
      setPWAState(prev => ({ ...prev, isInstalled: mediaQuery.matches }));
    };
    
    mediaQuery.addEventListener('change', handleDisplayModeChange);

    // Cleanup
    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      mediaQuery.removeEventListener('change', handleDisplayModeChange);
    };
  }, [
    checkInstallStatus,
    registerServiceWorker,
    onInstallPrompt,
    onInstallSuccess,
    onOnline,
    onOffline
  ]);

  return {
    // State
    ...pwaState,
    registration,
    
    // Actions
    showInstallPrompt,
    updateServiceWorker,
    requestNotificationPermission,
    shareContent,
    clearCache,
    backgroundSync,
    
    // Utils
    getInstallBannerInfo,
    getStorageInfo,
    
    // Capabilities
    canInstall: !!deferredPrompt,
    canShare: !!navigator.share,
    canNotify: 'Notification' in window,
    canSync: 'serviceWorker' in navigator && 'sync' in window.ServiceWorkerRegistration.prototype,
    hasStorage: 'storage' in navigator && 'estimate' in navigator.storage
  };
};

export default usePWA;