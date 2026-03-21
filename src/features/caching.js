import { EventEmitter } from 'events';
import crypto from 'crypto';

export class CacheEntry {
  constructor(value, ttl = null) {
    this.value = value;
    this.createdAt = Date.now();
    this.ttl = ttl;
    this.hits = 0;
    this.lastAccessedAt = Date.now();
    this.key = null;
  }

  isExpired() {
    if (this.ttl === null) return false;
    return Date.now() > this.createdAt + this.ttl;
  }

  touch() {
    this.hits++;
    this.lastAccessedAt = Date.now();
  }

  age() {
    return Date.now() - this.createdAt;
  }

  timeToLive() {
    if (this.ttl === null) return Infinity;
    return Math.max(0, this.ttl - this.age());
  }
}

export class MemoryCache {
  constructor(options = {}) {
    this.store = new Map();
    this.defaultTtl = options.defaultTtl || 3600000;
    this.maxSize = options.maxSize || 10000;
    this.stats = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0,
      evictions: 0
    };
  }

  set(key, value, ttl = this.defaultTtl) {
    const entry = new CacheEntry(value, ttl);
    entry.key = key;

    if (this.store.size >= this.maxSize && !this.store.has(key)) {
      this.evictOne();
    }

    this.store.set(key, entry);
    this.stats.sets++;
  }

  get(key) {
    const entry = this.store.get(key);

    if (!entry) {
      this.stats.misses++;
      return null;
    }

    if (entry.isExpired()) {
      this.store.delete(key);
      this.stats.misses++;
      return null;
    }

    entry.touch();
    this.stats.hits++;
    return entry.value;
  }

  has(key) {
    const entry = this.store.get(key);
    return entry && !entry.isExpired();
  }

  delete(key) {
    this.stats.deletes++;
    return this.store.delete(key);
  }

  clear() {
    this.store.clear();
  }

  evictOne() {
    let oldest = null;
    let oldestKey = null;

    for (const [key, entry] of this.store) {
      if (!oldest || entry.lastAccessedAt < oldest.lastAccessedAt) {
        oldest = entry;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.store.delete(oldestKey);
      this.stats.evictions++;
      return oldestKey;
    }

    return null;
  }

  prune() {
    let pruned = 0;

    for (const [key, entry] of this.store) {
      if (entry.isExpired()) {
        this.store.delete(key);
        pruned++;
      }
    }

    return pruned;
  }

  size() {
    return this.store.size;
  }

  keys() {
    return Array.from(this.store.keys());
  }

  getStats() {
    const total = this.stats.hits + this.stats.misses;
    return {
      ...this.stats,
      hitRate: total > 0 ? (this.stats.hits / total * 100).toFixed(2) + '%' : '0%',
      size: this.store.size,
      maxSize: this.maxSize
    };
  }
}

export class TieredCache extends EventEmitter {
  constructor(options = {}) {
    super();

    this.tiers = [];
    this.defaultTtl = options.defaultTtl || 3600000;
    this.readThrough = options.readThrough !== false;
    this.writeThrough = options.writeThrough !== false;

    this.addTier(new MemoryCache({ defaultTtl: options.memoryTtl || 300000 }));
  }

  addTier(cache, isDefault = false) {
    this.tiers.push(cache);
    if (isDefault) {
      this.defaultTtl = cache.defaultTtl;
    }
  }

  async get(key, options = {}) {
    for (let i = 0; i < this.tiers.length; i++) {
      const value = this.tiers[i].get(key);

      if (value !== null) {
        if (this.writeThrough && i < this.tiers.length - 1) {
          this.tiers[i + 1].set(key, value, this.tiers[i + 1].defaultTtl);
        }
        return value;
      }
    }

    if (this.readThrough && options.loader) {
      const value = await options.loader(key);
      if (value !== undefined) {
        this.set(key, value, options.ttl);
      }
      return value;
    }

    return null;
  }

  set(key, value, ttl = this.defaultTtl) {
    for (const tier of this.tiers) {
      tier.set(key, value, ttl);
    }

    this.emit('set', { key, ttl });
  }

  delete(key) {
    let deleted = false;

    for (const tier of this.tiers) {
      if (tier.delete(key)) {
        deleted = true;
      }
    }

    if (deleted) {
      this.emit('delete', { key });
    }

    return deleted;
  }

  clear() {
    for (const tier of this.tiers) {
      tier.clear();
    }
    this.emit('clear');
  }

  prune() {
    let pruned = 0;
    for (const tier of this.tiers) {
      pruned += tier.prune();
    }
    return pruned;
  }

  getStats() {
    return {
      tiers: this.tiers.length,
      tierStats: this.tiers.map(tier => tier.getStats())
    };
  }
}

export class CacheWithRefresh extends EventEmitter {
  constructor(cache, options = {}) {
    this.cache = cache;
    this.refreshInterval = options.refreshInterval || 60000;
    this.staleWhileRevalidate = options.staleWhileRevalidate !== false;
    this.refreshTimers = new Map();

    this.startAutoRefresh();
  }

  async get(key, options = {}) {
    const value = this.cache.get(key);

    if (value !== null) {
      return value;
    }

    if (options.loader) {
      return options.loader(key);
    }

    return null;
  }

  set(key, value, ttl) {
    this.cache.set(key, value, ttl);
  }

  scheduleRefresh(key, loader, interval = this.refreshInterval) {
    if (this.refreshTimers.has(key)) {
      clearInterval(this.refreshTimers.get(key));
    }

    const timer = setInterval(async () => {
      try {
        await loader(key);
      } catch (error) {
        this.emit('refresh:error', { key, error: error.message });
      }
    }, interval);

    this.refreshTimers.set(key, timer);
  }

  cancelRefresh(key) {
    if (this.refreshTimers.has(key)) {
      clearInterval(this.refreshTimers.get(key));
      this.refreshTimers.delete(key);
    }
  }

  cancelAllRefresh() {
    for (const timer of this.refreshTimers.values()) {
      clearInterval(timer);
    }
    this.refreshTimers.clear();
  }

  startAutoRefresh() {
    this.pruneInterval = setInterval(() => {
      this.cache.prune();
    }, this.refreshInterval);
  }

  stopAutoRefresh() {
    if (this.pruneInterval) {
      clearInterval(this.pruneInterval);
      this.pruneInterval = null;
    }
  }

  getCache() {
    return this.cache;
  }
}

let memoryCache = null;
let tieredCache = null;

export function getMemoryCache(options = {}) {
  if (!memoryCache) {
    memoryCache = new MemoryCache(options);
  }
  return memoryCache;
}

export function getTieredCache(options = {}) {
  if (!tieredCache) {
    tieredCache = new TieredCache(options);
  }
  return tieredCache;
}

export default { MemoryCache, TieredCache, CacheWithRefresh, CacheEntry, getMemoryCache, getTieredCache };
