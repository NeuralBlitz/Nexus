import { EventEmitter } from 'events';

export class MetricSeries {
  constructor(name, options = {}) {
    this.name = name;
    this.tags = options.tags || {};
    this.retention = options.retention || 1000;
    this.interval = options.interval || 1000;
    this.points = [];
    this.stats = {
      count: 0,
      sum: 0,
      min: Infinity,
      max: -Infinity
    };
  }

  push(value, timestamp = Date.now()) {
    this.points.push({ value, timestamp });

    this.stats.count++;
    this.stats.sum += value;
    this.stats.min = Math.min(this.stats.min, value);
    this.stats.max = Math.max(this.stats.max, value);

    if (this.points.length > this.retention) {
      this.points.shift();
    }
  }

  query(start, end) {
    return this.points
      .filter(p => p.timestamp >= start && p.timestamp <= end)
      .map(p => p.value);
  }

  getStats() {
    const values = this.points.map(p => p.value);
    if (values.length === 0) {
      return { ...this.stats, avg: 0 };
    }

    const sorted = [...values].sort((a, b) => a - b);
    const sum = values.reduce((a, b) => a + b, 0);

    return {
      count: values.length,
      sum,
      min: sorted[0],
      max: sorted[sorted.length - 1],
      avg: sum / values.length,
      p50: sorted[Math.floor(sorted.length * 0.5)],
      p95: sorted[Math.floor(sorted.length * 0.95)],
      p99: sorted[Math.floor(sorted.length * 0.99)]
    };
  }

  clear() {
    this.points = [];
    this.stats = { count: 0, sum: 0, min: Infinity, max: -Infinity };
  }
}

export class TimeSeriesDatabase extends EventEmitter {
  constructor(options = {}) {
    super();

    this.series = new Map();
    this.retention = options.retention || 604800000;
    this.aggregationInterval = options.aggregationInterval || 60000;
    this.aggregations = new Map();
    this.cleanupTimer = null;

    this.startCleanup();
  }

  seriesFor(name, tags = {}) {
    const key = this.makeKey(name, tags);
    if (!this.series.has(key)) {
      this.series.set(key, new MetricSeries(name, { tags }));
    }
    return this.series.get(key);
  }

  write(name, value, tags = {}, timestamp = Date.now()) {
    const series = this.seriesFor(name, tags);
    series.push(value, timestamp);
    this.emit('write', { name, value, tags, timestamp });
  }

  query(name, options = {}) {
    const { start = Date.now() - 3600000, end = Date.now(), tags = {} } = options;

    if (Object.keys(tags).length === 0) {
      const matching = Array.from(this.series.values())
        .filter(s => s.name === name);
      if (matching.length === 0) return [];
      return matching[0].query(start, end);
    }

    const key = this.makeKey(name, tags);
    const series = this.series.get(key);
    return series ? series.query(start, end) : [];
  }

  aggregate(name, interval = this.aggregationInterval) {
    const points = this.query(name);
    if (points.length === 0) return null;

    const buckets = new Map();

    for (const point of points) {
      const bucket = Math.floor(point.timestamp / interval) * interval;
      if (!buckets.has(bucket)) {
        buckets.set(bucket, []);
      }
      buckets.get(bucket).push(point.value);
    }

    return Array.from(buckets.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([timestamp, values]) => ({
        timestamp,
        count: values.length,
        min: Math.min(...values),
        max: Math.max(...values),
        avg: values.reduce((a, b) => a + b, 0) / values.length
      }));
  }

  downsample(name, resolution, aggregator = 'avg') {
    const points = this.query(name);
    if (points.length === 0) return [];

    const interval = resolution;
    const buckets = new Map();

    for (const point of points) {
      const bucket = Math.floor(point.timestamp / interval) * interval;
      if (!buckets.has(bucket)) {
        buckets.set(bucket, []);
      }
      buckets.get(bucket).push(point.value);
    }

    return Array.from(buckets.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([timestamp, values]) => {
        switch (aggregator) {
          case 'min': return { timestamp, value: Math.min(...values) };
          case 'max': return { timestamp, value: Math.max(...values) };
          case 'count': return { timestamp, value: values.length };
          case 'sum': return { timestamp, value: values.reduce((a, b) => a + b, 0) };
          default: return { timestamp, value: values.reduce((a, b) => a + b, 0) / values.length };
        }
      });
  }

  makeKey(name, tags) {
    const tagStr = Object.entries(tags)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([k, v]) => `${k}:${v}`)
      .join(',');
    return tagStr ? `${name}{${tagStr}}` : name;
  }

  cleanup() {
    const cutoff = Date.now() - this.retention;
    let cleaned = 0;

    for (const series of this.series.values()) {
      const originalLength = series.points.length;
      series.points = series.points.filter(p => p.timestamp > cutoff);
      cleaned += originalLength - series.points.length;
    }

    return cleaned;
  }

  startCleanup() {
    this.cleanupTimer = setInterval(() => {
      this.cleanup();
    }, this.aggregationInterval);
  }

  stopCleanup() {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
  }

  getStats() {
    return {
      series: this.series.size,
      totalPoints: Array.from(this.series.values()).reduce((sum, s) => sum + s.points.length, 0),
      retention: this.retention
    };
  }

  export(format = 'json') {
    const data = {};
    for (const [key, series] of this.series) {
      data[key] = series.points;
    }
    return data;
  }
}

export class Dashboard extends EventEmitter {
  constructor(name, options = {}) {
    super();

    this.name = name;
    this.widgets = [];
    this.refreshInterval = options.refreshInterval || 30000;
    this.autoRefresh = options.autoRefresh !== false;
    this.filters = options.filters || {};
  }

  addWidget(widget) {
    this.widgets.push(widget);
    return this;
  }

  addMetric(name, options = {}) {
    return this.addWidget({
      type: 'metric',
      metric: name,
      aggregation: options.aggregation || 'avg',
      display: options.display || 'value',
      ...options
    });
  }

  addChart(name, options = {}) {
    return this.addWidget({
      type: 'chart',
      metric: name,
      chartType: options.chartType || 'line',
      ...options
    });
  }

  addTable(columns, dataQuery) {
    return this.addWidget({
      type: 'table',
      columns,
      query: dataQuery
    });
  }

  getConfiguration() {
    return {
      name: this.name,
      widgets: this.widgets,
      filters: this.filters,
      refreshInterval: this.refreshInterval
    };
  }
}

let tsdb = null;

export function getTimeSeriesDatabase(options = {}) {
  if (!tsdb) {
    tsdb = new TimeSeriesDatabase(options);
  }
  return tsdb;
}

export default { TimeSeriesDatabase, MetricSeries, Dashboard, getTimeSeriesDatabase };
