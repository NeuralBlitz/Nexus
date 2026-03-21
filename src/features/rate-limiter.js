import { EventEmitter } from 'events';

export class RateLimitConfig {
  constructor(options = {}) {
    this.windowMs = options.windowMs || 60000;
    this.maxRequests = options.maxRequests || 100;
    this.blockDuration = options.blockDuration || 300000;
    this.keyGenerator = options.keyGenerator || ((req) => req.ip || req.headers['x-forwarded-for'] || 'unknown');
    this.keyPrefix = options.keyPrefix || 'rl';
    this.skipSuccessfulRequests = options.skipSuccessfulRequests || false;
    this.skipFailedRequests = options.skipFailedRequests || false;
    this.draft_polli_ratelimit_headers = options.draft_polli_ratelimit_headers || false;
  }
}

export class RateLimitStore {
  constructor() {
    this.hits = new Map();
    this.blocked = new Set();
  }

  increment(key) {
    const now = Date.now();
    const record = this.hits.get(key) || { count: 0, resetTime: now + this.windowMs };

    record.count++;
    if (now >= record.resetTime) {
      record.count = 1;
      record.resetTime = now + this.windowMs;
    }

    this.hits.set(key, record);
    return record;
  }

  decrement(key) {
    const record = this.hits.get(key);
    if (record && record.count > 0) {
      record.count--;
    }
  }

  reset(key) {
    this.hits.delete(key);
  }

  resetAll() {
    this.hits.clear();
    this.blocked.clear();
  }

  isBlocked(key) {
    return this.blocked.has(key);
  }

  block(key, duration) {
    this.blocked.add(key);
    setTimeout(() => this.blocked.delete(key), duration);
  }
}

export class RateLimitMetrics {
  constructor() {
    this.totalRequests = 0;
    this.totalBlocked = 0;
    this.totalHits = 0;
    this.byEndpoint = new Map();
    this.byUser = new Map();
  }

  recordRequest(key, blocked, endpoint = 'unknown') {
    this.totalRequests++;
    if (blocked) this.totalBlocked++;
    else this.totalHits++;

    const endpointStats = this.byEndpoint.get(endpoint) || { requests: 0, blocked: 0 };
    endpointStats.requests++;
    if (blocked) endpointStats.blocked++;
    this.byEndpoint.set(endpoint, endpointStats);

    const userStats = this.byUser.get(key) || { requests: 0, blocked: 0 };
    userStats.requests++;
    if (blocked) userStats.blocked++;
    this.byUser.set(key, userStats);
  }

  getStats() {
    return {
      totalRequests: this.totalRequests,
      totalBlocked: this.totalBlocked,
      totalHits: this.totalHits,
      blockRate: this.totalRequests > 0 ? (this.totalBlocked / this.totalRequests * 100).toFixed(2) + '%' : '0%',
      byEndpoint: Object.fromEntries(this.byEndpoint),
      topUsers: Array.from(this.byUser.entries())
        .sort((a, b) => b[1].requests - a[1].requests)
        .slice(0, 10)
        .map(([key, stats]) => ({ key, ...stats }))
    };
  }
}

export class RateLimiter extends EventEmitter {
  constructor(options = {}) {
    super();

    this.config = new RateLimitConfig(options);
    this.store = new RateLimitStore();
    this.metrics = new RateLimitMetrics();

    this.middleware = this.middleware.bind(this);
  }

  middleware() {
    return async (req, res, next) => {
      const key = this.config.keyGenerator(req);
      const endpoint = req.path;

      if (this.store.isBlocked(key)) {
        this.metrics.recordRequest(key, true, endpoint);
        this.emit('blocked', { key, req, endpoint });

        return res.status(429).json({
          error: 'Too Many Requests',
          message: 'Rate limit exceeded. Please try again later.',
          retryAfter: Math.ceil(this.config.blockDuration / 1000)
        });
      }

      const record = this.store.increment(key);

      res.setHeader('X-RateLimit-Limit', this.config.maxRequests);
      res.setHeader('X-RateLimit-Remaining', Math.max(0, this.config.maxRequests - record.count));
      res.setHeader('X-RateLimit-Reset', new Date(record.resetTime).toISOString());

      if (record.count > this.config.maxRequests) {
        this.store.block(key, this.config.blockDuration);
        this.metrics.recordRequest(key, true, endpoint);
        this.emit('exceeded', { key, count: record.count, req, endpoint });

        return res.status(429).json({
          error: 'Too Many Requests',
          message: 'Rate limit exceeded. Please try again later.',
          retryAfter: Math.ceil(this.config.blockDuration / 1000)
        });
      }

      this.metrics.recordRequest(key, false, endpoint);
      next();
    };
  }

  check(key) {
    if (this.store.isBlocked(key)) {
      return { allowed: false, blocked: true, remaining: 0 };
    }

    const record = this.store.increment(key);
    return {
      allowed: record.count <= this.config.maxRequests,
      remaining: Math.max(0, this.config.maxRequests - record.count),
      resetTime: record.resetTime
    };
  }

  reset(key) {
    this.store.reset(key);
    this.emit('reset', { key });
  }

  getMetrics() {
    return this.metrics.getStats();
  }

  createKey(prefix, ...parts) {
    return [this.config.keyPrefix, prefix, ...parts].join(':');
  }
}

let rateLimiter = null;

export function getRateLimiter(options = {}) {
  if (!rateLimiter) {
    rateLimiter = new RateLimiter(options);
  }
  return rateLimiter;
}

export default { RateLimiter, RateLimitConfig, RateLimitStore, RateLimitMetrics, getRateLimiter };
