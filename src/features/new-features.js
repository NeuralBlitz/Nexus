import { EventEmitter } from 'events';

// ═══════════════════════════════════════════════════════════════════════════
// NEW FEATURES MODULE
// rate-limiter-v2, retry-handler, memoize, pipeline, feature-flags-v2
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Advanced Rate Limiter with sliding window log
 */
export class RateLimiterV2 extends EventEmitter {
  constructor(options = {}) {
    super();
    this.windowMs = options.windowMs || 60000;
    this.maxRequests = options.maxRequests || 100;
    this.keyPrefix = options.keyPrefix || 'rl:';
    this.store = new Map();
    this.blockedKeys = new Map();
  }

  check(key, weight = 1) {
    const now = Date.now();
    const storeKey = this.keyPrefix + key;

    // Check if blocked
    const blocked = this.blockedKeys.get(storeKey);
    if (blocked && blocked > now) {
      return { allowed: false, remaining: 0, retryAfter: blocked - now, blocked: true };
    }
    if (blocked) this.blockedKeys.delete(storeKey);

    let entry = this.store.get(storeKey);
    if (!entry) {
      entry = { requests: [], counter: 0 };
      this.store.set(storeKey, entry);
    }

    // Sliding window: remove expired
    const windowStart = now - this.windowMs;
    entry.requests = entry.requests.filter(t => t > windowStart);

    const currentCount = entry.requests.reduce((sum, _, i) => sum + (entry.weights?.[i] || 1), 0);

    if (currentCount + weight > this.maxRequests) {
      const retryAfter = entry.requests[0] + this.windowMs - now;
      return { allowed: false, remaining: 0, retryAfter: Math.max(0, retryAfter) };
    }

    entry.requests.push(now);
    if (!entry.weights) entry.weights = [];
    entry.weights.push(weight);

    return {
      allowed: true,
      remaining: this.maxRequests - currentCount - weight,
      retryAfter: 0,
      resetAt: new Date(now + this.windowMs).toISOString()
    };
  }

  block(key, durationMs) {
    this.blockedKeys.set(this.keyPrefix + key, Date.now() + durationMs);
  }

  reset(key) {
    const storeKey = this.keyPrefix + key;
    this.store.delete(storeKey);
    this.blockedKeys.delete(storeKey);
  }

  getStats() {
    let totalRequests = 0;
    let activeKeys = 0;
    for (const entry of this.store.values()) {
      if (entry.requests.length > 0) activeKeys++;
      totalRequests += entry.requests.length;
    }
    return {
      windowMs: this.windowMs,
      maxRequests: this.maxRequests,
      activeKeys,
      totalRequests,
      blockedKeys: this.blockedKeys.size
    };
  }
}

/**
 * Retry Handler with exponential backoff and jitter
 */
export class RetryHandler extends EventEmitter {
  constructor(options = {}) {
    super();
    this.maxRetries = options.maxRetries || 3;
    this.baseDelay = options.baseDelay || 1000;
    this.maxDelay = options.maxDelay || 30000;
    this.backoffMultiplier = options.backoffMultiplier || 2;
    this.jitter = options.jitter !== false;
    this.retryOn = options.retryOn || ['ECONNRESET', 'ETIMEDOUT', 'timeout'];
  }

  async execute(fn, context = {}) {
    let lastError;
    const attempts = context.maxRetries || this.maxRetries;

    for (let attempt = 1; attempt <= attempts; attempt++) {
      try {
        const result = await fn(attempt);
        if (attempt > 1) this.emit('retry:success', { attempt, context });
        return result;
      } catch (error) {
        lastError = error;
        this.emit('retry:attempt', { attempt, error: error.message, context });

        if (attempt === attempts) break;
        if (!this._isRetryable(error)) throw error;

        const delay = this._calculateDelay(attempt);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    this.emit('retry:exhausted', { attempts, error: lastError.message, context });
    throw lastError;
  }

  _isRetryable(error) {
    const msg = error.message || '';
    return this.retryOn.some(pattern =>
      typeof pattern === 'string' ? msg.includes(pattern) :
      pattern instanceof RegExp ? pattern.test(msg) :
      typeof pattern === 'function' ? pattern(error) : false
    );
  }

  _calculateDelay(attempt) {
    let delay = Math.min(this.baseDelay * Math.pow(this.backoffMultiplier, attempt - 1), this.maxDelay);
    if (this.jitter) delay = delay * (0.5 + Math.random() * 0.5);
    return Math.floor(delay);
  }

  getStats() {
    return {
      maxRetries: this.maxRetries,
      baseDelay: this.baseDelay,
      maxDelay: this.maxDelay,
      jitter: this.jitter
    };
  }
}

/**
 * Memoization cache with TTL and size limits
 */
export class Memoizer extends EventEmitter {
  constructor(options = {}) {
    super();
    this.maxSize = options.maxSize || 1000;
    this.defaultTtl = options.defaultTtl || 300000;
    this.cache = new Map();
    this.stats = { hits: 0, misses: 0, evictions: 0 };
  }

  memoize(fn, options = {}) {
    const ttl = options.ttl || this.defaultTtl;
    const keyFn = options.keyFn || ((...args) => JSON.stringify(args));
    const self = this;

    const memoized = async function (...args) {
      const key = keyFn(...args);
      return self.getOrCompute(key, () => fn(...args), { ttl });
    };

    memoized.clear = () => self.clear();
    memoized.stats = () => self.stats;
    return memoized;
  }

  async getOrCompute(key, computeFn, options = {}) {
    const ttl = options.ttl || this.defaultTtl;
    const entry = this.cache.get(key);

    if (entry && entry.expiresAt > Date.now()) {
      this.stats.hits++;
      entry.accessCount++;
      return entry.value;
    }

    if (entry) this.cache.delete(key);

    this.stats.misses++;
    const value = await computeFn();

    if (this.cache.size >= this.maxSize) {
      const oldest = this.cache.keys().next().value;
      this.cache.delete(oldest);
      this.stats.evictions++;
    }

    this.cache.set(key, {
      value,
      expiresAt: Date.now() + ttl,
      accessCount: 0,
      createdAt: Date.now()
    });

    return value;
  }

  invalidate(key) {
    return this.cache.delete(key);
  }

  clear() {
    this.cache.clear();
  }

  getStats() {
    return {
      ...this.stats,
      size: this.cache.size,
      maxSize: this.maxSize,
      hitRate: (this.stats.hits + this.stats.misses) > 0
        ? (this.stats.hits / (this.stats.hits + this.stats.misses) * 100).toFixed(2) + '%'
        : 'N/A'
    };
  }
}

/**
 * Data Pipeline with pluggable stages
 */
export class DataPipeline extends EventEmitter {
  constructor(options = {}) {
    super();
    this.name = options.name || 'pipeline';
    this.stages = [];
    this.stats = { processed: 0, errors: 0, totalDuration: 0 };
  }

  addStage(name, fn, options = {}) {
    this.stages.push({
      name,
      fn,
      timeout: options.timeout || 30000,
      retries: options.retries || 0,
      condition: options.condition || null
    });
    return this;
  }

  async execute(input, context = {}) {
    let current = input;
    const results = [];
    const startTime = Date.now();

    for (let i = 0; i < this.stages.length; i++) {
      const stage = this.stages[i];
      if (stage.condition && !stage.condition(current, context)) continue;

      const stageStart = Date.now();
      let result;
      let attempts = 0;

      while (attempts <= stage.retries) {
        try {
          result = await Promise.race([
            stage.fn(current, context),
            new Promise((_, reject) =>
              setTimeout(() => reject(new Error(`Stage ${stage.name} timeout`)), stage.timeout)
            )
          ]);
          break;
        } catch (error) {
          attempts++;
          if (attempts > stage.retries) throw error;
          await new Promise(r => setTimeout(r, 100 * attempts));
        }
      }

      results.push({
        stage: stage.name,
        input: current,
        output: result,
        duration: Date.now() - stageStart,
        attempts
      });

      current = result;
      this.emit('stage:complete', { stage: stage.name, index: i });
    }

    const totalDuration = Date.now() - startTime;
    this.stats.processed++;
    this.stats.totalDuration += totalDuration;

    return {
      input,
      output: current,
      stages: results,
      totalDuration,
      pipelineName: this.name
    };
  }

  getStats() {
    return {
      ...this.stats,
      stageCount: this.stages.length,
      avgDuration: this.stats.processed > 0
        ? Math.round(this.stats.totalDuration / this.stats.processed)
        : 0
    };
  }
}

/**
 * Feature Flags with percentage rollout and targeting
 */
export class FeatureFlagManagerV2 extends EventEmitter {
  constructor(options = {}) {
    super();
    this.flags = new Map();
    this.defaultRollout = options.defaultRollout || 100;
  }

  define(name, options = {}) {
    const flag = {
      name,
      enabled: options.enabled !== false,
      rollout: options.rollout ?? this.defaultRollout,
      variants: options.variants || null,
      targeting: options.targeting || [],
      description: options.description || '',
      createdAt: Date.now()
    };
    this.flags.set(name, flag);
    this.emit('flag:defined', { name });
    return this;
  }

  isEnabled(name, context = {}) {
    const flag = this.flags.get(name);
    if (!flag) return false;
    if (!flag.enabled) return false;

    // Check targeting rules
    if (flag.targeting.length > 0) {
      for (const rule of flag.targeting) {
        if (this._matchesTarget(rule, context)) return rule.enabled !== false;
      }
      return false;
    }

    // Percentage rollout
    if (flag.rollout < 100) {
      const hash = this._hash(`${name}:${context.userId || context.id || 'anonymous'}`);
      return (hash % 100) < flag.rollout;
    }

    return true;
  }

  getVariant(name, context = {}) {
    if (!this.isEnabled(name, context)) return null;
    const flag = this.flags.get(name);
    if (!flag?.variants) return true;

    const hash = this._hash(`${name}:variant:${context.userId || 'anonymous'}`);
    const index = hash % flag.variants.length;
    return flag.variants[index];
  }

  enable(name) {
    const flag = this.flags.get(name);
    if (flag) { flag.enabled = true; this.emit('flag:enabled', { name }); }
    return this;
  }

  disable(name) {
    const flag = this.flags.get(name);
    if (flag) { flag.enabled = false; this.emit('flag:disabled', { name }); }
    return this;
  }

  setRollout(name, percentage) {
    const flag = this.flags.get(name);
    if (flag) flag.rollout = Math.max(0, Math.min(100, percentage));
    return this;
  }

  remove(name) {
    this.flags.delete(name);
    this.emit('flag:removed', { name });
    return this;
  }

  list() {
    return Array.from(this.flags.values()).map(f => ({
      name: f.name,
      enabled: f.enabled,
      rollout: f.rollout,
      hasVariants: !!f.variants,
      targetingRules: f.targeting.length,
      description: f.description
    }));
  }

  _matchesTarget(rule, context) {
    if (rule.userId && context.userId && rule.userId === context.userId) return true;
    if (rule.group && context.group && rule.group === context.group) return true;
    if (rule.country && context.country && rule.country === context.country) return true;
    if (rule.custom && typeof rule.custom === 'function') return rule.custom(context);
    return false;
  }

  _hash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
    }
    return Math.abs(hash);
  }

  getStats() {
    const flags = Array.from(this.flags.values());
    return {
      total: flags.length,
      enabled: flags.filter(f => f.enabled).length,
      disabled: flags.filter(f => !f.enabled).length,
      withVariants: flags.filter(f => f.variants).length,
      withTargeting: flags.filter(f => f.targeting.length > 0).length
    };
  }
}

// Singleton factories
let rateLimiterV2Instance = null;
let retryHandlerInstance = null;
let memoizerInstance = null;
let featureFlagsV2Instance = null;

export function getRateLimiterV2(options) {
  if (!rateLimiterV2Instance) rateLimiterV2Instance = new RateLimiterV2(options);
  return rateLimiterV2Instance;
}

export function getRetryHandler(options) {
  if (!retryHandlerInstance) retryHandlerInstance = new RetryHandler(options);
  return retryHandlerInstance;
}

export function getMemoizer(options) {
  if (!memoizerInstance) memoizerInstance = new Memoizer(options);
  return memoizerInstance;
}

export function getFeatureFlagManagerV2(options) {
  if (!featureFlagsV2Instance) featureFlagsV2Instance = new FeatureFlagManagerV2(options);
  return featureFlagsV2Instance;
}

export default {
  RateLimiterV2,
  RetryHandler,
  Memoizer,
  DataPipeline,
  FeatureFlagManagerV2,
  getRateLimiterV2,
  getRetryHandler,
  getMemoizer,
  getFeatureFlagManagerV2
};
