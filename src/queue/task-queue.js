#!/usr/bin/env node

import { EventEmitter } from 'events';
import crypto from 'crypto';

// ═══════════════════════════════════════════════════════════════════════════
// TASK QUEUE SYSTEM
// Priority queues, rate limiting, scheduling, retries, dead letter queue
// ═══════════════════════════════════════════════════════════════════════════

export const JobStatus = {
  WAITING: 'waiting',
  ACTIVE: 'active',
  COMPLETED: 'completed',
  FAILED: 'failed',
  DELAYED: 'delayed',
  PAUSED: 'paused',
  STALLED: 'stalled'
};

export const JobPriority = {
  CRITICAL: 1,
  HIGH: 10,
  NORMAL: 50,
  LOW: 100
};

/**
 * Job class
 */
export class Job {
  constructor(queue, data, options = {}) {
    this.id = options.id || `job_${Date.now()}_${crypto.randomBytes(6).toString('hex')}`;
    this.queue = queue;
    this.data = data;
    this.name = options.name || 'unknown';
    this.priority = options.priority || JobPriority.NORMAL;
    this.status = JobStatus.WAITING;

    // Timing
    this.createdAt = Date.now();
    this.processedAt = null;
    this.completedAt = null;
    this.failedAt = null;
    this.delay = options.delay || 0;

    // Attempts
    this.attempts = 0;
    this.maxAttempts = options.maxAttempts || 3;
    this.backoff = options.backoff || { type: 'exponential', delay: 1000 };

    // Result
    this.result = null;
    this.error = null;

    // Progress
    this.progress = 0;

    // Tags and metadata
    this.tags = options.tags || [];
    this.metadata = options.metadata || {};

    // Callbacks
    this.onProgress = options.onProgress || null;
  }

  /**
   * Update progress
   */
  updateProgress(progress, message = null) {
    this.progress = progress;
    this.queue.emit('job:progress', {
      job: this.id,
      progress,
      message
    });
    if (this.onProgress) {
      this.onProgress(progress, message);
    }
  }

  /**
   * Calculate next retry delay
   */
  getNextDelay() {
    if (this.backoff.type === 'fixed') {
      return this.backoff.delay;
    }
    // Exponential backoff
    return this.backoff.delay * Math.pow(2, this.attempts - 1);
  }

  /**
   * To JSON
   */
  toJSON() {
    return {
      id: this.id,
      name: this.name,
      data: this.data,
      status: this.status,
      priority: this.priority,
      createdAt: this.createdAt,
      processedAt: this.processedAt,
      completedAt: this.completedAt,
      failedAt: this.failedAt,
      attempts: this.attempts,
      maxAttempts: this.maxAttempts,
      progress: this.progress,
      result: this.result,
      error: this.error,
      tags: this.tags,
      metadata: this.metadata
    };
  }
}

/**
 * Task Queue
 */
export class TaskQueue extends EventEmitter {
  constructor(name, options = {}) {
    super();

    this.name = name;
    this.concurrency = options.concurrency || 5;
    this.processing = new Map();
    this.waiting = [];
    this.delayed = [];
    this.completed = [];
    this.failed = [];
    this.paused = false;

    // Rate limiting
    this.rateLimit = {
      max: options.rateLimit || 100,
      duration: options.rateLimitDuration || 60000,
      counter: 0,
      resetAt: Date.now() + options.rateLimitDuration || 60000
    };

    // Stalled job detection
    this.stallDuration = options.stallDuration || 30000;
    this.stallCheckInterval = options.stallCheckInterval || 10000;

    // Auto-cleanup
    this.maxCompletedAge = options.maxCompletedAge || 3600000;
    this.maxFailedAge = options.maxFailedAge || 86400000;

    // Processors
    this.processors = new Map();

    // Start monitoring
    this._startMonitoring();
  }

  /**
   * Register a processor for a job type
   */
  process(jobName, handler, options = {}) {
    this.processors.set(jobName, {
      handler,
      concurrency: options.concurrency || 1
    });
    return this;
  }

  /**
   * Add a job to the queue
   */
  async add(data, options = {}) {
    const job = new Job(this, data, options);

    // Check rate limit
    if (!this._checkRateLimit()) {
      throw new Error('Rate limit exceeded');
    }

    if (job.delay > 0) {
      job.status = JobStatus.DELAYED;
      this.delayed.push(job);

      setTimeout(() => {
        this._promoteDelayed(job);
      }, job.delay);
    } else {
      this.waiting.push(job);
      this._sortWaiting();
    }

    this.emit('job:added', { job: job.id, queue: this.name });
    this._processNext();

    return job;
  }

  /**
   * Add multiple jobs
   */
  async addBulk(jobs) {
    const added = [];
    for (const { data, options } of jobs) {
      added.push(await this.add(data, options));
    }
    return added;
  }

  /**
   * Check rate limit
   */
  _checkRateLimit() {
    const now = Date.now();
    if (now > this.rateLimit.resetAt) {
      this.rateLimit.counter = 0;
      this.rateLimit.resetAt = now + this.rateLimit.duration;
    }

    if (this.rateLimit.counter >= this.rateLimit.max) {
      return false;
    }

    this.rateLimit.counter++;
    return true;
  }

  /**
   * Sort waiting queue by priority
   */
  _sortWaiting() {
    this.waiting.sort((a, b) => a.priority - b.priority);
  }

  /**
   * Promote delayed job to waiting
   */
  _promoteDelayed(job) {
    const index = this.delayed.indexOf(job);
    if (index !== -1) {
      this.delayed.splice(index, 1);
      job.status = JobStatus.WAITING;
      this.waiting.push(job);
      this._sortWaiting();
      this._processNext();
    }
  }

  /**
   * Process next job
   */
  async _processNext() {
    if (this.paused) return;
    if (this.processing.size >= this.concurrency) return;
    if (this.waiting.length === 0) return;

    const job = this.waiting.shift();
    await this._processJob(job);
  }

  /**
   * Process a job
   */
  async _processJob(job) {
    const processor = this.processors.get(job.name);
    if (!processor) {
      this.emit('job:no-processor', { job: job.id, name: job.name });
      this.waiting.unshift(job);
      return;
    }

    job.status = JobStatus.ACTIVE;
    job.processedAt = Date.now();
    job.attempts++;

    this.processing.set(job.id, job);
    this.emit('job:started', { job: job.id, attempts: job.attempts });

    try {
      const result = await processor.handler(job);

      job.status = JobStatus.COMPLETED;
      job.completedAt = Date.now();
      job.result = result;

      this.processing.delete(job.id);
      this.completed.push(job);

      this.emit('job:completed', { job: job.id, result, duration: job.completedAt - job.processedAt });

      // Cleanup old completed jobs
      this._cleanupCompleted();

    } catch (error) {
      job.error = error.message;

      if (job.attempts < job.maxAttempts) {
        // Retry with backoff
        const delay = job.getNextDelay();
        job.status = JobStatus.DELAYED;

        setTimeout(() => {
          job.status = JobStatus.WAITING;
          this.waiting.push(job);
          this._sortWaiting();
          this._processNext();
        }, delay);

        this.emit('job:retrying', { job: job.id, attempt: job.attempts, delay, error: error.message });

      } else {
        // Max attempts reached
        job.status = JobStatus.FAILED;
        job.failedAt = Date.now();

        this.processing.delete(job.id);
        this.failed.push(job);

        this.emit('job:failed', { job: job.id, error: error.message, attempts: job.attempts });
      }
    }

    // Process next
    this._processNext();
  }

  /**
   * Promote delayed jobs
   */
  _promoteDelayedJobs() {
    const now = Date.now();
    const toPromote = [];

    for (const job of this.delayed) {
      if (job.createdAt + job.delay <= now) {
        toPromote.push(job);
      }
    }

    for (const job of toPromote) {
      this._promoteDelayed(job);
    }
  }

  /**
   * Check for stalled jobs
   */
  _checkStalledJobs() {
    const now = Date.now();

    for (const [id, job] of this.processing) {
      if (now - job.processedAt > this.stallDuration) {
        job.status = JobStatus.STALLED;
        this.processing.delete(id);
        this.waiting.unshift(job);
        this.emit('job:stalled', { job: id });
      }
    }
  }

  /**
   * Cleanup old completed jobs
   */
  _cleanupCompleted() {
    const now = Date.now();

    this.completed = this.completed.filter(job => {
      return now - job.completedAt < this.maxCompletedAge;
    });

    this.failed = this.failed.filter(job => {
      return now - job.failedAt < this.maxFailedAge;
    });
  }

  /**
   * Start monitoring
   */
  _startMonitoring() {
    // Promote delayed jobs
    setInterval(() => this._promoteDelayedJobs(), 1000);

    // Check for stalled jobs
    setInterval(() => this._checkStalledJobs(), this.stallCheckInterval);
  }

  /**
   * Pause the queue
   */
  pause() {
    this.paused = true;
    this.emit('paused');
  }

  /**
   * Resume the queue
   */
  resume() {
    this.paused = false;
    this.emit('resumed');
    this._processNext();
  }

  /**
   * Get queue stats
   */
  getStats() {
    return {
      name: this.name,
      waiting: this.waiting.length,
      active: this.processing.size,
      delayed: this.delayed.length,
      completed: this.completed.length,
      failed: this.failed.length,
      paused: this.paused,
      rateLimit: {
        remaining: this.rateLimit.max - this.rateLimit.counter,
        resetIn: Math.max(0, this.rateLimit.resetAt - Date.now())
      }
    };
  }

  /**
   * Get job by ID
   */
  getJob(jobId) {
    return this.processing.get(jobId) ||
      this.waiting.find(j => j.id === jobId) ||
      this.completed.find(j => j.id === jobId) ||
      this.failed.find(j => j.id === jobId) ||
      this.delayed.find(j => j.id === jobId);
  }

  /**
   * Remove a job
   */
  removeJob(jobId) {
    // Remove from all lists
    this.waiting = this.waiting.filter(j => j.id !== jobId);
    this.delayed = this.delayed.filter(j => j.id !== jobId);
    this.completed = this.completed.filter(j => j.id !== jobId);
    this.failed = this.failed.filter(j => j.id !== jobId);

    if (this.processing.has(jobId)) {
      this.processing.delete(jobId);
    }

    return true;
  }

  /**
   * Empty the queue
   */
  async empty() {
    this.waiting = [];
    this.delayed = [];
    this.emit('emptied');
  }

  /**
   * Clean completed and failed jobs
   */
  clean() {
    this.completed = [];
    this.failed = [];
    this.emit('cleaned');
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// QUEUE MANAGER
// ═══════════════════════════════════════════════════════════════════════════

export class QueueManager extends EventEmitter {
  constructor() {
    super();
    this.queues = new Map();
  }

  /**
   * Create or get a queue
   */
  createQueue(name, options = {}) {
    if (this.queues.has(name)) {
      return this.queues.get(name);
    }

    const queue = new TaskQueue(name, options);

    // Forward events
    queue.on('job:added', (data) => this.emit('job:added', { ...data, queue: name }));
    queue.on('job:completed', (data) => this.emit('job:completed', { ...data, queue: name }));
    queue.on('job:failed', (data) => this.emit('job:failed', { ...data, queue: name }));

    this.queues.set(name, queue);
    return queue;
  }

  /**
   * Get a queue
   */
  getQueue(name) {
    return this.queues.get(name);
  }

  /**
   * Get all queues
   */
  getAllQueues() {
    return Array.from(this.queues.values());
  }

  /**
   * Get all stats
   */
  getAllStats() {
    const stats = {};
    for (const [name, queue] of this.queues) {
      stats[name] = queue.getStats();
    }
    return stats;
  }

  /**
   * Remove a queue
   */
  async removeQueue(name) {
    const queue = this.queues.get(name);
    if (queue) {
      await queue.empty();
      this.queues.delete(name);
    }
  }

  /**
   * Pause all queues
   */
  pauseAll() {
    for (const queue of this.queues.values()) {
      queue.pause();
    }
  }

  /**
   * Resume all queues
   */
  resumeAll() {
    for (const queue of this.queues.values()) {
      queue.resume();
    }
  }

  /**
   * Get combined stats for all queues
   */
  getCombinedStats() {
    const all = this.getAllStats();
    const combined = {
      totalQueues: this.queues.size,
      totalWaiting: 0,
      totalActive: 0,
      totalCompleted: 0,
      totalFailed: 0,
      totalDelayed: 0
    };

    for (const stats of Object.values(all)) {
      combined.totalWaiting += stats.waiting || 0;
      combined.totalActive += stats.active || 0;
      combined.totalCompleted += stats.completed || 0;
      combined.totalFailed += stats.failed || 0;
      combined.totalDelayed += stats.delayed || 0;
    }

    return combined;
  }

  /**
   * Schedule a job for later execution
   */
  async schedule(queueName, data, delayMs, options = {}) {
    const queue = this.getQueue(queueName) || this.createQueue(queueName);
    return queue.add(data, { ...options, delay: delayMs });
  }

  /**
   * Add bulk jobs to a queue
   */
  addBulk(queueName, jobs) {
    const queue = this.getQueue(queueName) || this.createQueue(queueName);
    const results = [];
    for (const job of jobs) {
      results.push(queue.add(job.data, job.options || {}));
    }
    return results;
  }

  /**
   * Get queue names
   */
  getQueueNames() {
    return Array.from(this.queues.keys());
  }

  /**
   * Drain a queue (process all jobs)
   */
  async drain(queueName) {
    const queue = this.getQueue(queueName);
    if (!queue) return { drained: 0 };
    const count = queue.waiting.length;
    await queue.process();
    return { drained: count };
  }
}

// Export singleton
let manager = null;

export function getQueueManager() {
  if (!manager) {
    manager = new QueueManager();
  }
  return manager;
}

export default {
  Job,
  TaskQueue,
  QueueManager,
  JobStatus,
  JobPriority,
  getQueueManager
};