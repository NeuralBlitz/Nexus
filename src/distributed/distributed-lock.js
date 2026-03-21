#!/usr/bin/env node

import { EventEmitter } from 'events';
import crypto from 'crypto';

// ═══════════════════════════════════════════════════════════════════════════
// DISTRIBUTED LOCK SYSTEM
// Redlock, semaphore, leader election, distributed coordination
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Lock states
 */
export const LockState = {
  UNLOCKED: 'unlocked',
  LOCKED: 'locked',
  EXPIRED: 'expired'
};

/**
 * Distributed Lock
 */
export class DistributedLock extends EventEmitter {
  constructor(options = {}) {
    super();

    this.name = options.name || 'default';
    this.ttl = options.ttl || 30000; // 30 seconds
    this.retryCount = options.retryCount || 3;
    this.retryDelay = options.retryDelay || 200;
    this.driftFactor = options.driftFactor || 0.01;

    // State
    this.state = LockState.UNLOCKED;
    this.lockId = null;
    this.lockedAt = null;
    this.expiresAt = null;

    // Storage (for in-memory implementation)
    this.storage = options.storage || new Map();
  }

  /**
   * Acquire the lock
   */
  async acquire(resource, clientId = null) {
    const id = clientId || crypto.randomBytes(16).toString('hex');

    for (let attempt = 0; attempt < this.maxRetries; attempt++) {
      const result = await this._tryAcquire(resource, id);

      if (result.acquired) {
        this.state = LockState.LOCKED;
        this.lockId = id;
        this.lockedAt = Date.now();
        this.expiresAt = result.expiresAt;

        this.emit('acquired', { resource, lockId: id });
        return { success: true, lockId: id };
      }

      // Wait before retry
      if (attempt < this.maxRetries - 1) {
        await this._sleep(this.retryDelay * Math.pow(2, attempt));
      }
    }

    return { success: false, error: 'Failed to acquire lock' };
  }

  /**
   * Try to acquire lock
   */
  async _tryAcquire(resource, id) {
    const now = Date.now();
    const ttlWithDrift = Math.floor(this.ttl * (1 + this.driftFactor));
    const expiresAt = now + ttlWithDrift;

    const existing = this.storage.get(resource);

    // Check if lock exists and is valid
    if (existing && existing.expiresAt > now) {
      return { acquired: false };
    }

    // Acquire lock
    this.storage.set(resource, {
      id,
      acquiredAt: now,
      expiresAt,
      ttl: this.ttl
    });

    return { acquired: true, expiresAt };
  }

  /**
   * Release the lock
   */
  async release(resource, lockId) {
    const existing = this.storage.get(resource);

    if (!existing || existing.id !== lockId) {
      return { success: false, error: 'Lock not held by this client' };
    }

    this.storage.delete(resource);
    this.state = LockState.UNLOCKED;
    this.lockId = null;
    this.lockedAt = null;
    this.expiresAt = null;

    this.emit('released', { resource });
    return { success: true };
  }

  /**
   * Extend lock TTL
   */
  async extend(resource, lockId, additionalTtl) {
    const existing = this.storage.get(resource);

    if (!existing || existing.id !== lockId) {
      return { success: false, error: 'Lock not held by this client' };
    }

    if (existing.expiresAt < Date.now()) {
      return { success: false, error: 'Lock expired' };
    }

    existing.expiresAt += additionalTtl;
    this.expiresAt = existing.expiresAt;

    return { success: true, expiresAt: existing.expiresAt };
  }

  /**
   * Check if lock is held
   */
  isHeld(resource) {
    const existing = this.storage.get(resource);
    return existing && existing.expiresAt > Date.now();
  }

  /**
   * Get lock info
   */
  getInfo(resource) {
    return this.storage.get(resource) || null;
  }

  /**
   * Sleep helper
   */
  _sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Semaphore (counting semaphore for multiple permits)
 */
export class DistributedSemaphore extends EventEmitter {
  constructor(options = {}) {
    super();

    this.name = options.name || 'default';
    this.maxPermits = options.maxPermits || 5;
    this.timeout = options.timeout || 30000;

    // State
    this.permits = new Map();
    this.waiting = [];

    // Stats
    this.stats = {
      totalAcquired: 0,
      totalReleased: 0,
      totalTimeouts: 0
    };
  }

  /**
   * Acquire a permit
   */
  async acquire(key, permitId = null) {
    const id = permitId || crypto.randomBytes(8).toString('hex');

    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        this.stats.totalTimeouts++;
        this._removeFromWaiting(id);
        reject(new Error('Semaphore acquire timeout'));
      }, this.timeout);

      const tryAcquire = () => {
        const current = this.permits.get(key) || 0;

        if (current < this.maxPermits) {
          this.permits.set(key, current + 1);
          this.stats.totalAcquired++;
          clearTimeout(timeoutId);

          resolve({
            success: true,
            permitId: id,
            release: () => this.release(key, id)
          });
        } else {
          // Queue the request
          this.waiting.push({ key, id, resolve, reject, timeoutId });
        }
      };

      tryAcquire();
    });
  }

  /**
   * Release a permit
   */
  release(key, permitId) {
    const current = this.permits.get(key) || 0;

    if (current > 0) {
      this.permits.set(key, current - 1);
      this.stats.totalReleased++;

      // Wake up waiting requests
      this._wakeWaiting(key);
    }
  }

  /**
   * Wake up waiting requests
   */
  _wakeWaiting(key) {
    const waitingFor = this.waiting.findIndex(w => w.key === key);
    if (waitingFor !== -1) {
      const waiter = this.waiting.splice(waitingFor, 1)[0];
      clearTimeout(waiter.timeoutId);

      const current = this.permits.get(key) || 0;
      if (current < this.maxPermits) {
        this.permits.set(key, current + 1);
        this.stats.totalAcquired++;

        waiter.resolve({
          success: true,
          permitId: waiter.id,
          release: () => this.release(key, waiter.id)
        });
      }
    }
  }

  /**
   * Remove from waiting queue
   */
  _removeFromWaiting(id) {
    const index = this.waiting.findIndex(w => w.id === id);
    if (index !== -1) {
      clearTimeout(this.waiting[index].timeoutId);
      this.waiting.splice(index, 1);
    }
  }

  /**
   * Get semaphore status
   */
  getStatus(key) {
    return {
      name: this.name,
      key,
      currentPermits: this.permits.get(key) || 0,
      maxPermits: this.maxPermits,
      available: this.maxPermits - (this.permits.get(key) || 0),
      waiting: this.waiting.filter(w => w.key === key).length,
      stats: this.stats
    };
  }
}

/**
 * Leader Election
 */
export class LeaderElection extends EventEmitter {
  constructor(options = {}) {
    super();

    this.name = options.name || 'default';
    this.termTimeout = options.termTimeout || 30000; // 30 seconds
    this.campaignDelay = options.campaignDelay || 1000;

    // State
    this.currentLeader = null;
    this.leaderExpiry = null;
    this.candidateId = options.candidateId || crypto.randomBytes(8).toString('hex');
    this.isLeader = false;

    // Storage
    this.storage = options.storage || new Map();

    // Heartbeat timer
    this.heartbeatTimer = null;
  }

  /**
   * Start campaigning for leadership
   */
  async campaign() {
    while (true) {
      try {
        const result = await this._tryBecomeLeader();

        if (result.success) {
          this.isLeader = true;
          this.currentLeader = this.candidateId;
          this.leaderExpiry = result.expiresAt;

          this.emit('elected', { leaderId: this.candidateId });

          // Start heartbeat
          this._startHeartbeat();

          return { success: true, leaderId: this.candidateId };
        }

        // Check if someone else is leader
        if (result.currentLeader) {
          this.currentLeader = result.currentLeader;
          this.isLeader = false;
          this.emit('follower', { leaderId: result.currentLeader });
        }

        // Wait before next attempt
        await this._sleep(this.campaignDelay + Math.random() * 1000);
      } catch (error) {
        this.emit('error', { error: error.message });
        await this._sleep(this.campaignDelay);
      }
    }
  }

  /**
   * Try to become leader
   */
  async _tryBecomeLeader() {
    const now = Date.now();
    const existing = this.storage.get('leader');

    // Check if current leader is still valid
    if (existing && existing.expiresAt > now) {
      return {
        success: false,
        currentLeader: existing.id,
        expiresAt: existing.expiresAt
      };
    }

    // Try to become leader
    const expiresAt = now + this.termTimeout;

    this.storage.set('leader', {
      id: this.candidateId,
      electedAt: now,
      expiresAt,
      term: (existing?.term || 0) + 1
    });

    return { success: true, expiresAt };
  }

  /**
   * Start heartbeat to maintain leadership
   */
  _startHeartbeat() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
    }

    this.heartbeatTimer = setInterval(async () => {
      if (!this.isLeader) {
        clearInterval(this.heartbeatTimer);
        return;
      }

      const now = Date.now();
      const existing = this.storage.get('leader');

      if (existing && existing.id === this.candidateId) {
        // Renew leadership
        existing.expiresAt = now + this.termTimeout;
        this.leaderExpiry = existing.expiresAt;
        this.emit('heartbeat', { leaderId: this.candidateId });
      } else {
        // Lost leadership
        this.isLeader = false;
        this.currentLeader = existing?.id || null;
        clearInterval(this.heartbeatTimer);
        this.emit('demoted', { newLeader: existing?.id });
      }
    }, this.termTimeout / 3);
  }

  /**
   * Stop campaigning
   */
  stop() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }

    // Step down if leader
    if (this.isLeader) {
      this.storage.delete('leader');
      this.isLeader = false;
      this.emit('demoted', { reason: 'manual' });
    }
  }

  /**
   * Get current leader
   */
  getLeader() {
    const existing = this.storage.get('leader');
    if (existing && existing.expiresAt > Date.now()) {
      return existing;
    }
    return null;
  }

  /**
   * Get status
   */
  getStatus() {
    return {
      name: this.name,
      candidateId: this.candidateId,
      isLeader: this.isLeader,
      currentLeader: this.currentLeader,
      leaderExpiry: this.leaderExpiry
    };
  }

  /**
   * Sleep helper
   */
  _sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Distributed Coordination Manager
 */
export class DistributedCoordinationManager extends EventEmitter {
  constructor(options = {}) {
    super();

    this.locks = new Map();
    this.semaphores = new Map();
    this.elections = new Map();

    // Shared storage (in-memory, should be replaced with Redis for production)
    this.sharedStorage = new Map();
  }

  /**
   * Get or create lock
   */
  getLock(name, options = {}) {
    if (!this.locks.has(name)) {
      const lock = new DistributedLock({ name, storage: this.sharedStorage, ...options });
      this.locks.set(name, lock);
    }
    return this.locks.get(name);
  }

  /**
   * Get or create semaphore
   */
  getSemaphore(name, options = {}) {
    if (!this.semaphores.has(name)) {
      const semaphore = new DistributedSemaphore({ name, ...options });
      this.semaphores.set(name, semaphore);
    }
    return this.semaphores.get(name);
  }

  /**
   * Get or create leader election
   */
  getElection(name, options = {}) {
    if (!this.elections.has(name)) {
      const election = new LeaderElection({ name, storage: this.sharedStorage, ...options });
      this.elections.set(name, election);
    }
    return this.elections.get(name);
  }

  /**
   * Execute with lock
   */
  async withLock(lockName, resource, fn, options = {}) {
    const lock = this.getLock(lockName, options);

    const { success, lockId } = await lock.acquire(resource);

    if (!success) {
      throw new Error(`Failed to acquire lock: ${lockName}/${resource}`);
    }

    try {
      return await fn();
    } finally {
      await lock.release(resource, lockId);
    }
  }

  /**
   * Execute with semaphore
   */
  async withSemaphore(semaphoreName, key, fn, options = {}) {
    const semaphore = this.getSemaphore(semaphoreName, options);

    const { permitId, release } = await semaphore.acquire(key);

    try {
      return await fn();
    } finally {
      release();
    }
  }

  /**
   * Get all statuses
   */
  getAllStatus() {
    return {
      locks: Object.fromEntries(
        Array.from(this.locks.entries()).map(([k, v]) => [k, { state: v.state }])
      ),
      semaphores: Object.fromEntries(
        Array.from(this.semaphores.entries()).map(([k, v]) => [k, v.getStatus('default')])
      ),
      elections: Object.fromEntries(
        Array.from(this.elections.entries()).map(([k, v]) => [k, v.getStatus()])
      )
    };
  }

  /**
   * Stop all
   */
  stopAll() {
    for (const election of this.elections.values()) {
      election.stop();
    }
  }
}

// Export singleton
let manager = null;

export function getDistributedManager(options) {
  if (!manager) {
    manager = new DistributedCoordinationManager(options);
  }
  return manager;
}

export default {
  DistributedLock,
  DistributedSemaphore,
  LeaderElection,
  DistributedCoordinationManager,
  LockState,
  getDistributedManager
};