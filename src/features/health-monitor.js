import { EventEmitter } from 'events';
import crypto from 'crypto';
import os from 'os';

export class HealthStatus {
  static OK = 'ok';
  static DEGRADED = 'degraded';
  static UNHEALTHY = 'unhealthy';
}

export class ComponentHealth {
  constructor(name) {
    this.name = name;
    this.status = HealthStatus.OK;
    this.message = null;
    this.lastCheck = Date.now();
    this.metrics = {};
    this.history = [];
    this.maxHistory = 100;
  }

  update(status, message = null, metrics = {}) {
    this.status = status;
    this.message = message;
    this.metrics = { ...this.metrics, ...metrics };
    this.lastCheck = Date.now();

    this.history.push({ status, message, timestamp: Date.now() });
    if (this.history.length > this.maxHistory) {
      this.history.shift();
    }
  }

  isHealthy() {
    return this.status === HealthStatus.OK;
  }
}

export class HealthMonitor extends EventEmitter {
  constructor(options = {}) {
    super();

    this.components = new Map();
    this.checks = new Map();
    this.interval = options.interval || 30000;
    this.timer = null;
    this.enabled = options.enabled !== false;

    this.registerDefaultChecks();
  }

  registerDefaultChecks() {
    this.registerCheck('memory', async () => {
      const usage = process.memoryUsage();
      const ratio = usage.heapUsed / usage.heapTotal;
      return {
        status: ratio > 0.9 ? HealthStatus.UNHEALTHY : ratio > 0.7 ? HealthStatus.DEGRADED : HealthStatus.OK,
        metrics: {
          heapUsed: Math.round(usage.heapUsed / 1024 / 1024) + 'MB',
          heapTotal: Math.round(usage.heapTotal / 1024 / 1024) + 'MB',
          ratio: (ratio * 100).toFixed(1) + '%'
        }
      };
    });

    this.registerCheck('uptime', async () => {
      const uptime = process.uptime();
      return {
        status: HealthStatus.OK,
        metrics: {
          uptime: Math.floor(uptime) + 's',
          startedAt: new Date(Date.now() - uptime * 1000).toISOString()
        }
      };
    });

    this.registerCheck('cpu', async () => {
      const load = os.loadavg();
      return {
        status: load[0] > 4 ? HealthStatus.DEGRADED : HealthStatus.OK,
        metrics: {
          load1m: load[0].toFixed(2),
          load5m: load[1].toFixed(2),
          load15m: load[2].toFixed(2)
        }
      };
    });
  }

  registerComponent(name) {
    const health = new ComponentHealth(name);
    this.components.set(name, health);
    return health;
  }

  registerCheck(name, checkFn) {
    this.checks.set(name, checkFn);
  }

  async check(componentName = null) {
    if (componentName) {
      return this.checkComponent(componentName);
    }

    const results = {};
    let overallStatus = HealthStatus.OK;

    for (const [name] of this.checks) {
      const result = await this.checkComponent(name);
      results[name] = result;

      if (result.status === HealthStatus.UNHEALTHY) {
        overallStatus = HealthStatus.UNHEALTHY;
      } else if (result.status === HealthStatus.DEGRADED && overallStatus !== HealthStatus.UNHEALTHY) {
        overallStatus = HealthStatus.DEGRADED;
      }
    }

    return {
      status: overallStatus,
      timestamp: Date.now(),
      components: results
    };
  }

  async checkComponent(name) {
    const checkFn = this.checks.get(name);
    if (!checkFn) {
      return { status: HealthStatus.OK, message: 'No check registered' };
    }

    try {
      const result = await checkFn();
      this.emit('check:complete', { name, result });
      return result;
    } catch (error) {
      return {
        status: HealthStatus.UNHEALTHY,
        message: error.message
      };
    }
  }

  start() {
    if (this.timer) return;
    this.enabled = true;

    this.timer = setInterval(async () => {
      await this.check();
    }, this.interval);

    this.emit('started');
  }

  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.enabled = false;
    this.emit('stopped');
  }

  getStatus() {
    const components = {};
    for (const [name, health] of this.components) {
      components[name] = {
        status: health.status,
        message: health.message,
        lastCheck: health.lastCheck,
        metrics: health.metrics
      };
    }

    return {
      enabled: this.enabled,
      components,
      checks: Array.from(this.checks.keys())
    };
  }

  createMiddleware() {
    return async (req, res, next) => {
      if (req.path === '/health' || req.path === '/healthz') {
        const status = await this.check();

        res.setHeader('Content-Type', 'application/json');
        res.setHeader('X-Health-Status', status.status);

        if (status.status === HealthStatus.UNHEALTHY) {
          return res.status(503).json(status);
        }

        return res.json(status);
      }
      next();
    };
  }
}

export class ReadinessProbe extends EventEmitter {
  constructor() {
    super();
    this.checks = [];
    this.status = false;
  }

  addCheck(name, checkFn) {
    this.checks.push({ name, checkFn });
  }

  async isReady() {
    for (const check of this.checks) {
      try {
        const result = await check.checkFn();
        if (!result) {
          this.emit('not:ready', { check: check.name });
          return false;
        }
      } catch (error) {
        this.emit('not:ready', { check: check.name, error: error.message });
        return false;
      }
    }

    this.status = true;
    this.emit('ready');
    return true;
  }

  async getStatus() {
    const results = [];
    let ready = true;

    for (const check of this.checks) {
      try {
        const result = await check.checkFn();
        results.push({ name: check.name, ready: result });
        if (!result) ready = false;
      } catch (error) {
        results.push({ name: check.name, ready: false, error: error.message });
        ready = false;
      }
    }

    return { ready, checks: results };
  }
}

export class LivenessProbe extends EventEmitter {
  constructor() {
    super();
    this.pings = 0;
    this.failures = 0;
    this.threshold = 3;
  }

  ping() {
    this.pings++;
    this.failures = 0;
    this.emit('ping', { pings: this.pings });
    return true;
  }

  markFailure() {
    this.failures++;
    this.emit('failure', { failures: this.failures });

    if (this.failures >= this.threshold) {
      this.emit('exceeded', { failures: this.failures });
      return false;
    }
    return true;
  }

  isAlive() {
    return this.failures < this.threshold;
  }

  getStatus() {
    return {
      alive: this.isAlive(),
      pings: this.pings,
      failures: this.failures,
      threshold: this.threshold
    };
  }
}

let healthMonitor = null;

export function getHealthMonitor(options = {}) {
  if (!healthMonitor) {
    healthMonitor = new HealthMonitor(options);
  }
  return healthMonitor;
}

export default { HealthMonitor, ComponentHealth, HealthStatus, ReadinessProbe, LivenessProbe, getHealthMonitor };
