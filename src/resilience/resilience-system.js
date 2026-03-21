#!/usr/bin/env node

import { EventEmitter } from 'events';

// ═══════════════════════════════════════════════════════════════════════════
// RESILIENCE SYSTEM
// Rate limiting, circuit breaker, retry, bulkhead, timeout
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Circuit breaker states
 */
export const CircuitState = {
  CLOSED: 'closed',     // Normal operation
  OPEN: 'open',         // Failing, reject requests
  HALF_OPEN: 'half_open' // Testing recovery
};

/**
 * Circuit Breaker
 */
export class CircuitBreaker extends EventEmitter {
  constructor(options = {}) {
    super();

    this.name = options.name || 'default';
    this.failureThreshold = options.failureThreshold || 5;
    this.resetTimeout = options.resetTimeout || 30000;
    this.halfOpenMax = options.halfOpenMax || 3;

    // State
    this.state = CircuitState.CLOSED;
    this.failureCount = 0;
    this.successCount = 0;
    this.lastFailure = null;
    this.nextAttempt = null;
    this.halfOpenAttempts = 0;

    // Stats
    this.stats = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      rejectedRequests: 0,
      stateChanges: []
    };
  }

  /**
   * Execute function through circuit breaker
   */
  async execute(fn) {
    this.stats.totalRequests++;

    // Check if circuit is open
    if (this.state === CircuitState.OPEN) {
      if (Date.now() < this.nextAttempt) {
        this.stats.rejectedRequests++;
        throw new Error(`Circuit breaker ${this.name} is OPEN`);
      }
      // Move to half-open
      this._transitionTo(CircuitState.HALF_OPEN);
    }

    // Half-open: limit concurrent attempts
    if (this.state === CircuitState.HALF_OPEN) {
      if (this.halfOpenAttempts >= this.halfOpenMax) {
        this.stats.rejectedRequests++;
        throw new Error(`Circuit breaker ${this.name} is HALF_OPEN (max attempts reached)`);
      }
      this.halfOpenAttempts++;
    }

    try {
      const result = await fn();
      this._onSuccess();
      return result;
    } catch (error) {
      this._onFailure(error);
      throw error;
    }
  }

  /**
   * Handle successful execution
   */
  _onSuccess() {
    this.stats.successfulRequests++;

    if (this.state === CircuitState.HALF_OPEN) {
      this.successCount++;
      if (this.successCount >= this.halfOpenMax) {
        this._transitionTo(CircuitState.CLOSED);
      }
    }

    this.failureCount = 0;
  }

  /**
   * Handle failed execution
   */
  _onFailure(error) {
    this.stats.failedRequests++;
    this.failureCount++;
    this.lastFailure = { error: error.message, timestamp: Date.now() };

    if (this.state === CircuitState.HALF_OPEN) {
      this._transitionTo(CircuitState.OPEN);
    } else if (this.failureCount >= this.failureThreshold) {
      this._transitionTo(CircuitState.OPEN);
    }
  }

  /**
   * Transition to new state
   */
  _transitionTo(newState) {
    const oldState = this.state;
    this.state = newState;

    if (newState === CircuitState.OPEN) {
      this.nextAttempt = Date.now() + this.resetTimeout;
      this.failureCount = 0;
      this.successCount = 0;
      this.halfOpenAttempts = 0;
    } else if (newState === CircuitState.CLOSED) {
      this.failureCount = 0;
      this.successCount = 0;
      this.halfOpenAttempts = 0;
    }

    this.stats.stateChanges.push({
      from: oldState,
      to: newState,
      timestamp: Date.now()
    });

    this.emit('stateChange', { from: oldState, to: newState });
  }

  /**
   * Get status
   */
  getStatus() {
    return {
      name: this.name,
      state: this.state,
      failureCount: this.failureCount,
      failureThreshold: this.failureThreshold,
      lastFailure: this.lastFailure,
      nextAttempt: this.nextAttempt,
      stats: this.stats
    };
  }

  /**
   * Reset circuit breaker
   */
  reset() {
    this._transitionTo(CircuitState.CLOSED);
  }
}

/**
 * Rate Limiter
 */
export class RateLimiter extends EventEmitter {
  constructor(options = {}) {
    super();

    this.name = options.name || 'default';
    this.maxRequests = options.maxRequests || 100;
    this.windowMs = options.windowMs || 60000; // 1 minute
    this.blockDuration = options.blockDuration || 60000;

    // Storage
    this.windows = new Map();
    this.blocked = new Map();

    // Stats
    this.stats = {
      totalRequests: 0,
      allowedRequests: 0,
      blockedRequests: 0,
      activeWindows: 0
    };
  }

  /**
   * Check if request is allowed
   */
  check(key = 'default') {
    this.stats.totalRequests++;

    // Check if blocked
    const blockedUntil = this.blocked.get(key);
    if (blockedUntil && Date.now() < blockedUntil) {
      this.stats.blockedRequests++;
      return {
        allowed: false,
        remaining: 0,
        resetAt: blockedUntil,
        retryAfter: blockedUntil - Date.now()
      };
    }

    // Get or create window
    let window = this.windows.get(key);
    if (!window || Date.now() > window.resetAt) {
      window = {
        count: 0,
        resetAt: Date.now() + this.windowMs
      };
      this.windows.set(key, window);
    }

    // Increment count
    window.count++;
    this.stats.activeWindows = this.windows.size;

    // Check limit
    if (window.count > this.maxRequests) {
      this.stats.blockedRequests++;

      // Block the key
      this.blocked.set(key, Date.now() + this.blockDuration);
      this.emit('blocked', { key, duration: this.blockDuration });

      return {
        allowed: false,
        remaining: 0,
        resetAt: window.resetAt,
        retryAfter: this.blockDuration
      };
    }

    this.stats.allowedRequests++;

    return {
      allowed: true,
      remaining: this.maxRequests - window.count,
      resetAt: window.resetAt
    };
  }

  /**
   * Reset a specific key
   */
  reset(key = 'default') {
    this.windows.delete(key);
    this.blocked.delete(key);
  }

  /**
   * Reset all
   */
  resetAll() {
    this.windows.clear();
    this.blocked.clear();
  }

  /**
   * Get status
   */
  getStatus() {
    return {
      name: this.name,
      maxRequests: this.maxRequests,
      windowMs: this.windowMs,
      activeWindows: this.windows.size,
      blockedKeys: this.blocked.size,
      stats: this.stats
    };
  }
}

/**
 * Retry Handler
 */
export class RetryHandler extends EventEmitter {
  constructor(options = {}) {
    super();

    this.maxRetries = options.maxRetries || 3;
    this.baseDelay = options.baseDelay || 1000;
    this.maxDelay = options.maxDelay || 30000;
    this.backoffMultiplier = options.backoffMultiplier || 2;
    this.jitter = options.jitter !== false;

    // Retryable errors
    this.retryableErrors = options.retryableErrors || [];

    // Stats
    this.stats = {
      totalAttempts: 0,
      totalRetries: 0,
      successfulRetries: 0,
      failedRetries: 0
    };
  }

  /**
   * Execute with retry
   */
  async execute(fn, options = {}) {
    const maxRetries = options.maxRetries || this.maxRetries;
    let lastError;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      this.stats.totalAttempts++;

      try {
        return await fn();
      } catch (error) {
        lastError = error;

        // Check if error is retryable
        if (!this._isRetryable(error)) {
          throw error;
        }

        // Don't retry on last attempt
        if (attempt === maxRetries) {
          this.stats.failedRetries++;
          throw error;
        }

        // Calculate delay
        const delay = this._calculateDelay(attempt);
        this.stats.totalRetries++;

        this.emit('retry', { attempt: attempt + 1, delay, error: error.message });

        // Wait
        await this._sleep(delay);
      }
    }

    throw lastError;
  }

  /**
   * Check if error is retryable
   */
  _isRetryable(error) {
    // Check against retryable error patterns
    if (this.retryableErrors.length > 0) {
      return this.retryableErrors.some(pattern => {
        if (typeof pattern === 'string') {
          return error.message.includes(pattern);
        }
        if (pattern instanceof RegExp) {
          return pattern.test(error.message);
        }
        if (typeof pattern === 'function') {
          return pattern(error);
        }
        return false;
      });
    }

    // Default: retry network and timeout errors
    const retryablePatterns = ['timeout', 'ECONNRESET', 'ETIMEDOUT', 'ECONNREFUSED', 'rate limit'];
    return retryablePatterns.some(p => error.message.toLowerCase().includes(p.toLowerCase()));
  }

  /**
   * Calculate retry delay with backoff and jitter
   */
  _calculateDelay(attempt) {
    let delay = this.baseDelay * Math.pow(this.backoffMultiplier, attempt);
    delay = Math.min(delay, this.maxDelay);

    if (this.jitter) {
      delay = delay * (0.5 + Math.random() * 0.5);
    }

    return Math.floor(delay);
  }

  _sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get stats
   */
  getStats() {
    return {
      ...this.stats,
      successRate: this.stats.totalRetries > 0
        ? (this.stats.successfulRetries / this.stats.totalRetries * 100).toFixed(2) + '%'
        : 'N/A'
    };
  }
}

/**
 * Bulkhead (concurrency limiter)
 */
export class Bulkhead extends EventEmitter {
  constructor(options = {}) {
    super();

    this.name = options.name || 'default';
    this.maxConcurrent = options.maxConcurrent || 10;
    this.maxQueue = options.maxQueue || 100;
    this.timeout = options.timeout || 30000;

    // State
    this.current = 0;
    this.queue = [];

    // Stats
    this.stats = {
      totalRequests: 0,
      executedRequests: 0,
      queuedRequests: 0,
      rejectedRequests: 0,
      timedOutRequests: 0
    };
  }

  /**
   * Execute function through bulkhead
   */
  async execute(fn) {
    this.stats.totalRequests++;

    // Check if queue is full
    if (this.queue.length >= this.maxQueue) {
      this.stats.rejectedRequests++;
      throw new Error(`Bulkhead ${this.name} queue full`);
    }

    // If under concurrency limit, execute immediately
    if (this.current < this.maxConcurrent) {
      return this._execute(fn);
    }

    // Queue the request
    return new Promise((resolve, reject) => {
      const queueItem = {
        fn,
        resolve,
        reject,
        addedAt: Date.now()
      };

      this.queue.push(queueItem);
      this.stats.queuedRequests++;
    });
  }

  /**
   * Execute function
   */
  async _execute(fn) {
    this.current++;

    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Bulkhead timeout')), this.timeout)
    );

    try {
      const result = await Promise.race([
        fn(),
        timeoutPromise
      ]);

      this.stats.executedRequests++;
      return result;
    } catch (error) {
      if (error.message === 'Bulkhead timeout') {
        this.stats.timedOutRequests++;
      }
      throw error;
    } finally {
      this.current--;
      this._processQueue();
    }
  }

  /**
   * Process queued requests
   */
  _processQueue() {
    while (this.queue.length > 0 && this.current < this.maxConcurrent) {
      const item = this.queue.shift();
      this._execute(item.fn).then(item.resolve).catch(item.reject);
    }
  }

  /**
   * Get status
   */
  getStatus() {
    return {
      name: this.name,
      current: this.current,
      maxConcurrent: this.maxConcurrent,
      queueLength: this.queue.length,
      maxQueue: this.maxQueue,
      stats: this.stats
    };
  }
}

/**
 * Timeout wrapper
 */
export class TimeoutWrapper {
  constructor(defaultTimeout = 30000) {
    this.defaultTimeout = defaultTimeout;
  }

  /**
   * Execute with timeout
   */
  async execute(fn, timeout = null) {
    const timeoutMs = timeout || this.defaultTimeout;

    return Promise.race([
      fn(),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Operation timeout')), timeoutMs)
      )
    ]);
  }
}

/**
 * Resilience Manager
 */
export class ResilienceManager extends EventEmitter {
  constructor() {
    super();

    this.circuitBreakers = new Map();
    this.rateLimiters = new Map();
    this.bulkheads = new Map();
    this.retryHandlers = new Map();
    this.timeoutWrapper = new TimeoutWrapper();
  }

  /**
   * Get or create circuit breaker
   */
  getCircuitBreaker(name, options = {}) {
    if (!this.circuitBreakers.has(name)) {
      const cb = new CircuitBreaker({ name, ...options });
      cb.on('stateChange', (data) => this.emit('circuitBreaker:stateChange', { name, ...data }));
      this.circuitBreakers.set(name, cb);
    }
    return this.circuitBreakers.get(name);
  }

  /**
   * Get or create rate limiter
   */
  getRateLimiter(name, options = {}) {
    if (!this.rateLimiters.has(name)) {
      const rl = new RateLimiter({ name, ...options });
      rl.on('blocked', (data) => this.emit('rateLimiter:blocked', { name, ...data }));
      this.rateLimiters.set(name, rl);
    }
    return this.rateLimiters.get(name);
  }

  /**
   * Get or create bulkhead
   */
  getBulkhead(name, options = {}) {
    if (!this.bulkheads.has(name)) {
      const bh = new Bulkhead({ name, ...options });
      this.bulkheads.set(name, bh);
    }
    return this.bulkheads.get(name);
  }

  /**
   * Get or create retry handler
   */
  getRetryHandler(name, options = {}) {
    if (!this.retryHandlers.has(name)) {
      const rh = new RetryHandler(options);
      this.retryHandlers.set(name, rh);
    }
    return this.retryHandlers.get(name);
  }

  /**
   * Execute with full resilience
   */
  async execute(name, fn, options = {}) {
    const circuitBreaker = this.getCircuitBreaker(name, options.circuitBreaker);
    const rateLimiter = this.getRateLimiter(name, options.rateLimiter);
    const retryHandler = this.getRetryHandler(name, options.retry);
    const bulkhead = this.getBulkhead(name, options.bulkhead);

    // Chain resilience patterns
    return bulkhead.execute(async () => {
      // Rate limit check
      const rateLimitResult = rateLimiter.check(name);
      if (!rateLimitResult.allowed) {
        throw new Error('Rate limit exceeded');
      }

      // Execute with circuit breaker and retry
      return circuitBreaker.execute(async () => {
        return retryHandler.execute(fn, options.retry);
      });
    });
  }

  /**
   * Get all statuses
   */
  getAllStatus() {
    return {
      circuitBreakers: Object.fromEntries(
        Array.from(this.circuitBreakers.entries()).map(([k, v]) => [k, v.getStatus()])
      ),
      rateLimiters: Object.fromEntries(
        Array.from(this.rateLimiters.entries()).map(([k, v]) => [k, v.getStatus()])
      ),
      bulkheads: Object.fromEntries(
        Array.from(this.bulkheads.entries()).map(([k, v]) => [k, v.getStatus()])
      )
    };
  }

  /**
   * Reset all resilience patterns
   */
  resetAll() {
    for (const cb of this.circuitBreakers.values()) cb.reset();
    for (const rl of this.rateLimiters.values()) rl.resetAll();
    for (const bh of this.bulkheads.values()) bh.reset();
    this.emit('resilience:reset');
  }

  /**
   * Execute with fallback
   */
  async executeWithFallback(name, fn, fallbackFn, options = {}) {
    try {
      return await this.execute(name, fn, options);
    } catch (error) {
      this.emit('resilience:fallback', { name, error: error.message });
      return fallbackFn(error);
    }
  }

  /**
   * Execute with timeout
   */
  async executeWithTimeout(name, fn, timeoutMs, options = {}) {
    return this.execute(name, async () => {
      return Promise.race([
        fn(),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error(`Timeout after ${timeoutMs}ms`)), timeoutMs)
        )
      ]);
    }, options);
  }

  /**
   * Execute across multiple backends with first-success
   */
  async executeRace(name, fns, options = {}) {
    const results = await Promise.allSettled(
      fns.map((fn, i) => this.execute(`${name}:${i}`, fn, options))
    );

    const success = results.find(r => r.status === 'fulfilled');
    if (success) return success.value;

    throw new Error('All backends failed: ' + results.map(r => r.reason?.message).join('; '));
  }

  /**
   * Get resilience health
   */
  getHealth() {
    const status = this.getAllStatus();
    const tripped = Object.values(status.circuitBreakers).filter(cb => cb.state === 'OPEN').length;
    return {
      healthy: tripped === 0,
      openCircuits: tripped,
      totalCircuits: Object.keys(status.circuitBreakers).length,
      totalRateLimiters: Object.keys(status.rateLimiters).length,
      totalBulkheads: Object.keys(status.bulkheads).length
    };
  }
}

// Export singleton
let manager = null;

export function getResilienceManager() {
  if (!manager) {
    manager = new ResilienceManager();
  }
  return manager;
}

export default {
  CircuitBreaker,
  RateLimiter,
  RetryHandler,
  Bulkhead,
  TimeoutWrapper,
  ResilienceManager,
  CircuitState,
  getResilienceManager
};