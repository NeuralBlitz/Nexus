import { EventEmitter } from 'events';
import crypto from 'crypto';

export class Lock {
  constructor(name, ttl = 30000) {
    this.name = name;
    this.token = crypto.randomBytes(16).toString('hex');
    this.acquiredAt = Date.now();
    this.expiresAt = Date.now() + ttl;
    this.ttl = ttl;
    this.released = false;
  }

  isExpired() {
    return Date.now() > this.expiresAt;
  }

  extend(additionalTtl = null) {
    if (this.released) return false;
    const ttl = additionalTtl || this.ttl;
    this.expiresAt = Date.now() + ttl;
    return true;
  }
}

export class DistributedLockManager extends EventEmitter {
  constructor(options = {}) {
    super();

    this.locks = new Map();
    this.waiting = new Map();
    this.defaultTtl = options.defaultTtl || 30000;
    this.cleanupInterval = options.cleanupInterval || 5000;
    this.cleanupTimer = null;

    this.startCleanup();
  }

  async acquire(name, options = {}) {
    const ttl = options.ttl || this.defaultTtl;
    const wait = options.wait !== false;
    const waitTimeout = options.waitTimeout || 30000;
    const token = options.token || crypto.randomBytes(16).toString('hex');

    const existingLock = this.locks.get(name);

    if (existingLock && !existingLock.isExpired() && !existingLock.released) {
      if (!wait) {
        return null;
      }

      if (!this.waiting.has(name)) {
        this.waiting.set(name, []);
      }

      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          const queue = this.waiting.get(name);
          const index = queue.findIndex(w => w.resolve === resolve);
          if (index > -1) queue.splice(index, 1);
          reject(new Error('Lock acquisition timeout'));
        }, waitTimeout);

        this.waiting.get(name).push({ resolve, timeout });
      });
    }

    const lock = new Lock(name, ttl);
    lock.token = token;
    this.locks.set(name, lock);

    this.emit('lock:acquired', { name, token, ttl });

    return { name, token, ttl };
  }

  release(name, token = null) {
    const lock = this.locks.get(name);
    if (!lock) return false;

    if (token && lock.token !== token) {
      return false;
    }

    lock.released = true;
    this.locks.delete(name);

    const waiters = this.waiting.get(name);
    if (waiters && waiters.length > 0) {
      const waiter = waiters.shift();
      clearTimeout(waiter.timeout);

      const newLock = new Lock(name, lock.ttl);
      this.locks.set(name, newLock);
      waiter.resolve({ name, token: newLock.token, ttl: newLock.ttl });
    }

    this.emit('lock:released', { name });
    return true;
  }

  extend(name, additionalTtl = null, token = null) {
    const lock = this.locks.get(name);
    if (!lock) return false;

    if (token && lock.token !== token) {
      return false;
    }

    const success = lock.extend(additionalTtl);
    if (success) {
      this.emit('lock:extended', { name, expiresAt: lock.expiresAt });
    }
    return success;
  }

  isLocked(name) {
    const lock = this.locks.get(name);
    return lock && !lock.isExpired() && !lock.released;
  }

  getLock(name) {
    const lock = this.locks.get(name);
    if (!lock || lock.isExpired()) return null;
    return lock;
  }

  cleanup() {
    let cleaned = 0;

    for (const [name, lock] of this.locks) {
      if (lock.isExpired() || lock.released) {
        this.locks.delete(name);
        cleaned++;
      }
    }

    return cleaned;
  }

  startCleanup() {
    this.cleanupTimer = setInterval(() => {
      const cleaned = this.cleanup();
      if (cleaned > 0) {
        this.emit('cleanup', { cleaned });
      }
    }, this.cleanupInterval);
  }

  stopCleanup() {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
  }

  withLock(name, fn, options = {}) {
    return (async () => {
      const lock = await this.acquire(name, options);
      if (!lock) {
        throw new Error(`Failed to acquire lock: ${name}`);
      }

      try {
        return await fn();
      } finally {
        this.release(name, lock.token);
      }
    })();
  }

  getStats() {
    return {
      activeLocks: this.locks.size,
      waitingQueues: this.waiting.size,
      defaultTtl: this.defaultTtl
    };
  }
}

export class Semaphore {
  constructor(concurrency) {
    this.concurrency = concurrency;
    this.current = 0;
    this.waiting = [];
  }

  async acquire() {
    if (this.current < this.concurrency) {
      this.current++;
      return true;
    }

    return new Promise((resolve) => {
      this.waiting.push(resolve);
    });
  }

  release() {
    if (this.waiting.length > 0) {
      const resolve = this.waiting.shift();
      resolve(true);
    } else {
      this.current--;
    }
  }

  async withSemaphore(fn) {
    await this.acquire();
    try {
      return await fn();
    } finally {
      this.release();
    }
  }

  getStats() {
    return {
      concurrency: this.concurrency,
      current: this.current,
      waiting: this.waiting.length,
      available: this.concurrency - this.current
    };
  }
}

export class LeaderElection {
  constructor(name, options = {}) {
    this.name = name;
    this.lockManager = options.lockManager || new DistributedLockManager();
    this.leaderId = options.leaderId || crypto.randomBytes(16).toString('hex');
    this.isLeader = false;
    this.heartbeatInterval = options.heartbeatInterval || 5000;
    this.heartbeatTimer = null;
    this.onBecomeLeader = options.onBecomeLeader;
    this.onLoseLeader = options.onLoseLeader;
  }

  async tryBecomeLeader() {
    try {
      const lock = await this.lockManager.acquire(`leader:${this.name}`, {
        ttl: this.heartbeatInterval * 2,
        wait: false
      });

      if (lock) {
        this.isLeader = true;
        this.startHeartbeat();

        if (this.onBecomeLeader) {
          this.onBecomeLeader();
        }

        this.emit('leader:elected', { name: this.name, leaderId: this.leaderId });
        return true;
      }
    } catch (error) {
      return false;
    }
    return false;
  }

  startHeartbeat() {
    this.heartbeatTimer = setInterval(async () => {
      this.lockManager.extend(`leader:${this.name}`);
    }, this.heartbeatInterval);
  }

  stopHeartbeat() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  resign() {
    if (this.isLeader) {
      this.stopHeartbeat();
      this.lockManager.release(`leader:${this.name}`);
      this.isLeader = false;

      if (this.onLoseLeader) {
        this.onLoseLeader();
      }

      this.emit('leader:resigned', { name: this.name });
    }
  }

  isCurrentLeader() {
    return this.isLeader;
  }

  getLeader() {
    const lock = this.lockManager.getLock(`leader:${this.name}`);
    return lock ? { name: this.name, leaderId: this.leaderId } : null;
  }
}

let lockManager = null;

export function getLockManager(options = {}) {
  if (!lockManager) {
    lockManager = new DistributedLockManager(options);
  }
  return lockManager;
}

export default { DistributedLockManager, Lock, Semaphore, LeaderElection, getLockManager };
