// Service Worker for The Lawless Directory PWA
// Provides offline functionality, caching, and background sync

const CACHE_NAME = 'lawless-directory-v1';
const STATIC_CACHE = `${CACHE_NAME}-static`;
const DYNAMIC_CACHE = `${CACHE_NAME}-dynamic`;
const API_CACHE = `${CACHE_NAME}-api`;

// Assets to cache immediately
const STATIC_ASSETS = [
  '/',
  '/offline',
  '/manifest.json',
  '/favicon.ico',
  // Add critical CSS and JS files
];

// API endpoints to cache
const API_ENDPOINTS = [
  '/api/businesses',
  '/api/categories',
  '/api/search'
];

// Maximum age for different cache types (in milliseconds)
const CACHE_EXPIRY = {
  static: 7 * 24 * 60 * 60 * 1000, // 7 days
  api: 30 * 60 * 1000, // 30 minutes
  images: 24 * 60 * 60 * 1000, // 24 hours
  dynamic: 2 * 60 * 60 * 1000 // 2 hours
};

// Install event - cache static assets
self.addEventListener('install', (event) => {
  console.log('SW: Installing service worker...');
  
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => {
        console.log('SW: Caching static assets');
        return cache.addAll(STATIC_ASSETS);
      })
      .catch((error) => {
        console.error('SW: Error caching static assets:', error);
      })
  );
  
  // Skip waiting and immediately activate
  self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('SW: Activating service worker...');
  
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((name) => name.startsWith('lawless-directory-') && name !== CACHE_NAME)
            .map((name) => {
              console.log('SW: Deleting old cache:', name);
              return caches.delete(name);
            })
        );
      })
      .then(() => {
        // Take control of all pages immediately
        return self.clients.claim();
      })
  );
});

// Fetch event - implement caching strategies
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  
  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }
  
  // Handle different types of requests
  if (url.pathname.startsWith('/api/')) {
    // API requests - network first, cache fallback
    event.respondWith(handleApiRequest(request));
  } else if (isImageRequest(request)) {
    // Images - cache first, network fallback
    event.respondWith(handleImageRequest(request));
  } else if (isStaticAsset(request)) {
    // Static assets - cache first
    event.respondWith(handleStaticRequest(request));
  } else {
    // HTML pages - network first, cache fallback
    event.respondWith(handlePageRequest(request));
  }
});

// Network first strategy for API requests
async function handleApiRequest(request) {
  const cacheKey = getCacheKey(request);
  
  try {
    // Try network first
    const networkResponse = await fetch(request);
    
    if (networkResponse.ok) {
      // Cache successful responses
      const cache = await caches.open(API_CACHE);
      const responseToCache = networkResponse.clone();
      
      // Add timestamp for expiry checking
      const headers = new Headers(responseToCache.headers);
      headers.set('sw-cached-at', Date.now().toString());
      
      const modifiedResponse = new Response(responseToCache.body, {
        status: responseToCache.status,
        statusText: responseToCache.statusText,
        headers: headers
      });
      
      cache.put(cacheKey, modifiedResponse);
    }
    
    return networkResponse;
  } catch (error) {
    console.log('SW: Network failed, trying cache for API request');
    
    // Network failed, try cache
    const cache = await caches.open(API_CACHE);
    const cachedResponse = await cache.match(cacheKey);
    
    if (cachedResponse && !isExpired(cachedResponse, CACHE_EXPIRY.api)) {
      return cachedResponse;
    }
    
    // Return offline page for failed API requests
    return new Response(JSON.stringify({
      error: 'Offline',
      message: 'This content is not available offline'
    }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// Cache first strategy for images
async function handleImageRequest(request) {
  const cache = await caches.open(DYNAMIC_CACHE);
  const cachedResponse = await cache.match(request);
  
  if (cachedResponse && !isExpired(cachedResponse, CACHE_EXPIRY.images)) {
    return cachedResponse;
  }
  
  try {
    const networkResponse = await fetch(request);
    
    if (networkResponse.ok) {
      const responseToCache = networkResponse.clone();
      const headers = new Headers(responseToCache.headers);
      headers.set('sw-cached-at', Date.now().toString());
      
      const modifiedResponse = new Response(responseToCache.body, {
        status: responseToCache.status,
        statusText: responseToCache.statusText,
        headers: headers
      });
      
      cache.put(request, modifiedResponse);
    }
    
    return networkResponse;
  } catch (error) {
    console.log('SW: Image failed to load, using placeholder');
    
    // Return cached version if available, even if expired
    if (cachedResponse) {
      return cachedResponse;
    }
    
    // Return placeholder image
    return new Response('', {
      status: 404,
      statusText: 'Image not available offline'
    });
  }
}

// Cache first strategy for static assets
async function handleStaticRequest(request) {
  const cache = await caches.open(STATIC_CACHE);
  const cachedResponse = await cache.match(request);
  
  if (cachedResponse) {
    return cachedResponse;
  }
  
  try {
    const networkResponse = await fetch(request);
    
    if (networkResponse.ok) {
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    console.log('SW: Static asset failed to load');
    throw error;
  }
}

// Network first strategy for HTML pages
async function handlePageRequest(request) {
  try {
    const networkResponse = await fetch(request);
    
    if (networkResponse.ok) {
      const cache = await caches.open(DYNAMIC_CACHE);
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    console.log('SW: Page failed to load, trying cache');
    
    const cache = await caches.open(DYNAMIC_CACHE);
    const cachedResponse = await cache.match(request);
    
    if (cachedResponse) {
      return cachedResponse;
    }
    
    // Return offline page
    const offlineResponse = await cache.match('/offline');
    if (offlineResponse) {
      return offlineResponse;
    }
    
    // Fallback offline page
    return new Response(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Offline - Lawless Directory</title>
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <style>
            body { 
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              display: flex; 
              align-items: center; 
              justify-content: center; 
              min-height: 100vh; 
              margin: 0;
              background: linear-gradient(135deg, #001219 0%, #005F73 100%);
              color: white;
              text-align: center;
              padding: 20px;
            }
            .offline-content {
              max-width: 400px;
            }
            .offline-icon {
              font-size: 4rem;
              margin-bottom: 1rem;
            }
            h1 { margin-bottom: 0.5rem; }
            p { opacity: 0.8; margin-bottom: 2rem; }
            .retry-btn {
              background: #00B4D8;
              color: white;
              border: none;
              padding: 12px 24px;
              border-radius: 8px;
              cursor: pointer;
              font-size: 1rem;
            }
          </style>
        </head>
        <body>
          <div class="offline-content">
            <div class="offline-icon">📱</div>
            <h1>You're Offline</h1>
            <p>Check your internet connection and try again.</p>
            <button class="retry-btn" onclick="location.reload()">Retry</button>
          </div>
        </body>
      </html>
    `, {
      headers: { 'Content-Type': 'text/html' }
    });
  }
}

// Background sync for form submissions and user actions
self.addEventListener('sync', (event) => {
  console.log('SW: Background sync triggered:', event.tag);
  
  if (event.tag === 'background-sync-bookmarks') {
    event.waitUntil(syncBookmarks());
  } else if (event.tag === 'background-sync-analytics') {
    event.waitUntil(syncAnalytics());
  }
});

// Push notification handling
self.addEventListener('push', (event) => {
  const options = {
    body: event.data ? event.data.text() : 'New update available',
    icon: '/icons/icon-192x192.png',
    badge: '/icons/badge-72x72.png',
    vibrate: [200, 100, 200],
    data: {
      dateOfArrival: Date.now(),
      primaryKey: 1
    },
    actions: [
      {
        action: 'explore',
        title: 'View',
        icon: '/icons/action-explore.png'
      },
      {
        action: 'close',
        title: 'Close',
        icon: '/icons/action-close.png'
      }
    ]
  };
  
  event.waitUntil(
    self.registration.showNotification('Lawless Directory', options)
  );
});

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  
  if (event.action === 'explore') {
    event.waitUntil(
      clients.openWindow('/')
    );
  } else if (event.action === 'close') {
    // Just close the notification
  } else {
    // Default action - open the app
    event.waitUntil(
      clients.openWindow('/')
    );
  }
});

// Utility functions
function getCacheKey(request) {
  const url = new URL(request.url);
  // Remove query parameters for API caching (except essential ones)
  const essentialParams = ['page', 'limit', 'category'];
  const params = new URLSearchParams();
  
  essentialParams.forEach(param => {
    if (url.searchParams.has(param)) {
      params.set(param, url.searchParams.get(param));
    }
  });
  
  return `${url.pathname}${params.toString() ? '?' + params.toString() : ''}`;
}

function isExpired(response, maxAge) {
  const cachedAt = response.headers.get('sw-cached-at');
  if (!cachedAt) return true;
  
  return (Date.now() - parseInt(cachedAt)) > maxAge;
}

function isImageRequest(request) {
  return request.destination === 'image' || 
         /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(request.url);
}

function isStaticAsset(request) {
  return request.destination === 'script' ||
         request.destination === 'style' ||
         /\.(js|css|woff|woff2|ttf|eot)$/i.test(request.url);
}

async function syncBookmarks() {
  try {
    // Sync bookmarks stored locally with server
    const bookmarks = await getStoredBookmarks();
    if (bookmarks.length > 0) {
      const response = await fetch('/api/bookmarks/sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(bookmarks)
      });
      
      if (response.ok) {
        await clearStoredBookmarks();
        console.log('SW: Bookmarks synced successfully');
      }
    }
  } catch (error) {
    console.error('SW: Failed to sync bookmarks:', error);
  }
}

async function syncAnalytics() {
  try {
    // Sync analytics events stored locally
    const events = await getStoredAnalytics();
    if (events.length > 0) {
      const response = await fetch('/api/analytics', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(events)
      });
      
      if (response.ok) {
        await clearStoredAnalytics();
        console.log('SW: Analytics synced successfully');
      }
    }
  } catch (error) {
    console.error('SW: Failed to sync analytics:', error);
  }
}

async function getStoredBookmarks() {
  // Implementation would depend on your storage mechanism
  return [];
}

async function clearStoredBookmarks() {
  // Implementation would depend on your storage mechanism
}

async function getStoredAnalytics() {
  // Implementation would depend on your storage mechanism
  return [];
}

async function clearStoredAnalytics() {
  // Implementation would depend on your storage mechanism
}

// Message handling from the main thread
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});