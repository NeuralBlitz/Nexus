export const manifest = {
  name: 'rate-limit-plugin',
  id: 'rate-limit-plugin',
  version: '1.0.0',
  description: 'Advanced rate limiting utilities',
  author: 'NEXUS',
  main: 'index.js',
  permissions: []
};

let api;
const limiters = new Map();

export async function init(context) {
  api = context;
  api.log('Rate limit plugin initialized');
}

export async function activate(context) {
  api.log('Rate limit plugin activated');
}

export function deactivate() {
  api.log('Rate limit plugin deactivated');
}

class RateLimiter {
  constructor(options = {}) {
    this.options = {
      windowMs: options.windowMs || 60000,
      maxRequests: options.maxRequests || 100,
      keyPrefix: options.keyPrefix || 'rl',
      skipSuccessfulRequests: options.skipSuccessfulRequests || false,
      skipFailedRequests: options.skipFailedRequests || false,
      limiter: options.limiter || 'fixed',
      draftResponse: options.draftResponse || null
    };
    this.store = new Map();
    this.stats = { total: 0, passed: 0, limited: 0 };
  }

  key(identifier) {
    return `${this.options.keyPrefix}:${identifier}`;
  }

  increment(key) {
    const now = Date.now();
    const windowStart = now - this.options.windowMs;
    let record = this.store.get(key);

    if (!record || record.windowStart < windowStart) {
      record = { count: 0, windowStart: now };
    }

    record.count++;
    this.store.set(key, record);
    this.stats.total++;

    const remaining = Math.max(0, this.options.maxRequests - record.count);
    const resetAt = record.windowStart + this.options.windowMs;

    return {
      limited: record.count > this.options.maxRequests,
      remaining,
      resetAt,
      total: record.count
    };
  }

  check(key) {
    const result = this.increment(key);
    if (result.limited) {
      this.stats.limited++;
      return { allowed: false, ...result };
    }
    this.stats.passed++;
    return { allowed: true, ...result };
  }

  consume(key) {
    return this.check(key);
  }

  reward(key) {
    const record = this.store.get(this.key(key));
    if (record && record.count > 0) record.count--;
  }

  reset(key) {
    this.store.delete(this.key(key));
  }

  resetAll() {
    this.store.clear();
  }

  get(key) {
    return this.store.get(this.key(key));
  }

  getStats() {
    return { ...this.stats, storeSize: this.store.size };
  }
}

class SlidingWindowLimiter extends RateLimiter {
  increment(key) {
    const now = Date.now();
    const windowStart = now - this.options.windowMs;
    let record = this.store.get(key);

    if (!record || record.windowStart < windowStart) {
      record = { timestamps: [], windowStart: now };
    }

    record.timestamps = record.timestamps.filter(t => t > windowStart);
    record.timestamps.push(now);

    const count = record.timestamps.length;
    this.stats.total++;

    const remaining = Math.max(0, this.options.maxRequests - count);
    const resetAt = record.timestamps[0] + this.options.windowMs;

    return {
      limited: count > this.options.maxRequests,
      remaining,
      resetAt,
      total: count
    };
  }
}

class TokenBucketLimiter {
  constructor(options = {}) {
    this.options = {
      bucketSize: options.bucketSize || 100,
      refillRate: options.refillRate || 10,
      refillInterval: options.refillInterval || 1000
    };
    this.buckets = new Map();
    this.interval = setInterval(() => this.refill(), this.options.refillInterval);
    this.stats = { total: 0, passed: 0, limited: 0 };
  }

  refill() {
    for (const [key, bucket] of this.buckets) {
      bucket.tokens = Math.min(this.options.bucketSize, bucket.tokens + this.options.refillRate);
    }
  }

  consume(key, tokens = 1) {
    if (!this.buckets.has(key)) {
      this.buckets.set(key, { tokens: this.options.bucketSize, lastRefill: Date.now() });
    }

    const bucket = this.buckets.get(key);
    this.stats.total++;

    if (bucket.tokens >= tokens) {
      bucket.tokens -= tokens;
      this.stats.passed++;
      return { allowed: true, remaining: bucket.tokens, total: this.options.bucketSize };
    }

    this.stats.limited++;
    return { allowed: false, remaining: bucket.tokens, total: this.options.bucketSize };
  }

  getStats() {
    return { ...this.stats, buckets: this.buckets.size };
  }
}

export const functions = {
  create: (name, options = {}) => {
    const limiter = options.limiter === 'sliding' 
      ? new SlidingWindowLimiter(options)
      : options.limiter === 'token'
      ? new TokenBucketLimiter(options)
      : new RateLimiter(options);
    limiters.set(name, limiter);
    return limiter;
  },

  get: (name) => limiters.get(name) || null,

  delete: (name) => limiters.delete(name),

  check: (name, key) => {
    const limiter = limiters.get(name);
    if (!limiter) return null;
    return limiter.check(key);
  },

  consume: (name, key) => {
    const limiter = limiters.get(name);
    if (!limiter) return null;
    return limiter.consume(key);
  },

  reward: (name, key) => {
    const limiter = limiters.get(name);
    if (!limiter || !limiter.reward) return false;
    limiter.reward(key);
    return true;
  },

  reset: (name, key) => {
    const limiter = limiters.get(name);
    if (!limiter) return false;
    limiter.reset(key);
    return true;
  },

  resetAll: (name) => {
    const limiter = limiters.get(name);
    if (!limiter) return false;
    limiter.resetAll();
    return true;
  },

  stats: (name) => {
    const limiter = limiters.get(name);
    return limiter ? limiter.getStats() : null;
  },

  middleware: (name, options = {}) => {
    const limiter = limiters.get(name);
    if (!limiter) return () => {};
    return (req, res, next) => {
      const key = options.keyGenerator ? options.keyGenerator(req) : (req.ip || req.user?.id || 'anonymous');
      const result = limiter.check(key);
      res.setHeader('X-RateLimit-Limit', limiter.options.maxRequests);
      res.setHeader('X-RateLimit-Remaining', result.remaining);
      res.setHeader('X-RateLimit-Reset', new Date(result.resetAt).toISOString());
      if (!result.allowed) {
        return res.status(429).json({ error: 'Too many requests', retryAfter: Math.ceil((result.resetAt - Date.now()) / 1000) });
      }
      next();
    };
  }
};

export default { manifest, init, activate, deactivate, functions };
