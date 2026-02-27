/* Finances PWA Service Worker
 * EstratÃƒÂ©gia:
 * - NavegaÃƒÂ§ÃƒÂ£o/HTML: Network First (com fallback offline)
 * - Assets estÃƒÂ¡ticos same-origin: Cache First
 * - CSS/fonts de CDN (Google/CDNJS): Stale-While-Revalidate
 * - API/sensÃƒÂ­vel: sem cache
 */

const SW_VERSION = 'finances-pwa-v2026-02-27-48';
const CACHE_STATIC = `${SW_VERSION}-static`;
const CACHE_PAGES = `${SW_VERSION}-pages`;
const CACHE_CDN = `${SW_VERSION}-cdn`;
const OFFLINE_URL = '/offline.html';

const CORE_ASSETS = [
  '/',
  '/index.html',
  '/login.html',
  '/menu.html',
  '/dev-tools.html',
  '/comercio.html',
  '/economias.html',
  '/despesas.html',
  '/resumo-ano.html',
  '/resumo-economias.html',
  '/offline.html',
  '/manifest.webmanifest',
  '/style.css',
  '/common.js',
  '/i18n.js',
  '/i18n-extra.js',
  '/auth.js',
  '/pwa-register.js',
  '/script.js',
  '/login.js',
  '/menu.js',
  '/dev-tools.js',
  '/comercio.js',
  '/despesas.js',
  '/escanear-despesa.js',
  '/vendor/zxing.min.js',
  '/vendor/jsqr.js',
  '/resumo-ano.js',
  '/resumo-economias.js',
  '/logo2.png',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/icon-512-maskable.png',
  '/icons/apple-touch-icon.png',
  '/icons/favicon-32.png',
  '/icons/favicon-16.png'
];

const SAME_ORIGIN_DYNAMIC_ASSET_RE = /\.(?:js|css)$/i;
const SAME_ORIGIN_CACHEFIRST_ASSET_RE = /\.(?:png|jpg|jpeg|webp|svg|ico|woff2?|ttf)$/i;
const CDN_HOSTS = new Set([
  'fonts.googleapis.com',
  'fonts.gstatic.com',
  'cdnjs.cloudflare.com',
  'cdn.jsdelivr.net'
]);

const CDN_WARMUP_ASSETS = [
  'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js',
  'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/worker.min.js',
  'https://cdn.jsdelivr.net/npm/@zxing/library@0.21.3/umd/index.min.js',
  'https://unpkg.com/@zxing/library@0.21.3/umd/index.min.js',
  'https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.js',
  'https://unpkg.com/jsqr@1.4.0/dist/jsQR.js'
];

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_STATIC);
    await cache.addAll(CORE_ASSETS);

    // Warm-up opcional do Tesseract (worker/script) para melhorar uso offline após 1º uso.
    const cdnCache = await caches.open(CACHE_CDN);
    await Promise.allSettled(CDN_WARMUP_ASSETS.map(async (url) => {
      try {
        const resp = await fetch(url, { cache: 'no-cache', mode: 'cors' });
        if (resp && (resp.ok || resp.type === 'opaque')) {
          await cdnCache.put(url, resp.clone());
        }
      } catch (_) {
        // Não bloqueia instalação do SW se CDN falhar.
      }
    }));
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    const previousStaticCacheName = getPreviousStaticCacheName(names);
    const previousVersion = previousStaticCacheName
      ? previousStaticCacheName.replace(/-static$/i, '')
      : '';
    const changedAssets = await diffStaticCaches(previousStaticCacheName, CACHE_STATIC);

    await Promise.all(
      names
        .filter(name => name.startsWith('finances-pwa-') && ![
          CACHE_STATIC,
          CACHE_PAGES,
          CACHE_CDN
        ].includes(name))
        .map(name => caches.delete(name))
    );

    await self.clients.claim();

    const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of clients) {
      client.postMessage({
        type: 'SW_ACTIVATED',
        version: SW_VERSION,
        previousVersion,
        changedAssets
      });
    }
  })());
});

self.addEventListener('message', event => {
  const data = event.data || {};
  if (data && data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('notificationclick', event => {
  const notification = event.notification || null;
  const data = (notification && notification.data && typeof notification.data === 'object')
    ? notification.data
    : {};
  const action = String(event.action || '').trim();
  const primaryUrl = String(data.url || '').trim();
  const fallbackAppUrl = String(data.appUrl || '/index.html').trim() || '/index.html';

  if (notification) {
    try { notification.close(); } catch (_) {}
  }

  event.waitUntil((async () => {
    const allClients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });

    if (action && action !== 'send-reminder' && allClients.length) {
      const appClient = allClients.find(client => String(client.url || '').includes(self.location.origin))
        || allClients[0];
      if (appClient && typeof appClient.focus === 'function') {
        try {
          await appClient.focus();
          return;
        } catch (_) {}
      }
    }

    const targetUrl = primaryUrl || fallbackAppUrl;
    if (!targetUrl) return;

    if (allClients.length && targetUrl.startsWith(self.location.origin)) {
      const targetClient = allClients.find(client => String(client.url || '').split('#')[0] === targetUrl.split('#')[0]);
      if (targetClient && typeof targetClient.focus === 'function') {
        try {
          await targetClient.focus();
          return;
        } catch (_) {}
      }
    }

    try {
      await self.clients.openWindow(targetUrl);
    } catch (_) {
      if (fallbackAppUrl && fallbackAppUrl !== targetUrl) {
        try { await self.clients.openWindow(fallbackAppUrl); } catch (_) {}
      }
    }
  })());
});

self.addEventListener('fetch', event => {
  const { request } = event;
  if (!request || request.method !== 'GET') return;
  if (request.headers.has('authorization')) return;

  const url = new URL(request.url);
  if (!/^https?:$/i.test(url.protocol)) return;

  if (url.origin === self.location.origin) {
    if (url.pathname.startsWith('/api/')) return;
    if (url.pathname === '/mercado_pago_webhooks.json') return;
  }

  const cacheControl = request.headers.get('cache-control') || '';
  if (/no-store/i.test(cacheControl)) return;

  if (request.mode === 'navigate') {
    event.respondWith(handleNavigationRequest(request));
    return;
  }

  if (url.origin === self.location.origin && SAME_ORIGIN_DYNAMIC_ASSET_RE.test(url.pathname)) {
    event.respondWith(staleWhileRevalidate(request, CACHE_STATIC, event));
    return;
  }

  if (url.origin === self.location.origin && SAME_ORIGIN_CACHEFIRST_ASSET_RE.test(url.pathname)) {
    event.respondWith(cacheFirst(request, CACHE_STATIC));
    return;
  }

  if (CDN_HOSTS.has(url.hostname)) {
    event.respondWith(staleWhileRevalidate(request, CACHE_CDN, event));
  }
});

async function handleNavigationRequest(request) {
  const cache = await caches.open(CACHE_PAGES);

  try {
    const response = await fetch(request);
    if (isCacheableHtmlResponse(response)) {
      cache.put(normalizeNavigationCacheKey(request), response.clone()).catch(() => {});
    }
    return response;
  } catch (_) {
    const cached =
      (await cache.match(normalizeNavigationCacheKey(request))) ||
      (await caches.match(normalizeNavigationFallbackPath(request))) ||
      (await caches.match(OFFLINE_URL));

    if (cached) return cached;
    return new Response('Offline', {
      status: 503,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' }
    });
  }
}

function normalizeNavigationCacheKey(request) {
  const url = new URL(request.url);
  url.hash = '';
  url.search = '';
  return new Request(url.pathname || '/', {
    method: 'GET',
    headers: { Accept: 'text/html' }
  });
}

function normalizeNavigationFallbackPath(request) {
  const url = new URL(request.url);
  url.hash = '';
  url.search = '';
  return url.pathname || '/';
}

function isCacheableHtmlResponse(response) {
  if (!response || !response.ok) return false;
  const contentType = response.headers.get('content-type') || '';
  return contentType.includes('text/html');
}

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;

  const response = await fetch(request);
  if (isCacheableAssetResponse(response)) {
    cache.put(request, response.clone()).catch(() => {});
  }
  return response;
}

async function staleWhileRevalidate(request, cacheName, fetchEvent) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);

  const fetchPromise = fetch(request)
    .then(response => {
      if (isCacheableAssetResponse(response, true)) {
        cache.put(request, response.clone()).catch(() => {});
      }
      return response;
    })
    .catch(() => null);

  if (cached) {
    if (fetchEvent && typeof fetchEvent.waitUntil === 'function') {
      fetchEvent.waitUntil(fetchPromise.catch(() => {}));
    } else {
      eventSafe(fetchPromise);
    }
    return cached;
  }

  const fresh = await fetchPromise;
  if (fresh) return fresh;

  return new Response('', { status: 504, statusText: 'Gateway Timeout' });
}

function isCacheableAssetResponse(response, allowOpaque = false) {
  if (!response) return false;
  if (response.ok) return true;
  return allowOpaque && response.type === 'opaque';
}

function eventSafe(promise) {
  promise.catch(() => {});
}

function isStaticCacheName(name) {
  return typeof name === 'string' && /^finances-pwa-v.+-static$/i.test(name);
}

function parseStaticCacheSortKey(name) {
  const m = String(name || '').match(/^finances-pwa-v(\d{4})-(\d{2})-(\d{2})-(\d+)-static$/i);
  if (!m) return null;
  return [
    Number(m[1]) || 0,
    Number(m[2]) || 0,
    Number(m[3]) || 0,
    Number(m[4]) || 0
  ];
}

function compareStaticCacheNamesDesc(a, b) {
  const ka = parseStaticCacheSortKey(a);
  const kb = parseStaticCacheSortKey(b);
  if (!ka && !kb) return String(b || '').localeCompare(String(a || ''));
  if (!ka) return 1;
  if (!kb) return -1;
  for (let i = 0; i < ka.length; i += 1) {
    if (ka[i] === kb[i]) continue;
    return kb[i] - ka[i];
  }
  return 0;
}

function getPreviousStaticCacheName(cacheNames) {
  const list = Array.isArray(cacheNames) ? cacheNames : [];
  const candidates = list.filter(name => isStaticCacheName(name) && name !== CACHE_STATIC);
  if (!candidates.length) return '';
  candidates.sort(compareStaticCacheNamesDesc);
  return candidates[0] || '';
}

async function diffStaticCaches(previousCacheName, currentCacheName) {
  if (!currentCacheName) return [];
  if (!previousCacheName || previousCacheName === currentCacheName) return [];

  try {
    const prevCache = await caches.open(previousCacheName);
    const curCache = await caches.open(currentCacheName);
    const changed = [];

    for (const assetPath of CORE_ASSETS) {
      const prevResp = await prevCache.match(assetPath);
      const curResp = await curCache.match(assetPath);
      const isChanged = await responsesDiffer(prevResp, curResp);
      if (isChanged) changed.push(assetPath);
    }

    return changed;
  } catch (_) {
    return [];
  }
}

async function responsesDiffer(prevResp, curResp) {
  if (!prevResp && !curResp) return false;
  if (!prevResp || !curResp) return true;

  if (prevResp.status !== curResp.status) return true;
  if ((prevResp.type || '') !== (curResp.type || '')) return true;

  const ctPrev = String(prevResp.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
  const ctCur = String(curResp.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
  if (ctPrev !== ctCur) return true;

  if (prevResp.type === 'opaque' || curResp.type === 'opaque') return false;

  const [sigPrev, sigCur] = await Promise.all([
    responseSignature(prevResp),
    responseSignature(curResp)
  ]);
  return sigPrev !== sigCur;
}

async function responseSignature(resp) {
  try {
    const clone = resp.clone();
    const buf = await clone.arrayBuffer();
    const hash = await sha256Hex(buf);
    const ct = String(resp.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
    return `${resp.status}|${resp.type || ''}|${ct}|${buf.byteLength}|${hash}`;
  } catch (_) {
    return `${resp.status}|${resp.type || ''}|fallback`;
  }
}

async function sha256Hex(buffer) {
  if (self.crypto && self.crypto.subtle && typeof self.crypto.subtle.digest === 'function') {
    const digest = await self.crypto.subtle.digest('SHA-256', buffer);
    return bytesToHex(new Uint8Array(digest));
  }
  return fnv1aHex(new Uint8Array(buffer));
}

function bytesToHex(bytes) {
  let out = '';
  for (let i = 0; i < bytes.length; i += 1) {
    out += bytes[i].toString(16).padStart(2, '0');
  }
  return out;
}

function fnv1aHex(bytes) {
  let hash = 0x811c9dc5;
  for (let i = 0; i < bytes.length; i += 1) {
    hash ^= bytes[i];
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}


