import { EventEmitter } from 'events';

export class CronJob {
  constructor(config) {
    this.id = config.id || `cron_${Date.now()}`;
    this.name = config.name;
    this.schedule = config.schedule;
    this.handler = config.handler;
    this.enabled = config.enabled !== false;
    this.timezone = config.timezone || 'UTC';
    this.lastRun = null;
    this.nextRun = null;
    this.running = false;
    this.intervalId = null;
    this.stats = {
      totalRuns: 0,
      successfulRuns: 0,
      failedRuns: 0,
      averageDuration: 0,
      totalDuration: 0
    };
  }

  parseSchedule() {
    const parts = this.schedule.split(' ');
    if (parts.length !== 5) {
      throw new Error(`Invalid cron expression: ${this.schedule}`);
    }
    return {
      second: parts[0],
      minute: parts[1],
      hour: parts[2],
      dayOfMonth: parts[3],
      month: parts[4]
    };
  }

  matchesSchedule() {
    const now = new Date();
    const schedule = this.parseSchedule();

    const check = (value, current) => {
      if (value === '*') return true;
      if (value.includes(',')) return value.split(',').includes(current.toString());
      if (value.includes('-')) {
        const [start, end] = value.split('-').map(Number);
        return current >= start && current <= end;
      }
      if (value.includes('/')) {
        const [, step] = value.split('/');
        return current % parseInt(step) === 0;
      }
      return parseInt(value) === current;
    };

    return (
      check(schedule.second, now.getSeconds()) &&
      check(schedule.minute, now.getMinutes()) &&
      check(schedule.hour, now.getHours()) &&
      check(schedule.dayOfMonth, now.getDate()) &&
      check(schedule.month, now.getMonth() + 1)
    );
  }

  calculateNextRun() {
    const now = new Date();
    const next = new Date(now);
    next.setMinutes(next.getMinutes() + 1);
    next.setSeconds(0);
    this.nextRun = next.getTime();
  }

  async execute() {
    if (this.running || !this.enabled) return;

    this.running = true;
    const startTime = Date.now();

    try {
      await this.handler({
        lastRun: this.lastRun,
        nextRun: this.nextRun,
        stats: this.stats
      });

      this.stats.successfulRuns++;
      this.lastRun = Date.now();
    } catch (error) {
      this.stats.failedRuns++;
      throw error;
    } finally {
      const duration = Date.now() - startTime;
      this.stats.totalRuns++;
      this.stats.totalDuration += duration;
      this.stats.averageDuration = this.stats.totalDuration / this.stats.totalRuns;
      this.running = false;
    }
  }

  start() {
    this.enabled = true;
    this.calculateNextRun();

    this.intervalId = setInterval(() => {
      if (this.matchesSchedule()) {
        this.execute().catch(console.error);
      }
    }, 1000);
  }

  stop() {
    this.enabled = false;
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  getStatus() {
    return {
      id: this.id,
      name: this.name,
      schedule: this.schedule,
      enabled: this.enabled,
      running: this.running,
      lastRun: this.lastRun,
      nextRun: this.nextRun,
      stats: { ...this.stats }
    };
  }
}

export class Scheduler extends EventEmitter {
  constructor() {
    super();
    this.jobs = new Map();
    this.stats = {
      totalJobs: 0,
      enabledJobs: 0,
      totalRuns: 0
    };
  }

  addJob(config) {
    const job = new CronJob(config);

    if (config.autoStart !== false) {
      job.start();
      this.stats.enabledJobs++;
    }

    this.jobs.set(job.id, job);
    this.stats.totalJobs++;

    this.emit('job:added', job.getStatus());
    return job;
  }

  removeJob(jobId) {
    const job = this.jobs.get(jobId);
    if (job) {
      job.stop();
      this.jobs.delete(jobId);
      this.stats.totalJobs--;
      if (job.enabled) this.stats.enabledJobs--;
      this.emit('job:removed', { jobId });
    }
  }

  getJob(jobId) {
    return this.jobs.get(jobId);
  }

  getAllJobs() {
    return Array.from(this.jobs.values()).map(job => job.getStatus());
  }

  getEnabledJobs() {
    return Array.from(this.jobs.values())
      .filter(job => job.enabled)
      .map(job => job.getStatus());
  }

  pauseJob(jobId) {
    const job = this.jobs.get(jobId);
    if (job && job.enabled) {
      job.enabled = false;
      job.stop();
      this.stats.enabledJobs--;
      this.emit('job:paused', { jobId });
    }
  }

  resumeJob(jobId) {
    const job = this.jobs.get(jobId);
    if (job && !job.enabled) {
      job.enabled = true;
      job.start();
      this.stats.enabledJobs++;
      this.emit('job:resumed', { jobId });
    }
  }

  triggerJob(jobId) {
    const job = this.jobs.get(jobId);
    if (job) {
      return job.execute();
    }
    throw new Error(`Job not found: ${jobId}`);
  }

  getStats() {
    return {
      ...this.stats,
      jobs: this.getAllJobs()
    };
  }
}

export class DelayedTask {
  constructor(id, handler, delay, options = {}) {
    this.id = id;
    this.handler = handler;
    this.delay = delay;
    this.options = options;
    this.scheduledTime = Date.now() + delay;
    this.timeoutId = null;
    this.cancelled = false;
  }

  start() {
    this.timeoutId = setTimeout(() => {
      if (!this.cancelled) {
        this.handler(this.options.data);
      }
    }, this.delay);
  }

  cancel() {
    this.cancelled = true;
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }
  }
}

export class DelayedTaskManager {
  constructor() {
    this.tasks = new Map();
    this.stats = { totalTasks: 0, completedTasks: 0, cancelledTasks: 0 };
  }

  schedule(id, handler, delay, options = {}) {
    const task = new DelayedTask(id, handler, delay, options);
    task.start();
    this.tasks.set(id, task);
    this.stats.totalTasks++;

    task.timeoutId && setTimeout(() => {
      this.tasks.delete(id);
      this.stats.completedTasks++;
    }, delay);

    return task;
  }

  cancel(id) {
    const task = this.tasks.get(id);
    if (task) {
      task.cancel();
      this.tasks.delete(id);
      this.stats.cancelledTasks++;
    }
  }

  getStats() {
    return { ...this.stats, pendingTasks: this.tasks.size };
  }
}

let scheduler = null;

export function getScheduler() {
  if (!scheduler) {
    scheduler = new Scheduler();
  }
  return scheduler;
}

export default { Scheduler, CronJob, DelayedTask, DelayedTaskManager, getScheduler };
