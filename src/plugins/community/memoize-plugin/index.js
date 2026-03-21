export const manifest = {
  name: 'memoize-plugin',
  id: 'memoize-plugin',
  version: '1.0.0',
  description: 'Function memoization utilities',
  author: 'NEXUS',
  main: 'index.js',
  permissions: []
};

let api;
const caches = new Map();

export async function init(context) {
  api = context;
  api.log('Memoize plugin initialized');
}

export async function activate(context) {
  api.log('Memoize plugin activated');
}

export function deactivate() {
  api.log('Memoize plugin deactivated');
}

function createCache(options = {}) {
  return {
    store: new Map(),
    maxSize: options.maxSize || 1000,
    ttl: options.ttl || null,
    stats: { hits: 0, misses: 0, sets: 0, deletes: 0 }
  };
}

function getCache(name, options = {}) {
  if (!caches.has(name)) caches.set(name, createCache(options));
  return caches.get(name);
}

export const functions = {
  memoize: (fn, options = {}) => {
    const { keyGenerator, ttl, cacheName = 'default' } = options;
    const cache = getCache(cacheName, options);
    
    return (...args) => {
      const key = keyGenerator ? keyGenerator(...args) : JSON.stringify(args);
      const entry = cache.store.get(key);
      
      if (entry) {
        if (cache.ttl && Date.now() > entry.expiresAt) {
          cache.store.delete(key);
        } else {
          cache.stats.hits++;
          return entry.value;
        }
      }
      
      cache.stats.misses++;
      const value = fn(...args);
      cache.stats.sets++;
      
      cache.store.set(key, {
        value,
        createdAt: Date.now(),
        expiresAt: cache.ttl ? Date.now() + cache.ttl : null,
        args
      });
      
      if (cache.store.size > cache.maxSize) {
        const firstKey = cache.store.keys().next().value;
        cache.store.delete(firstKey);
      }
      
      return value;
    };
  },

  asyncMemoize: (fn, options = {}) => {
    const { keyGenerator, ttl, cacheName = 'default' } = options;
    const cache = getCache(cacheName, options);
    
    return async (...args) => {
      const key = keyGenerator ? keyGenerator(...args) : JSON.stringify(args);
      const entry = cache.store.get(key);
      
      if (entry) {
        if (cache.ttl && Date.now() > entry.expiresAt) {
          cache.store.delete(key);
        } else {
          cache.stats.hits++;
          return entry.value;
        }
      }
      
      cache.stats.misses++;
      const value = await fn(...args);
      cache.stats.sets++;
      
      cache.store.set(key, {
        value,
        createdAt: Date.now(),
        expiresAt: cache.ttl ? Date.now() + cache.ttl : null,
        args
      });
      
      return value;
    };
  },

  createCache: (name, options = {}) => {
    caches.set(name, createCache(options));
    return caches.get(name);
  },

  getCache: (name) => caches.get(name) || null,

  deleteCache: (name) => caches.delete(name),

  has: (name, key) => {
    const cache = caches.get(name);
    if (!cache) return false;
    const entry = cache.store.get(key);
    if (!entry) return false;
    if (cache.ttl && Date.now() > entry.expiresAt) { cache.store.delete(key); return false; }
    return true;
  },

  get: (name, key) => {
    const cache = caches.get(name);
    if (!cache) return undefined;
    const entry = cache.store.get(key);
    if (!entry) return undefined;
    if (cache.ttl && Date.now() > entry.expiresAt) { cache.store.delete(key); return undefined; }
    cache.stats.hits++;
    return entry.value;
  },

  set: (name, key, value, options = {}) => {
    const cache = caches.get(name) || functions.createCache(name, options);
    cache.store.set(key, {
      value,
      createdAt: Date.now(),
      expiresAt: options.ttl ? Date.now() + options.ttl : (cache.ttl ? Date.now() + cache.ttl : null)
    });
    cache.stats.sets++;
    return true;
  },

  delete: (name, key) => {
    const cache = caches.get(name);
    if (!cache) return false;
    cache.stats.deletes++;
    return cache.store.delete(key);
  },

  clear: (name) => {
    const cache = caches.get(name);
    if (!cache) return false;
    cache.store.clear();
    return true;
  },

  stats: (name) => {
    const cache = caches.get(name);
    if (!cache) return null;
    const { hits, misses, sets, deletes } = cache.stats;
    return {
      hits, misses, sets, deletes,
      size: cache.store.size,
      hitRate: hits + misses > 0 ? (hits / (hits + misses) * 100).toFixed(2) + '%' : '0%'
    };
  },

  cleanup: (name) => {
    const cache = caches.get(name);
    if (!cache) return 0;
    let cleaned = 0;
    const now = Date.now();
    for (const [key, entry] of cache.store) {
      if (entry.expiresAt && now > entry.expiresAt) { cache.store.delete(key); cleaned++; }
    }
    return cleaned;
  },

  keys: (name) => {
    const cache = caches.get(name);
    return cache ? Array.from(cache.store.keys()) : [];
  },

  size: (name) => {
    const cache = caches.get(name);
    return cache ? cache.store.size : 0;
  }
};

export default { manifest, init, activate, deactivate, functions };
