import { EventEmitter } from 'events';

export class AnalyticsEvent {
  constructor(name, properties = {}, options = {}) {
    this.id = options.id || `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    this.name = name;
    this.properties = properties;
    this.timestamp = Date.now();
    this.userId = options.userId;
    this.sessionId = options.sessionId;
    this.context = options.context || {};
  }

  toJSON() {
    return {
      id: this.id,
      name: this.name,
      properties: this.properties,
      timestamp: this.timestamp,
      userId: this.userId,
      sessionId: this.sessionId,
      context: this.context
    };
  }
}

export class AnalyticsTracker extends EventEmitter {
  constructor(options = {}) {
    super();

    this.events = [];
    this.maxEvents = options.maxEvents || 100000;
    this.sessionId = options.sessionId || this.generateSessionId();
    this.userId = options.userId;

    this.stats = {
      totalEvents: 0,
      eventsByName: new Map(),
      eventsByHour: new Map(),
      uniqueUsers: new Set(),
      avgEventsPerSession: 0
    };
  }

  generateSessionId() {
    return `sess_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  setUser(userId) {
    this.userId = userId;
    this.stats.uniqueUsers.add(userId);
  }

  track(name, properties = {}, options = {}) {
    const event = new AnalyticsEvent(name, properties, {
      ...options,
      userId: options.userId || this.userId,
      sessionId: options.sessionId || this.sessionId
    });

    this.events.push(event);
    this.updateStats(event);

    if (this.events.length > this.maxEvents) {
      this.events.shift();
    }

    this.emit('event', event);
    return event;
  }

  updateStats(event) {
    this.stats.totalEvents++;

    const count = this.stats.eventsByName.get(event.name) || 0;
    this.stats.eventsByName.set(event.name, count + 1);

    const hour = new Date(event.timestamp).getHours();
    const hourCount = this.stats.eventsByHour.get(hour) || 0;
    this.stats.eventsByHour.set(hour, hourCount + 1);

    if (event.userId) {
      this.stats.uniqueUsers.add(event.userId);
    }
  }

  page(name, properties = {}) {
    return this.track('page_view', { name, ...properties });
  }

  identify(userId, traits = {}) {
    this.setUser(userId);
    return this.track('user_identified', { userId, traits });
  }

  alias(fromId, toId) {
    return this.track('user_alias', { fromId, toId });
  }

  group(groupId, traits = {}) {
    return this.track('group_identified', { groupId, traits });
  }

  query(filters = {}) {
    let results = [...this.events];

    if (filters.name) {
      results = results.filter(e => e.name === filters.name);
    }
    if (filters.userId) {
      results = results.filter(e => e.userId === filters.userId);
    }
    if (filters.startTime) {
      results = results.filter(e => e.timestamp >= filters.startTime);
    }
    if (filters.endTime) {
      results = results.filter(e => e.timestamp <= filters.endTime);
    }

    return results.sort((a, b) => b.timestamp - a.timestamp);
  }

  getFunnel(steps) {
    const funnels = new Map();

    for (const step of steps) {
      const events = this.events.filter(e => e.name === step.event);
      funnels.set(step.name, events.length);
    }

    return {
      steps: Array.from(funnels.entries()).map(([name, count]) => ({ name, count })),
      conversionRate: funnels.size > 1
        ? ((Array.from(funnels.values())[Array.from(funnels.values()).length - 1] / Array.from(funnels.values())[0]) * 100).toFixed(2) + '%'
        : '100%'
    };
  }

  getRetention(cohorts = []) {
    const retention = new Map();

    for (const cohort of cohorts) {
      const initial = this.events.filter(e =>
        e.userId === cohort.userId && e.timestamp >= cohort.start
      );

      const retained = this.events.filter(e =>
        e.userId === cohort.userId && e.timestamp >= cohort.end
      );

      retention.set(cohort.userId, {
        initial: initial.length,
        retained: retained.length,
        rate: initial.length > 0 ? ((retained.length / initial.length) * 100).toFixed(2) + '%' : '0%'
      });
    }

    return Array.from(retention.entries()).map(([userId, data]) => ({ userId, ...data }));
  }

  getStats() {
    const topEvents = Array.from(this.stats.eventsByName.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([name, count]) => ({ name, count }));

    const peakHours = Array.from(this.stats.eventsByHour.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([hour, count]) => ({ hour, count }));

    return {
      totalEvents: this.stats.totalEvents,
      uniqueUsers: this.stats.uniqueUsers.size,
      sessionId: this.sessionId,
      currentUser: this.userId,
      topEvents,
      peakHours,
      eventsStored: this.events.length
    };
  }

  export() {
    return this.events.map(e => e.toJSON());
  }

  clear() {
    this.events = [];
    this.stats.totalEvents = 0;
    this.stats.eventsByName.clear();
    this.stats.eventsByHour.clear();
    this.emit('cleared');
  }
}

export class MetricsCollector extends EventEmitter {
  constructor() {
    super();
    this.metrics = new Map();
    this.counters = new Map();
    this.gauges = new Map();
    this.histograms = new Map();
    this.timers = new Map();
  }

  increment(name, value = 1, tags = {}) {
    const key = this.makeKey(name, tags);
    const current = this.counters.get(key) || 0;
    this.counters.set(key, current + value);
    this.emit('counter', { name, value, tags });
  }

  decrement(name, value = 1, tags = {}) {
    this.increment(name, -value, tags);
  }

  gauge(name, value, tags = {}) {
    const key = this.makeKey(name, tags);
    this.gauges.set(key, { value, timestamp: Date.now() });
    this.emit('gauge', { name, value, tags });
  }

  timing(name, value, tags = {}) {
    const key = this.makeKey(name, tags);
    const current = this.timers.get(key) || [];
    current.push(value);
    if (current.length > 1000) current.shift();
    this.timers.set(key, current);
    this.emit('timing', { name, value, tags });
  }

  histogram(name, value, tags = {}) {
    const key = this.makeKey(name, tags);
    const current = this.histograms.get(key) || [];
    current.push(value);
    if (current.length > 10000) current.shift();
    this.histograms.set(key, current);
    this.emit('histogram', { name, value, tags });
  }

  measure(name, fn, tags = {}) {
    const start = Date.now();
    try {
      const result = fn();
      this.timing(name, Date.now() - start, tags);
      return result;
    } catch (error) {
      this.timing(name, Date.now() - start, tags);
      throw error;
    }
  }

  async measureAsync(name, fn, tags = {}) {
    const start = Date.now();
    try {
      const result = await fn();
      this.timing(name, Date.now() - start, tags);
      return result;
    } catch (error) {
      this.timing(name, Date.now() - start, tags);
      throw error;
    }
  }

  makeKey(name, tags) {
    const tagStr = Object.entries(tags)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([k, v]) => `${k}:${v}`)
      .join(',');
    return tagStr ? `${name}{${tagStr}}` : name;
  }

  getCounter(name, tags = {}) {
    return this.counters.get(this.makeKey(name, tags)) || 0;
  }

  getGauge(name, tags = {}) {
    return this.gauges.get(this.makeKey(name, tags))?.value || 0;
  }

  getHistogram(name, tags = {}) {
    const values = this.histograms.get(this.makeKey(name, tags)) || [];
    if (values.length === 0) return null;

    const sorted = [...values].sort((a, b) => a - b);
    const sum = values.reduce((a, b) => a + b, 0);

    return {
      count: values.length,
      sum,
      min: sorted[0],
      max: sorted[sorted.length - 1],
      avg: sum / values.length,
      p50: sorted[Math.floor(sorted.length * 0.5)],
      p90: sorted[Math.floor(sorted.length * 0.9)],
      p95: sorted[Math.floor(sorted.length * 0.95)],
      p99: sorted[Math.floor(sorted.length * 0.99)]
    };
  }

  getStats() {
    return {
      counters: Object.fromEntries(this.counters),
      gauges: Object.fromEntries(this.gauges),
      histograms: Array.from(this.histograms.keys()).map(name => ({
        name,
        ...this.getHistogram(name)
      }))
    };
  }
}

let analyticsTracker = null;
let metricsCollector = null;

export function getAnalyticsTracker(options = {}) {
  if (!analyticsTracker) {
    analyticsTracker = new AnalyticsTracker(options);
  }
  return analyticsTracker;
}

export function getMetricsCollector() {
  if (!metricsCollector) {
    metricsCollector = new MetricsCollector();
  }
  return metricsCollector;
}

export default { AnalyticsTracker, AnalyticsEvent, MetricsCollector, getAnalyticsTracker, getMetricsCollector };
