#!/usr/bin/env node

import { EventEmitter } from 'events';
import crypto from 'crypto';
import os from 'os';

// ═══════════════════════════════════════════════════════════════════════════
// ADVANCED MONITORING & OBSERVABILITY SYSTEM
// Metrics, Tracing, Logging, Alerts, Health Checks, Dashboards
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Metric types
 */
export const MetricType = {
  COUNTER: 'counter',     // Monotonically increasing
  GAUGE: 'gauge',         // Can go up or down
  HISTOGRAM: 'histogram', // Distribution of values
  SUMMARY: 'summary'      // Pre-computed quantiles
};

/**
 * Alert severity levels
 */
export const AlertSeverity = {
  INFO: 'info',
  WARNING: 'warning',
  ERROR: 'error',
  CRITICAL: 'critical'
};

/**
 * Metric Collector
 */
export class Metric {
  constructor(name, type, options = {}) {
    this.name = name;
    this.type = type;
    this.description = options.description || '';
    this.labels = options.labels || [];
    this.buckets = options.buckets || [0.1, 0.5, 1, 5, 10, 30, 60];
    this.quantiles = options.quantiles || [0.5, 0.9, 0.99];

    // Storage
    this.values = new Map(); // labelKey -> values[]
    this.counters = new Map();
    this.gauges = new Map();
    this.histograms = new Map();

    // Metadata
    this.createdAt = Date.now();
    this.lastUpdated = Date.now();
  }

  /**
   * Record a value
   */
  record(value, labels = {}) {
    const labelKey = this._getLabelKey(labels);

    switch (this.type) {
      case MetricType.COUNTER:
        const current = this.counters.get(labelKey) || 0;
        this.counters.set(labelKey, current + value);
        break;

      case MetricType.GAUGE:
        this.gauges.set(labelKey, value);
        break;

      case MetricType.HISTOGRAM:
        if (!this.histograms.has(labelKey)) {
          this.histograms.set(labelKey, {
            count: 0,
            sum: 0,
            buckets: new Map(this.buckets.map(b => [b, 0]))
          });
        }
        const hist = this.histograms.get(labelKey);
        hist.count++;
        hist.sum += value;
        for (const bucket of this.buckets) {
          if (value <= bucket) {
            hist.buckets.set(bucket, hist.buckets.get(bucket) + 1);
          }
        }
        break;

      case MetricType.SUMMARY:
        if (!this.values.has(labelKey)) {
          this.values.set(labelKey, []);
        }
        this.values.get(labelKey).push(value);
        // Keep only last 1000 values
        if (this.values.get(labelKey).length > 1000) {
          this.values.set(labelKey, this.values.get(labelKey).slice(-1000));
        }
        break;
    }

    this.lastUpdated = Date.now();
  }

  /**
   * Get current value
   */
  getValue(labels = {}) {
    const labelKey = this._getLabelKey(labels);

    switch (this.type) {
      case MetricType.COUNTER:
        return this.counters.get(labelKey) || 0;

      case MetricType.GAUGE:
        return this.gauges.get(labelKey) || 0;

      case MetricType.HISTOGRAM:
        return this.histograms.get(labelKey) || { count: 0, sum: 0, buckets: {} };

      case MetricType.SUMMARY:
        const values = this.values.get(labelKey) || [];
        if (values.length === 0) return null;
        return this._calculateQuantiles(values);
    }
  }

  /**
   * Get all values
   */
  getAllValues() {
    const result = {};

    for (const [key, value] of this.counters) {
      result[`counter:${this.name}:${key}`] = value;
    }

    for (const [key, value] of this.gauges) {
      result[`gauge:${this.name}:${key}`] = value;
    }

    return result;
  }

  /**
   * Calculate quantiles
   */
  _calculateQuantiles(values) {
    const sorted = [...values].sort((a, b) => a - b);
    const result = {};

    for (const q of this.quantiles) {
      const idx = Math.floor(sorted.length * q);
      result[`p${q * 100}`] = sorted[idx] || 0;
    }

    result.count = sorted.length;
    result.sum = sorted.reduce((a, b) => a + b, 0);
    result.avg = result.sum / result.count;
    result.min = sorted[0];
    result.max = sorted[sorted.length - 1];

    return result;
  }

  /**
   * Generate label key
   */
  _getLabelKey(labels) {
    if (Object.keys(labels).length === 0) return 'default';
    return Object.entries(labels)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`)
      .join(',');
  }

  /**
   * Reset metric
   */
  reset() {
    this.values.clear();
    this.counters.clear();
    this.gauges.clear();
    this.histograms.clear();
  }

  /**
   * Export metric
   */
  export() {
    return {
      name: this.name,
      type: this.type,
      description: this.description,
      counters: Object.fromEntries(this.counters),
      gauges: Object.fromEntries(this.gauges),
      createdAt: this.createdAt,
      lastUpdated: this.lastUpdated
    };
  }
}

/**
 * Trace Span
 */
export class TraceSpan {
  constructor(config) {
    this.traceId = config.traceId || crypto.randomBytes(16).toString('hex');
    this.spanId = config.spanId || crypto.randomBytes(8).toString('hex');
    this.parentId = config.parentId || null;
    this.name = config.name;
    this.service = config.service || 'nexus';
    this.startTime = Date.now();
    this.endTime = null;
    this.duration = null;
    this.tags = config.tags || {};
    this.logs = [];
    this.status = 'ok';
  }

  /**
   * Add a log entry
   */
  log(fields, message) {
    this.logs.push({
      timestamp: Date.now(),
      fields,
      message
    });
  }

  /**
   * Set tag
   */
  setTag(key, value) {
    this.tags[key] = value;
  }

  /**
   * Set error
   */
  setError(error) {
    this.status = 'error';
    this.tags['error'] = true;
    this.tags['error.message'] = error.message || error;
    this.tags['error.stack'] = error.stack;
  }

  /**
   * Finish span
   */
  finish() {
    this.endTime = Date.now();
    this.duration = this.endTime - this.startTime;
  }

  /**
   * Create child span
   */
  createChild(name, tags = {}) {
    return new TraceSpan({
      traceId: this.traceId,
      parentId: this.spanId,
      name,
      service: this.service,
      tags
    });
  }

  /**
   * Export span
   */
  export() {
    return {
      traceId: this.traceId,
      spanId: this.spanId,
      parentId: this.parentId,
      name: this.name,
      service: this.service,
      startTime: this.startTime,
      endTime: this.endTime,
      duration: this.duration,
      tags: this.tags,
      logs: this.logs,
      status: this.status
    };
  }
}

/**
 * Tracer
 */
export class Tracer {
  constructor() {
    this.spans = new Map(); // traceId -> spans[]
    this.activeSpans = new Map(); // spanId -> span
  }

  /**
   * Start a new trace
   */
  startTrace(name, tags = {}) {
    const span = new TraceSpan({ name, tags });
    this._addSpan(span);
    return span;
  }

  /**
   * Start a span within a trace
   */
  startSpan(name, traceId, tags = {}) {
    const span = new TraceSpan({ name, traceId, tags });
    this._addSpan(span);
    return span;
  }

  /**
   * Add span to storage
   */
  _addSpan(span) {
    if (!this.spans.has(span.traceId)) {
      this.spans.set(span.traceId, []);
    }
    this.spans.get(span.traceId).push(span);
    this.activeSpans.set(span.spanId, span);
  }

  /**
   * Finish a span
   */
  finishSpan(span) {
    span.finish();
    this.activeSpans.delete(span.spanId);
  }

  /**
   * Get trace
   */
  getTrace(traceId) {
    return this.spans.get(traceId) || [];
  }

  /**
   * Get trace tree
   */
  getTraceTree(traceId) {
    const spans = this.getTrace(traceId);
    if (spans.length === 0) return null;

    const spanMap = new Map();
    const roots = [];

    // Index spans
    for (const span of spans) {
      spanMap.set(span.spanId, { ...span, children: [] });
    }

    // Build tree
    for (const span of spans) {
      const node = spanMap.get(span.spanId);
      if (span.parentId && spanMap.has(span.parentId)) {
        spanMap.get(span.parentId).children.push(node);
      } else {
        roots.push(node);
      }
    }

    return roots;
  }

  /**
   * Get slow traces
   */
  getSlowTraces(threshold = 1000) {
    const slowTraces = [];

    for (const [traceId, spans] of this.spans) {
      const rootSpan = spans.find(s => !s.parentId);
      if (rootSpan && rootSpan.duration && rootSpan.duration > threshold) {
        slowTraces.push({
          traceId,
          duration: rootSpan.duration,
          spans: spans.length
        });
      }
    }

    return slowTraces.sort((a, b) => b.duration - a.duration);
  }

  /**
   * Clear old traces
   */
  cleanup(maxAge = 3600000) {
    const cutoff = Date.now() - maxAge;

    for (const [traceId, spans] of this.spans) {
      const rootSpan = spans.find(s => !s.parentId);
      if (rootSpan && rootSpan.startTime < cutoff) {
        this.spans.delete(traceId);
      }
    }
  }
}

/**
 * Alert Rule
 */
export class AlertRule {
  constructor(config) {
    this.id = config.id || `alert_${crypto.randomBytes(6).toString('hex')}`;
    this.name = config.name;
    this.description = config.description || '';
    this.severity = config.severity || AlertSeverity.WARNING;
    this.condition = config.condition; // Function that returns boolean
    this.metric = config.metric;
    this.threshold = config.threshold;
    this.operator = config.operator || 'gt'; // gt, lt, gte, lte, eq
    this.duration = config.duration || 0; // How long condition must be true
    this.enabled = config.enabled !== false;

    // State
    this.state = 'inactive';
    this.triggeredAt = null;
    this.resolvedAt = null;
    this.lastChecked = null;
    this.triggerCount = 0;

    // Notifications
    this.notifiers = config.notifiers || [];
  }

  /**
   * Check condition
   */
  check(value) {
    this.lastChecked = Date.now();

    let conditionMet = false;

    switch (this.operator) {
      case 'gt': conditionMet = value > this.threshold; break;
      case 'lt': conditionMet = value < this.threshold; break;
      case 'gte': conditionMet = value >= this.threshold; break;
      case 'lte': conditionMet = value <= this.threshold; break;
      case 'eq': conditionMet = value === this.threshold; break;
      default: conditionMet = false;
    }

    if (conditionMet) {
      if (this.state === 'inactive') {
        this.state = 'pending';
        this.triggeredAt = Date.now();
      } else if (this.state === 'pending') {
        // Check if duration has passed
        if (Date.now() - this.triggeredAt >= this.duration) {
          this.state = 'firing';
          this.triggerCount++;
        }
      }
    } else {
      if (this.state !== 'inactive') {
        this.state = 'inactive';
        this.resolvedAt = Date.now();
        this.triggeredAt = null;
      }
    }

    return this.state === 'firing';
  }

  /**
   * Get status
   */
  getStatus() {
    return {
      id: this.id,
      name: this.name,
      severity: this.severity,
      state: this.state,
      metric: this.metric,
      threshold: this.threshold,
      operator: this.operator,
      triggeredAt: this.triggeredAt,
      resolvedAt: this.resolvedAt,
      lastChecked: this.lastChecked,
      triggerCount: this.triggerCount,
      enabled: this.enabled
    };
  }
}

/**
 * Health Check
 */
export class HealthCheck {
  constructor(config) {
    this.name = config.name;
    this.check = config.check; // Async function returning { healthy, message }
    this.interval = config.interval || 30000;
    this.timeout = config.timeout || 10000;
    this.critical = config.critical !== false;

    // State
    this.lastCheck = null;
    this.lastResult = null;
    this.consecutiveFailures = 0;
    this.totalChecks = 0;
    this.totalFailures = 0;
  }

  /**
   * Run check
   */
  async run() {
    this.lastCheck = Date.now();
    this.totalChecks++;

    try {
      const result = await Promise.race([
        this.check(),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Health check timeout')), this.timeout)
        )
      ]);

      this.lastResult = {
        healthy: result.healthy !== false,
        message: result.message || (result.healthy ? 'OK' : 'Check failed'),
        timestamp: Date.now()
      };

      if (this.lastResult.healthy) {
        this.consecutiveFailures = 0;
      } else {
        this.consecutiveFailures++;
        this.totalFailures++;
      }

    } catch (error) {
      this.lastResult = {
        healthy: false,
        message: error.message,
        timestamp: Date.now()
      };
      this.consecutiveFailures++;
      this.totalFailures++;
    }

    return this.lastResult;
  }

  /**
   * Get status
   */
  getStatus() {
    return {
      name: this.name,
      critical: this.critical,
      lastCheck: this.lastCheck,
      lastResult: this.lastResult,
      consecutiveFailures: this.consecutiveFailures,
      totalChecks: this.totalChecks,
      totalFailures: this.totalFailures,
      successRate: this.totalChecks > 0 
        ? ((this.totalChecks - this.totalFailures) / this.totalChecks * 100).toFixed(2) + '%'
        : 'N/A'
    };
  }
}

/**
 * Monitoring System
 */
export class MonitoringSystem extends EventEmitter {
  constructor(options = {}) {
    super();

    // Metrics
    this.metrics = new Map();
    this.customMetrics = new Map();

    // Tracing
    this.tracer = new Tracer();

    // Alerts
    this.alerts = new Map();
    this.alertHistory = [];
    this.maxAlertHistory = options.maxAlertHistory || 1000;

    // Health checks
    this.healthChecks = new Map();

    // System metrics collection
    this.systemMetricsInterval = null;
    this.enableSystemMetrics = options.enableSystemMetrics !== false;

    // Start system metrics collection
    if (this.enableSystemMetrics) {
      this._startSystemMetricsCollection();
    }

    // Initialize built-in metrics
    this._initBuiltinMetrics();
  }

  /**
   * Initialize built-in metrics
   */
  _initBuiltinMetrics() {
    // HTTP metrics
    this.registerMetric('http_requests_total', MetricType.COUNTER, {
      description: 'Total HTTP requests'
    });

    this.registerMetric('http_request_duration_seconds', MetricType.HISTOGRAM, {
      description: 'HTTP request duration',
      buckets: [0.01, 0.05, 0.1, 0.5, 1, 5]
    });

    // Agent metrics
    this.registerMetric('agent_tasks_total', MetricType.COUNTER, {
      description: 'Total agent tasks'
    });

    this.registerMetric('agent_task_duration_seconds', MetricType.HISTOGRAM, {
      description: 'Agent task duration'
    });

    // Provider metrics
    this.registerMetric('provider_requests_total', MetricType.COUNTER, {
      description: 'Total provider requests'
    });

    this.registerMetric('provider_tokens_total', MetricType.COUNTER, {
      description: 'Total tokens processed'
    });

    // System metrics
    this.registerMetric('system_memory_bytes', MetricType.GAUGE, {
      description: 'System memory usage'
    });

    this.registerMetric('system_cpu_usage', MetricType.GAUGE, {
      description: 'System CPU usage'
    });
  }

  /**
   * Register a metric
   */
  registerMetric(name, type, options = {}) {
    const metric = new Metric(name, type, options);
    this.metrics.set(name, metric);
    return metric;
  }

  /**
   * Get metric
   */
  getMetric(name) {
    return this.metrics.get(name);
  }

  /**
   * Record metric
   */
  record(name, value, labels = {}) {
    const metric = this.metrics.get(name);
    if (metric) {
      metric.record(value, labels);
    }
  }

  /**
   * Increment counter
   */
  increment(name, labels = {}) {
    this.record(name, 1, labels);
  }

  /**
   * Set gauge value
   */
  setGauge(name, value, labels = {}) {
    this.record(name, value, labels);
  }

  /**
   * Observe histogram
   */
  observe(name, value, labels = {}) {
    this.record(name, value, labels);
  }

  /**
   * Start a trace
   */
  startTrace(name, tags = {}) {
    return this.tracer.startTrace(name, tags);
  }

  /**
   * Start a span
   */
  startSpan(name, traceId, tags = {}) {
    return this.tracer.startSpan(name, traceId, tags);
  }

  /**
   * Register alert rule
   */
  registerAlert(alertConfig) {
    const alert = new AlertRule(alertConfig);
    this.alerts.set(alert.id, alert);
    return alert;
  }

  /**
   * Check all alerts
   */
  checkAlerts() {
    const firingAlerts = [];

    for (const [id, alert] of this.alerts) {
      if (!alert.enabled) continue;

      const metric = this.metrics.get(alert.metric);
      if (!metric) continue;

      const value = metric.getValue();

      try {
        const isFiring = alert.check(typeof value === 'object' ? value?.count || 0 : value || 0);

        if (isFiring) {
          firingAlerts.push(alert.getStatus());
          this._triggerAlert(alert);
        }
      } catch (error) {
        // Ignore check errors
      }
    }

    return firingAlerts;
  }

  /**
   * Trigger alert
   */
  _triggerAlert(alert) {
    const alertEvent = {
      id: crypto.randomBytes(6).toString('hex'),
      alertId: alert.id,
      name: alert.name,
      severity: alert.severity,
      message: `Alert ${alert.name} is firing`,
      timestamp: Date.now()
    };

    this.alertHistory.push(alertEvent);

    // Keep history size in check
    if (this.alertHistory.length > this.maxAlertHistory) {
      this.alertHistory = this.alertHistory.slice(-this.maxAlertHistory);
    }

    this.emit('alert:triggered', alertEvent);
  }

  /**
   * Register health check
   */
  registerHealthCheck(config) {
    const check = new HealthCheck(config);
    this.healthChecks.set(config.name, check);
    return check;
  }

  /**
   * Run all health checks
   */
  async runHealthChecks() {
    const results = {};

    for (const [name, check] of this.healthChecks) {
      results[name] = await check.run();
    }

    return results;
  }

  /**
   * Get overall health
   */
  async getHealth() {
    const results = await this.runHealthChecks();

    const checks = Object.values(results);
    const healthy = checks.every(c => c.healthy);
    const criticalHealthy = checks.filter(c => c.critical).every(c => c.healthy);

    return {
      status: healthy ? 'healthy' : (criticalHealthy ? 'degraded' : 'unhealthy'),
      checks: results,
      timestamp: Date.now()
    };
  }

  /**
   * Start system metrics collection
   */
  _startSystemMetricsCollection() {
    this.systemMetricsInterval = setInterval(() => {
      this._collectSystemMetrics();
    }, 15000); // Every 15 seconds
  }

  /**
   * Collect system metrics
   */
  _collectSystemMetrics() {
    // Memory
    const memUsage = process.memoryUsage();
    this.setGauge('system_memory_bytes', memUsage.heapUsed, { type: 'heap' });
    this.setGauge('system_memory_bytes', memUsage.rss, { type: 'rss' });
    this.setGauge('system_memory_bytes', memUsage.external, { type: 'external' });

    // CPU
    const cpuUsage = process.cpuUsage();
    const totalCpu = (cpuUsage.user + cpuUsage.system) / 1000000; // Convert to seconds
    this.setGauge('system_cpu_usage', totalCpu);

    // System load
    const loadAvg = os.loadavg();
    this.setGauge('system_load_1m', loadAvg[0]);
    this.setGauge('system_load_5m', loadAvg[1]);
    this.setGauge('system_load_15m', loadAvg[2]);

    // Uptime
    this.setGauge('process_uptime_seconds', process.uptime());

    // Event loop lag
    const start = process.hrtime.bigint();
    setImmediate(() => {
      const lag = Number(process.hrtime.bigint() - start) / 1000000; // ms
      this.setGauge('event_loop_lag_ms', lag);
    });
  }

  /**
   * Get all metrics in Prometheus format
   */
  getMetricsPrometheus() {
    const lines = [];

    for (const [name, metric] of this.metrics) {
      lines.push(`# HELP ${name} ${metric.description}`);
      lines.push(`# TYPE ${name} ${metric.type}`);

      const values = metric.getAllValues();
      for (const [key, value] of Object.entries(values)) {
        lines.push(`${key} ${value}`);
      }
    }

    return lines.join('\n');
  }

  /**
   * Get metrics summary
   */
  getMetricsSummary() {
    const summary = {};

    for (const [name, metric] of this.metrics) {
      summary[name] = {
        type: metric.type,
        value: metric.getValue(),
        lastUpdated: metric.lastUpdated
      };
    }

    return summary;
  }

  /**
   * Get alerts summary
   */
  getAlertsSummary() {
    const alerts = Array.from(this.alerts.values());

    return {
      total: alerts.length,
      enabled: alerts.filter(a => a.enabled).length,
      firing: alerts.filter(a => a.state === 'firing').length,
      pending: alerts.filter(a => a.state === 'pending').length,
      inactive: alerts.filter(a => a.state === 'inactive').length,
      recentHistory: this.alertHistory.slice(-20)
    };
  }

  /**
   * Get full dashboard data
   */
  async getDashboard() {
    const health = await this.getHealth();
    const metrics = this.getMetricsSummary();
    const alerts = this.getAlertsSummary();
    const slowTraces = this.tracer.getSlowTraces(1000);

    return {
      health,
      metrics,
      alerts,
      performance: {
        slowTraces: slowTraces.slice(0, 10),
        activeSpans: this.tracer.activeSpans.size,
        totalTraces: this.tracer.spans.size
      },
      timestamp: Date.now()
    };
  }

  /**
   * Stop monitoring
   */
  stop() {
    if (this.systemMetricsInterval) {
      clearInterval(this.systemMetricsInterval);
    }
  }

  /**
   * Get metrics in JSON format for export
   */
  getMetricsJSON() {
    const metrics = {};
    for (const [name, metric] of this.metrics) {
      metrics[name] = {
        type: metric.type,
        value: metric.value,
        labels: Object.fromEntries(metric.labels),
        lastUpdated: metric.lastUpdated
      };
    }
    return { timestamp: Date.now(), metrics };
  }

  /**
   * Create a histogram observation
   */
  observeHistogram(name, value, labels = {}) {
    const metric = this.getMetric(name);
    if (metric) {
      metric.observe(value, labels);
    }
  }

  /**
   * Get top N slowest traces
   */
  getSlowTraces(n = 10) {
    return Array.from(this.traces.values())
      .map(trace => ({
        traceId: trace.traceId,
        name: trace.name,
        duration: trace.endTime ? trace.endTime - trace.startTime : Date.now() - trace.startTime,
        spanCount: trace.spans.size,
        error: trace.error
      }))
      .sort((a, b) => b.duration - a.duration)
      .slice(0, n);
  }

  /**
   * Reset all metrics
   */
  resetAll() {
    for (const metric of this.metrics.values()) {
      metric.reset();
    }
    this.traces.clear();
    this.alertHistory = [];
    this.emit('monitoring:reset');
  }

  /**
   * Export metrics to Prometheus text format
   */
  exportPrometheus() {
    const lines = [];
    for (const [name, metric] of this.metrics) {
      const help = `# HELP ${name} ${metric.description || ''}`;
      const type = `# TYPE ${name} ${metric.type}`;
      lines.push(help, type);

      if (metric.type === 'counter' || metric.type === 'gauge') {
        const labels = Array.from(metric.labels.entries())
          .map(([k, v]) => `${k}="${v}"`).join(',');
        const labelStr = labels ? `{${labels}}` : '';
        lines.push(`${name}${labelStr} ${metric.value}`);
      } else if (metric.type === 'histogram' && metric.buckets) {
        for (const [bound, count] of Object.entries(metric.buckets)) {
          lines.push(`${name}_bucket{le="${bound}"} ${count}`);
        }
        lines.push(`${name}_count ${metric.count}`);
        lines.push(`${name}_sum ${metric.sum}`);
      }
    }
    return lines.join('\n');
  }
}

// Export singleton
let monitoring = null;

export function getMonitoringSystem(options) {
  if (!monitoring) {
    monitoring = new MonitoringSystem(options);
  }
  return monitoring;
}

export default {
  MonitoringSystem,
  Metric,
  MetricType,
  TraceSpan,
  Tracer,
  AlertRule,
  AlertSeverity,
  HealthCheck,
  getMonitoringSystem
};