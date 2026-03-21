#!/usr/bin/env node

import { EventEmitter } from 'events';
import crypto from 'crypto';

// ═══════════════════════════════════════════════════════════════════════════
// ADVANCED CACHE SYSTEM
// Multi-tier caching, Redis support, TTL, eviction policies, warming
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Eviction policies
 */
export const EvictionPolicy = {
  LRU: 'lru',     // Least Recently Used
  LFU: 'lfu',     // Least Frequently Used
  FIFO: 'fifo',   // First In First Out
  TTL: 'ttl',     // Time To Live
  RANDOM: 'random' // Random eviction
};

/**
 * Cache entry
 */
class CacheEntry {
  constructor(key, value, options = {}) {
    this.key = key;
    this.value = value;
    this.ttl = options.ttl || null; // null = no expiry
    this.tags = options.tags || [];
    this.metadata = options.metadata || {};
    this.size = this._calculateSize(value);

    // Timestamps
    this.createdAt = Date.now();
    this.lastAccessed = Date.now();
    this.accessCount = 0;

    // For LFU
    this.frequency = 0;
  }

  /**
   * Calculate approximate size
   */
  _calculateSize(value) {
    if (typeof value === 'string') {
      return Buffer.byteLength(value, 'utf8');
    }
    if (Buffer.isBuffer(value)) {
      return value.length;
    }
    return JSON.stringify(value).length;
  }

  /**
   * Check if entry is expired
   */
  isExpired() {
    if (!this.ttl) return false;
    return Date.now() > this.createdAt + this.ttl;
  }

  /**
   * Access the entry
   */
  access() {
    this.lastAccessed = Date.now();
    this.accessCount++;
    this.frequency++;
    return this.value;
  }

  /**
   * Get age in ms
   */
  getAge() {
    return Date.now() - this.createdAt;
  }

  /**
   * Get time since last access
   */
  getIdleTime() {
    return Date.now() - this.lastAccessed;
  }
}

/**
 * Memory Cache Store
 */
export class MemoryCacheStore {
  constructor(options = {}) {
    this.maxSize = options.maxSize || 100 * 1024 * 1024; // 100MB
    this.maxItems = options.maxItems || 10000;
    this.evictionPolicy = options.evictionPolicy || EvictionPolicy.LRU;

    this.entries = new Map();
    this.tagIndex = new Map(); // tag -> Set<key>
    this.currentSize = 0;

    // Stats
    this.stats = {
      hits: 0,
      misses: 0,
      evictions: 0,
      sets: 0,
      deletes: 0
    };

    // Cleanup interval
    this.cleanupInterval = setInterval(() => this.cleanup(), 60000);
  }

  /**
   * Get value by key
   */
  get(key) {
    const entry = this.entries.get(key);

    if (!entry) {
      this.stats.misses++;
      return null;
    }

    if (entry.isExpired()) {
      this.delete(key);
      this.stats.misses++;
      return null;
    }

    entry.access();
    this.stats.hits++;

    return entry.value;
  }

  /**
   * Set value
   */
  set(key, value, options = {}) {
    // Check if key exists
    const existing = this.entries.get(key);
    if (existing) {
      this.currentSize -= existing.size;
    }

    const entry = new CacheEntry(key, value, options);

    // Check if we need to evict
    while (
      (this.currentSize + entry.size > this.maxSize) ||
      (this.entries.size >= this.maxItems)
    ) {
      this._evict();
    }

    // Add entry
    this.entries.set(key, entry);
    this.currentSize += entry.size;
    this.stats.sets++;

    // Update tag index
    for (const tag of entry.tags) {
      if (!this.tagIndex.has(tag)) {
        this.tagIndex.set(tag, new Set());
      }
      this.tagIndex.get(tag).add(key);
    }

    return true;
  }

  /**
   * Delete value
   */
  delete(key) {
    const entry = this.entries.get(key);
    if (entry) {
      this.currentSize -= entry.size;
      this.entries.delete(key);

      // Remove from tag index
      for (const tag of entry.tags) {
        this.tagIndex.get(tag)?.delete(key);
      }

      this.stats.deletes++;
      return true;
    }
    return false;
  }

  /**
   * Check if key exists
   */
  has(key) {
    const entry = this.entries.get(key);
    if (!entry) return false;
    if (entry.isExpired()) {
      this.delete(key);
      return false;
    }
    return true;
  }

  /**
   * Clear all
   */
  clear() {
    this.entries.clear();
    this.tagIndex.clear();
    this.currentSize = 0;
  }

  /**
   * Clear by tag
   */
  clearByTag(tag) {
    const keys = this.tagIndex.get(tag);
    if (keys) {
      for (const key of keys) {
        this.delete(key);
      }
    }
  }

  /**
   * Get all keys
   */
  keys() {
    return Array.from(this.entries.keys()).filter(key => {
      const entry = this.entries.get(key);
      return entry && !entry.isExpired();
    });
  }

  /**
   * Get stats
   */
  getStats() {
    const hitRate = this.stats.hits + this.stats.misses > 0
      ? (this.stats.hits / (this.stats.hits + this.stats.misses) * 100).toFixed(2)
      : 0;

    return {
      ...this.stats,
      size: this.currentSize,
      maxSize: this.maxSize,
      items: this.entries.size,
      maxItems: this.maxItems,
      hitRate: `${hitRate}%`
    };
  }

  /**
   * Evict based on policy
   */
  _evict() {
    if (this.entries.size === 0) return;

    let keyToEvict = null;

    switch (this.evictionPolicy) {
      case EvictionPolicy.LRU:
        let oldestAccess = Infinity;
        for (const [key, entry] of this.entries) {
          if (entry.lastAccessed < oldestAccess) {
            oldestAccess = entry.lastAccessed;
            keyToEvict = key;
          }
        }
        break;

      case EvictionPolicy.LFU:
        let lowestFrequency = Infinity;
        for (const [key, entry] of this.entries) {
          if (entry.frequency < lowestFrequency) {
            lowestFrequency = entry.frequency;
            keyToEvict = key;
          }
        }
        break;

      case EvictionPolicy.FIFO:
        let oldestCreation = Infinity;
        for (const [key, entry] of this.entries) {
          if (entry.createdAt < oldestCreation) {
            oldestCreation = entry.createdAt;
            keyToEvict = key;
          }
        }
        break;

      case EvictionPolicy.RANDOM:
        const keys = Array.from(this.entries.keys());
        keyToEvict = keys[Math.floor(Math.random() * keys.length)];
        break;
    }

    if (keyToEvict) {
      this.delete(keyToEvict);
      this.stats.evictions++;
    }
  }

  /**
   * Cleanup expired entries
   */
  cleanup() {
    const expiredKeys = [];

    for (const [key, entry] of this.entries) {
      if (entry.isExpired()) {
        expiredKeys.push(key);
      }
    }

    for (const key of expiredKeys) {
      this.delete(key);
    }

    return expiredKeys.length;
  }

  /**
   * Get entries by tag
   */
  getByTag(tag) {
    const keys = this.tagIndex.get(tag);
    if (!keys) return [];

    const results = [];
    for (const key of keys) {
      const entry = this.entries.get(key);
      if (entry && !entry.isExpired()) {
        results.push({ key, value: entry.value });
      }
    }

    return results;
  }

  /**
   * Batch get multiple keys
   */
  mget(keys) {
    const results = {};
    for (const key of keys) {
      const value = this.get(key);
      if (value !== null) results[key] = value;
    }
    return results;
  }

  /**
   * Batch set multiple key-value pairs
   */
  mset(entries, options = {}) {
    for (const { key, value, ttl } of entries) {
      this.set(key, value, { ttl: ttl || options.ttl });
    }
  }

  /**
   * Check if key exists and is not expired
   */
  has(key) {
    const entry = this.entries.get(key);
    if (!entry) return false;
    if (entry.isExpired()) { this.delete(key); return false; }
    return true;
  }

  /**
   * Get all keys (optionally filtered by pattern)
   */
  keys(pattern = null) {
    const allKeys = [];
    for (const [key, entry] of this.entries) {
      if (!entry.isExpired()) {
        if (!pattern || key.includes(pattern)) allKeys.push(key);
      }
    }
    return allKeys;
  }

  /**
   * Invalidate all entries matching a pattern
   */
  invalidatePattern(pattern) {
    let count = 0;
    const regex = new RegExp(pattern.replace(/\*/g, '.*'));
    for (const key of this.entries.keys()) {
      if (regex.test(key)) { this.delete(key); count++; }
    }
    return count;
  }

  /**
   * Get cache size in items and bytes
   */
  size() {
    return { items: this.entries.size, bytes: this.currentSize };
  }

  /**
   * Get top N most accessed entries
   */
  topEntries(n = 10) {
    return Array.from(this.entries.entries())
      .filter(([, e]) => !e.isExpired())
      .sort((a, b) => b[1].frequency - a[1].frequency)
      .slice(0, n)
      .map(([key, entry]) => ({ key, hits: entry.frequency, lastAccessed: entry.lastAccessed }));
  }

  /**
   * Reset all stats
   */
  resetStats() {
    this.stats = { hits: 0, misses: 0, evictions: 0, sets: 0, deletes: 0 };
  }
}

/**
 * Redis Cache Store (optional)
 */
export class RedisCacheStore {
  constructor(options = {}) {
    this.host = options.host || 'localhost';
    this.port = options.port || 6379;
    this.password = options.password || null;
    this.prefix = options.prefix || 'nexus:';

    // Note: This is a placeholder - real implementation would use ioredis or redis
    this.connected = false;
    this.memoryFallback = new MemoryCacheStore(options);
  }

  /**
   * Connect to Redis
   */
  async connect() {
    // Placeholder - would connect to actual Redis
    // try {
    //   this.client = new Redis({ host: this.host, port: this.port, password: this.password });
    //   this.connected = true;
    // } catch (error) {
    //   this.connected = false;
    // }
    console.warn('Redis not available, using memory fallback');
    return false;
  }

  /**
   * Get value
   */
  async get(key) {
    if (!this.connected) {
      return this.memoryFallback.get(key);
    }
    // Redis implementation would go here
    return null;
  }

  /**
   * Set value
   */
  async set(key, value, options = {}) {
    if (!this.connected) {
      return this.memoryFallback.set(key, value, options);
    }
    // Redis implementation would go here
    return false;
  }

  /**
   * Delete value
   */
  async delete(key) {
    if (!this.connected) {
      return this.memoryFallback.delete(key);
    }
    // Redis implementation would go here
    return false;
  }

  /**
   * Get stats
   */
  getStats() {
    return {
      connected: this.connected,
      backend: this.connected ? 'redis' : 'memory',
      ...this.memoryFallback.getStats()
    };
  }
}

/**
 * Tiered Cache (L1 Memory + L2 Redis)
 */
export class TieredCache extends EventEmitter {
  constructor(options = {}) {
    super();

    // L1: In-memory cache (fast)
    this.l1 = new MemoryCacheStore({
      maxSize: options.l1Size || 50 * 1024 * 1024, // 50MB
      maxItems: options.l1Items || 5000,
      evictionPolicy: options.evictionPolicy || EvictionPolicy.LRU
    });

    // L2: Redis or fallback
    this.l2 = options.redis ? new RedisCacheStore(options.redis) : null;

    // Stats
    this.stats = {
      l1Hits: 0,
      l2Hits: 0,
      misses: 0
    };

    // Warming
    this.warmingFunctions = new Map();
  }

  /**
   * Initialize
   */
  async initialize() {
    if (this.l2) {
      await this.l2.connect();
    }
  }

  /**
   * Get value
   */
  async get(key) {
    // Try L1
    let value = this.l1.get(key);
    if (value !== null) {
      this.stats.l1Hits++;
      return value;
    }

    // Try L2
    if (this.l2) {
      value = await this.l2.get(key);
      if (value !== null) {
        // Promote to L1
        this.l1.set(key, value);
        this.stats.l2Hits++;
        return value;
      }
    }

    this.stats.misses++;
    return null;
  }

  /**
   * Set value
   */
  async set(key, value, options = {}) {
    // Set in L1
    this.l1.set(key, value, options);

    // Set in L2 if available
    if (this.l2) {
      await this.l2.set(key, value, options);
    }

    return true;
  }

  /**
   * Delete value
   */
  async delete(key) {
    this.l1.delete(key);
    if (this.l2) {
      await this.l2.delete(key);
    }
    return true;
  }

  /**
   * Batch get multiple keys
   */
  async mget(keys) {
    const results = {};
    const l2Misses = [];

    // Try L1 first
    for (const key of keys) {
      const value = this.l1.get(key);
      if (value !== null) {
        results[key] = value;
        this.stats.l1Hits++;
      } else {
        l2Misses.push(key);
      }
    }

    // Try L2 for misses
    if (this.l2 && l2Misses.length > 0) {
      for (const key of l2Misses) {
        const value = await this.l2.get(key);
        if (value !== null) {
          results[key] = value;
          this.l1.set(key, value);
          this.stats.l2Hits++;
        } else {
          this.stats.misses++;
        }
      }
    } else {
      this.stats.misses += l2Misses.length;
    }

    return results;
  }

  /**
   * Batch set multiple entries
   */
  async mset(entries, options = {}) {
    for (const { key, value, ttl } of entries) {
      await this.set(key, value, { ttl: ttl || options.ttl });
    }
  }

  /**
   * Check if key exists
   */
  async has(key) {
    if (this.l1.has(key)) return true;
    if (this.l2) {
      const value = await this.l2.get(key);
      if (value !== null) {
        this.l1.set(key, value);
        return true;
      }
    }
    return false;
  }

  /**
   * Invalidate all entries matching a pattern
   */
  invalidatePattern(pattern) {
    return this.l1.invalidatePattern(pattern);
  }

  /**
   * Get all keys from L1
   */
  keys(pattern = null) {
    return this.l1.keys(pattern);
  }

  /**
   * Get or compute
   */
  async getOrCompute(key, computeFn, options = {}) {
    // Try cache first
    const cached = await this.get(key);
    if (cached !== null) {
      return cached;
    }

    // Compute value
    const value = await computeFn();

    // Store in cache
    await this.set(key, value, options);

    return value;
  }

  /**
   * Register warming function
   */
  registerWarming(key, fn, options = {}) {
    this.warmingFunctions.set(key, { fn, interval: options.interval || 300000 });
  }

  /**
   * Warm cache
   */
  async warm(key) {
    const warming = this.warmingFunctions.get(key);
    if (!warming) return;

    try {
      const value = await warming.fn();
      await this.set(key, value);
      this.emit('cache:warmed', { key });
    } catch (error) {
      this.emit('cache:warm:error', { key, error: error.message });
    }
  }

  /**
   * Warm all registered caches
   */
  async warmAll() {
    for (const [key] of this.warmingFunctions) {
      await this.warm(key);
    }
  }

  /**
   * Clear all
   */
  async clear() {
    this.l1.clear();
    if (this.l2) {
      // Would clear Redis
    }
  }

  /**
   * Get stats
   */
  getStats() {
    const totalHits = this.stats.l1Hits + this.stats.l2Hits;
    const totalRequests = totalHits + this.stats.misses;

    return {
      l1: this.l1.getStats(),
      l2: this.l2?.getStats() || null,
      hits: {
        l1: this.stats.l1Hits,
        l2: this.stats.l2Hits,
        total: totalHits
      },
      misses: this.stats.misses,
      totalRequests,
      hitRate: totalRequests > 0 ? (totalHits / totalRequests * 100).toFixed(2) + '%' : '0%',
      warmingFunctions: this.warmingFunctions.size
    };
  }
}

/**
 * Cache Manager
 */
export class CacheManager extends EventEmitter {
  constructor() {
    super();

    this.caches = new Map();
    this.defaultCache = this.createCache('default');
  }

  /**
   * Create a named cache
   */
  createCache(name, options = {}) {
    const cache = new TieredCache(options);
    this.caches.set(name, cache);

    cache.on('cache:warmed', (data) => this.emit('cache:warmed', { ...data, cache: name }));
    cache.on('cache:warm:error', (data) => this.emit('cache:warm:error', { ...data, cache: name }));

    return cache;
  }

  /**
   * Get cache by name
   */
  getCache(name) {
    return this.caches.get(name) || this.defaultCache;
  }

  /**
   * Get from default cache
   */
  async get(key) {
    return this.defaultCache.get(key);
  }

  /**
   * Set in default cache
   */
  async set(key, value, options) {
    return this.defaultCache.set(key, value, options);
  }

  /**
   * Delete from default cache
   */
  async delete(key) {
    return this.defaultCache.delete(key);
  }

  /**
   * Get or compute
   */
  async getOrCompute(key, computeFn, options) {
    return this.defaultCache.getOrCompute(key, computeFn, options);
  }

  /**
   * Get all stats
   */
  getAllStats() {
    const stats = {};

    for (const [name, cache] of this.caches) {
      stats[name] = cache.getStats();
    }

    return stats;
  }

  /**
   * Clear all caches
   */
  async clearAll() {
    for (const cache of this.caches.values()) {
      await cache.clear();
    }
  }
}

// Export singleton
let manager = null;

export function getCacheManager() {
  if (!manager) {
    manager = new CacheManager();
  }
  return manager;
}

export default {
  CacheManager,
  TieredCache,
  MemoryCacheStore,
  RedisCacheStore,
  CacheEntry,
  EvictionPolicy,
  getCacheManager
};