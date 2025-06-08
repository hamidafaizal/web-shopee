// PWA Service Worker
const CACHE_NAME = 'komisi-pwa-v1.0.0';
const urlsToCache = [
    '/pwa/',
    '/pwa/login.html',
    '/pwa/css/style.css',
    '/pwa/js/app.js',
    '/pwa/js/auth.js',
    '/pwa/manifest.json',
    '/pwa/icons/icon-192.png',
    '/pwa/icons/icon-512.png'
];

// Install event - cache resources
self.addEventListener('install', event => {
    console.log('Service Worker installing...');
    
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('Caching app shell');
                return cache.addAll(urlsToCache);
            })
            .then(() => {
                console.log('Service Worker installed successfully');
                return self.skipWaiting();
            })
            .catch(error => {
                console.error('Service Worker install failed:', error);
            })
    );
});

// Activate event - clean up old caches
self.addEventListener('activate', event => {
    console.log('Service Worker activating...');
    
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    if (cacheName !== CACHE_NAME) {
                        console.log('Deleting old cache:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => {
            console.log('Service Worker activated');
            return self.clients.claim();
        })
    );
});

// Fetch event - serve cached content when offline
self.addEventListener('fetch', event => {
    const { request } = event;
    const url = new URL(request.url);
    
    // Only handle requests for our PWA
    if (!url.pathname.startsWith('/pwa/')) {
        return;
    }
    
    event.respondWith(
        caches.match(request)
            .then(response => {
                // Return cached version if available
                if (response) {
                    return response;
                }
                
                // Otherwise fetch from network
                return fetch(request).then(response => {
                    // Don't cache non-successful responses
                    if (!response || response.status !== 200 || response.type !== 'basic') {
                        return response;
                    }
                    
                    // Clone the response for caching
                    const responseToCache = response.clone();
                    
                    caches.open(CACHE_NAME)
                        .then(cache => {
                            cache.put(request, responseToCache);
                        });
                    
                    return response;
                });
            })
            .catch(() => {
                // If both cache and network fail, return offline page
                if (request.destination === 'document') {
                    return caches.match('/pwa/');
                }
            })
    );
});

// Background sync for offline actions
self.addEventListener('sync', event => {
    console.log('Background sync:', event.tag);
    
    if (event.tag === 'batch-delete') {
        event.waitUntil(processPendingDeletes());
    }
});

// Push notification handling
self.addEventListener('push', event => {
    console.log('Push message received:', event);
    
    if (!event.data) {
        console.log('Push message has no data');
        return;
    }
    
    const data = event.data.json();
    console.log('Push data:', data);
    
    const options = {
        body: data.notification?.body || 'Link komisi baru tersedia',
        icon: '/pwa/icons/icon-192.png',
        badge: '/pwa/icons/icon-192.png',
        tag: 'komisi-batch',
        requireInteraction: true,
        actions: [
            {
                action: 'open',
                title: 'Buka App'
            },
            {
                action: 'dismiss',
                title: 'Tutup'
            }
        ],
        data: data.data || {}
    };
    
    event.waitUntil(
        self.registration.showNotification(
            data.notification?.title || 'Komisi Mobile',
            options
        )
    );
});

// Notification click handling
self.addEventListener('notificationclick', event => {
    console.log('Notification clicked:', event);
    
    event.notification.close();
    
    if (event.action === 'dismiss') {
        return;
    }
    
    // Open or focus the PWA
    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true })
            .then(clientList => {
                // Check if PWA is already open
                for (const client of clientList) {
                    if (client.url.includes('/pwa/') && 'focus' in client) {
                        return client.focus();
                    }
                }
                
                // Open new window if not found
                if (clients.openWindow) {
                    return clients.openWindow('/pwa/');
                }
            })
    );
});

// Message handling from main thread
self.addEventListener('message', event => {
    console.log('SW received message:', event.data);
    
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
    
    if (event.data && event.data.type === 'CACHE_UPDATE') {
        updateCache();
    }
});

// Helper functions
async function processPendingDeletes() {
    try {
        // Get pending deletes from IndexedDB or localStorage
        const pendingDeletes = await getPendingDeletes();
        
        for (const deleteRequest of pendingDeletes) {
            try {
                const response = await fetch(deleteRequest.url, {
                    method: 'DELETE',
                    headers: deleteRequest.headers
                });
                
                if (response.ok) {
                    await removePendingDelete(deleteRequest.id);
                }
            } catch (error) {
                console.error('Failed to process delete:', error);
            }
        }
    } catch (error) {
        console.error('Background sync failed:', error);
    }
}

async function getPendingDeletes() {
    // Implementation would depend on your storage choice
    // For simplicity, return empty array
    return [];
}

async function removePendingDelete(id) {
    // Remove from storage after successful delete
    console.log('Removed pending delete:', id);
}

async function updateCache() {
    try {
        const cache = await caches.open(CACHE_NAME);
        
        // Update critical resources
        const criticalUrls = [
            '/pwa/',
            '/pwa/css/style.css',
            '/pwa/js/app.js'
        ];
        
        for (const url of criticalUrls) {
            try {
                const response = await fetch(url);
                if (response.ok) {
                    await cache.put(url, response);
                }
            } catch (error) {
                console.error('Failed to update cache for:', url);
            }
        }
        
        console.log('Cache updated successfully');
    } catch (error) {
        console.error('Cache update failed:', error);
    }
}

// Error handling
self.addEventListener('error', event => {
    console.error('Service Worker error:', event.error);
});

self.addEventListener('unhandledrejection', event => {
    console.error('Service Worker unhandled rejection:', event.reason);
});