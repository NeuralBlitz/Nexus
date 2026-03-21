#!/usr/bin/env node

import { EventEmitter } from 'events';
import crypto from 'crypto';
import { WebSocket } from 'ws';

// ═══════════════════════════════════════════════════════════════════════════
// ADVANCED EVENT BUS
// Pub/Sub, Event Sourcing, CQRS, Distributed Events
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Event priorities
 */
export const EventPriority = {
  LOW: 0,
  NORMAL: 1,
  HIGH: 2,
  CRITICAL: 3
};

/**
 * Event status
 */
export const EventStatus = {
  PENDING: 'pending',
  PROCESSING: 'processing',
  COMPLETED: 'completed',
  FAILED: 'failed',
  CANCELLED: 'cancelled'
};

/**
 * Event class
 */
export class Event {
  constructor(type, payload, options = {}) {
    this.id = options.id || `evt_${Date.now()}_${crypto.randomBytes(6).toString('hex')}`;
    this.type = type;
    this.payload = payload;
    this.source = options.source || 'unknown';
    this.timestamp = Date.now();
    this.priority = options.priority || EventPriority.NORMAL;
    this.status = EventStatus.PENDING;

    // Correlation
    this.correlationId = options.correlationId || null;
    this.causationId = options.causationId || null;

    // Metadata
    this.metadata = {
      version: options.version || 1,
      schema: options.schema || null,
      tags: options.tags || [],
      ...options.metadata
    };

    // Processing info
    this.processedBy = [];
    this.error = null;
    this.result = null;
  }

  /**
   * Mark as processing
   */
  markProcessing(processorId) {
    this.status = EventStatus.PROCESSING;
    this.processedBy.push({
      processor: processorId,
      startedAt: Date.now()
    });
  }

  /**
   * Mark as completed
   */
  markCompleted(result = null) {
    this.status = EventStatus.COMPLETED;
    this.result = result;
    if (this.processedBy.length > 0) {
      this.processedBy[this.processedBy.length - 1].completedAt = Date.now();
    }
  }

  /**
   * Mark as failed
   */
  markFailed(error) {
    this.status = EventStatus.FAILED;
    this.error = error.message || error;
    if (this.processedBy.length > 0) {
      this.processedBy[this.processedBy.length - 1].failedAt = Date.now();
      this.processedBy[this.processedBy.length - 1].error = this.error;
    }
  }

  /**
   * Create reply event
   */
  reply(type, payload) {
    return new Event(type, payload, {
      correlationId: this.correlationId || this.id,
      causationId: this.id,
      source: this.source
    });
  }

  /**
   * Clone event
   */
  clone() {
    return new Event(this.type, { ...this.payload }, {
      id: this.id,
      source: this.source,
      priority: this.priority,
      correlationId: this.correlationId,
      causationId: this.causationId,
      metadata: { ...this.metadata }
    });
  }

  /**
   * Serialize event
   */
  toJSON() {
    return {
      id: this.id,
      type: this.type,
      payload: this.payload,
      source: this.source,
      timestamp: this.timestamp,
      priority: this.priority,
      status: this.status,
      correlationId: this.correlationId,
      causationId: this.causationId,
      metadata: this.metadata,
      processedBy: this.processedBy,
      error: this.error,
      result: this.result
    };
  }

  /**
   * Deserialize event
   */
  static fromJSON(json) {
    const event = new Event(json.type, json.payload, {
      id: json.id,
      source: json.source,
      priority: json.priority,
      correlationId: json.correlationId,
      causationId: json.causationId,
      metadata: json.metadata
    });
    event.timestamp = json.timestamp;
    event.status = json.status;
    event.processedBy = json.processedBy || [];
    event.error = json.error;
    event.result = json.result;
    return event;
  }
}

/**
 * Subscription
 */
class Subscription {
  constructor(channel, handler, options = {}) {
    this.id = `sub_${Date.now()}_${crypto.randomBytes(6).toString('hex')}`;
    this.channel = channel;
    this.handler = handler;
    this.options = {
      filter: options.filter || null,
      transform: options.transform || null,
      retry: options.retry || 0,
      deadLetter: options.deadLetter || false,
      batchSize: options.batchSize || 1,
      ...options
    };
    this.stats = {
      received: 0,
      processed: 0,
      failed: 0,
      lastProcessed: null
    };
    this.active = true;
  }

  /**
   * Check if event matches filter
   */
  matches(event) {
    if (!this.options.filter) return true;

    const filter = this.options.filter;

    if (filter.type && filter.type !== event.type) return false;
    if (filter.source && filter.source !== event.source) return false;
    if (filter.priority && event.priority < filter.priority) return false;

    if (filter.predicate && typeof filter.predicate === 'function') {
      return filter.predicate(event);
    }

    return true;
  }

  /**
   * Process an event
   */
  async process(event) {
    if (!this.active || !this.matches(event)) return null;

    this.stats.received++;
    event.markProcessing(this.id);

    try {
      // Transform if needed
      let data = event;
      if (this.options.transform) {
        data = await this.options.transform(event);
      }

      // Call handler
      const result = await this.handler(data);

      this.stats.processed++;
      this.stats.lastProcessed = Date.now();
      event.markCompleted(result);

      return result;
    } catch (error) {
      this.stats.failed++;
      event.markFailed(error);
      throw error;
    }
  }

  /**
   * Unsubscribe
   */
  unsubscribe() {
    this.active = false;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// EVENT STORE - Event sourcing support
// ═══════════════════════════════════════════════════════════════════════════

export class EventStore {
  constructor(options = {}) {
    this.events = [];
    this.snapshots = new Map();
    this.maxSize = options.maxSize || 100000;
    this.compactionThreshold = options.compactionThreshold || 0.8;
  }

  /**
   * Append event to store
   */
  append(event) {
    this.events.push(event);

    // Auto-compact if needed
    if (this.events.length > this.maxSize * this.compactionThreshold) {
      this.compact();
    }

    return event;
  }

  /**
   * Get events by criteria
   */
  getEvents(options = {}) {
    const {
      type,
      source,
      correlationId,
      startTime,
      endTime,
      limit = 100,
      offset = 0
    } = options;

    let filtered = this.events;

    if (type) {
      filtered = filtered.filter(e => e.type === type);
    }
    if (source) {
      filtered = filtered.filter(e => e.source === source);
    }
    if (correlationId) {
      filtered = filtered.filter(e => e.correlationId === correlationId);
    }
    if (startTime) {
      filtered = filtered.filter(e => e.timestamp >= startTime);
    }
    if (endTime) {
      filtered = filtered.filter(e => e.timestamp <= endTime);
    }

    return filtered.slice(offset, offset + limit);
  }

  /**
   * Get event by ID
   */
  getEvent(eventId) {
    return this.events.find(e => e.id === eventId);
  }

  /**
   * Get event stream
   */
  getStream(aggregateId, fromVersion = 0) {
    return this.events
      .filter(e => e.aggregateId === aggregateId && (e.version || 0) >= fromVersion)
      .sort((a, b) => (a.version || 0) - (b.version || 0));
  }

  /**
   * Save snapshot
   */
  saveSnapshot(aggregateId, state, version) {
    this.snapshots.set(aggregateId, {
      state,
      version,
      timestamp: Date.now()
    });
  }

  /**
   * Get snapshot
   */
  getSnapshot(aggregateId) {
    return this.snapshots.get(aggregateId);
  }

  /**
   * Compact old events
   */
  compact() {
    const keepCount = Math.floor(this.maxSize / 2);
    this.events = this.events.slice(-keepCount);
  }

  /**
   * Get statistics
   */
  getStats() {
    const byType = {};
    const bySource = {};

    for (const event of this.events) {
      byType[event.type] = (byType[event.type] || 0) + 1;
      bySource[event.source] = (bySource[event.source] || 0) + 1;
    }

    return {
      totalEvents: this.events.length,
      maxSize: this.maxSize,
      snapshots: this.snapshots.size,
      byType,
      bySource
    };
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// DISTRIBED EVENT BUS - For multi-node communication
// ═══════════════════════════════════════════════════════════════════════════

export class DistributedEventBus extends EventEmitter {
  constructor(options = {}) {
    super();

    this.nodeId = options.nodeId || `node_${crypto.randomBytes(6).toString('hex')}`;
    this.subscriptions = new Map(); // channel -> Subscription[]
    this.eventStore = new EventStore(options.store);

    // Dead letter queue
    this.deadLetterQueue = [];
    this.maxDeadLetterSize = options.maxDeadLetterSize || 1000;

    // Retry configuration
    this.retryConfig = {
      maxRetries: options.maxRetries || 3,
      retryDelay: options.retryDelay || 1000,
      backoffMultiplier: options.backoffMultiplier || 2
    };

    // Middleware
    this.middleware = [];

    // Connected nodes (for distributed)
    this.nodes = new Map();

    // Processing queue
    this.processingQueue = [];
    this.isProcessing = false;
    this.concurrency = options.concurrency || 10;
  }

  /**
   * Add middleware
   */
  use(middleware) {
    this.middleware.push(middleware);
    return this;
  }

  /**
   * Subscribe to a channel
   */
  subscribe(channel, handler, options = {}) {
    const subscription = new Subscription(channel, handler, options);

    if (!this.subscriptions.has(channel)) {
      this.subscriptions.set(channel, []);
    }
    this.subscriptions.get(channel).push(subscription);

    this.emit('subscribed', { channel, subscription: subscription.id });
    return subscription;
  }

  /**
   * Unsubscribe
   */
  unsubscribe(subscription) {
    const channelSubs = this.subscriptions.get(subscription.channel);
    if (channelSubs) {
      const index = channelSubs.findIndex(s => s.id === subscription.id);
      if (index !== -1) {
        channelSubs.splice(index, 1);
        subscription.unsubscribe();
        this.emit('unsubscribed', { channel: subscription.channel, subscription: subscription.id });
      }
    }
  }

  /**
   * Publish an event
   */
  async publish(event, options = {}) {
    if (!(event instanceof Event)) {
      event = new Event(event.type || event, event.payload || event, event);
    }

    // Store event
    this.eventStore.append(event);

    // Run middleware
    for (const middleware of this.middleware) {
      try {
        await middleware(event, this);
      } catch (error) {
        // Middleware error - log but continue
        console.error('Middleware error:', error.message);
      }
    }

    // Queue for processing
    this.processingQueue.push({ event, options });
    await this._processQueue();

    this.emit('published', { event: event.id, type: event.type });
    return event;
  }

  /**
   * Process event queue
   */
  async _processQueue() {
    if (this.isProcessing || this.processingQueue.length === 0) return;

    this.isProcessing = true;

    while (this.processingQueue.length > 0) {
      const batch = this.processingQueue.splice(0, this.concurrency);
      const promises = batch.map(({ event, options }) => this._dispatch(event, options));
      await Promise.allSettled(promises);
    }

    this.isProcessing = false;
  }

  /**
   * Dispatch event to subscribers
   */
  async _dispatch(event, options = {}) {
    const subscribers = this.subscriptions.get(event.type) || [];
    const wildcardSubscribers = this.subscriptions.get('*') || [];
    const allSubscribers = [...subscribers, ...wildcardSubscribers];

    const results = [];

    for (const subscription of allSubscribers) {
      if (!subscription.matches(event)) continue;

      let retries = 0;
      let lastError = null;

      while (retries <= (subscription.options.retry || 0)) {
        try {
          const result = await subscription.process(event);
          results.push({ subscription: subscription.id, success: true, result });
          break;
        } catch (error) {
          lastError = error;
          retries++;

          if (retries <= (subscription.options.retry || 0)) {
            const delay = this.retryConfig.retryDelay *
              Math.pow(this.retryConfig.backoffMultiplier, retries - 1);
            await this._sleep(delay);
          }
        }
      }

      // All retries failed
      if (lastError && retries > (subscription.options.retry || 0)) {
        results.push({ subscription: subscription.id, success: false, error: lastError.message });

        // Send to dead letter queue if enabled
        if (subscription.options.deadLetter) {
          this._addToDeadLetter(event, lastError);
        }
      }
    }

    return results;
  }

  /**
   * Add to dead letter queue
   */
  _addToDeadLetter(event, error) {
    this.deadLetterQueue.push({
      event: event.toJSON(),
      error: error.message,
      timestamp: Date.now()
    });

    if (this.deadLetterQueue.length > this.maxDeadLetterSize) {
      this.deadLetterQueue = this.deadLetterQueue.slice(-this.maxDeadLetterSize);
    }

    this.emit('dead-letter', { event: event.id, error: error.message });
  }

  /**
   * Request/Reply pattern
   */
  async request(channel, payload, options = {}) {
    const timeout = options.timeout || 30000;

    return new Promise((resolve, reject) => {
      const correlationId = `req_${Date.now()}_${crypto.randomBytes(6).toString('hex')}`;
      const replyChannel = `${channel}.reply.${correlationId}`;

      // Set up reply handler
      const timer = setTimeout(() => {
        this.unsubscribe(replySub);
        reject(new Error('Request timeout'));
      }, timeout);

      const replySub = this.subscribe(replyChannel, (event) => {
        clearTimeout(timer);
        this.unsubscribe(replySub);
        resolve(event.payload);
      }, { once: true });

      // Send request
      this.publish(new Event(channel, payload, {
        correlationId,
        replyTo: replyChannel,
        source: this.nodeId
      }));
    });
  }

  /**
   * Reply to a request
   */
  async reply(originalEvent, payload) {
    if (originalEvent.replyTo) {
      return this.publish(new Event(originalEvent.replyTo, payload, {
        correlationId: originalEvent.correlationId,
        causationId: originalEvent.id,
        source: this.nodeId
      }));
    }
  }

  /**
   * Connect to another node
   */
  connectToNode(url, options = {}) {
    const ws = new WebSocket(url);

    ws.on('open', () => {
      this.nodes.set(url, { ws, connected: true });
      this.emit('node:connected', { url });
    });

    ws.on('message', (data) => {
      try {
        const event = Event.fromJSON(JSON.parse(data.toString()));
        this.publish(event);
      } catch (error) {
        // Invalid message
      }
    });

    ws.on('close', () => {
      this.nodes.delete(url);
      this.emit('node:disconnected', { url });

      // Reconnect logic
      if (options.reconnect !== false) {
        setTimeout(() => this.connectToNode(url, options), 5000);
      }
    });

    ws.on('error', (error) => {
      this.emit('node:error', { url, error: error.message });
    });

    return ws;
  }

  /**
   * Broadcast to all connected nodes
   */
  broadcast(event) {
    const data = JSON.stringify(event.toJSON());

    for (const [, node] of this.nodes) {
      if (node.ws.readyState === WebSocket.OPEN) {
        node.ws.send(data);
      }
    }
  }

  /**
   * Get dead letter queue
   */
  getDeadLetterQueue(limit = 100) {
    return this.deadLetterQueue.slice(-limit);
  }

  /**
   * Retry dead letter
   */
  async retryDeadLetter(eventId) {
    const index = this.deadLetterQueue.findIndex(d => d.event.id === eventId);
    if (index === -1) return false;

    const { event } = this.deadLetterQueue.splice(index, 1)[0];
    await this.publish(Event.fromJSON(event));
    return true;
  }

  /**
   * Get event history
   */
  getHistory(options = {}) {
    return this.eventStore.getEvents(options);
  }

  /**
   * Get statistics
   */
  getStats() {
    const subscriptions = {};
    for (const [channel, subs] of this.subscriptions) {
      subscriptions[channel] = subs.length;
    }

    return {
      nodeId: this.nodeId,
      subscriptions,
      totalSubscriptions: Array.from(this.subscriptions.values()).flat().length,
      deadLetters: this.deadLetterQueue.length,
      connectedNodes: this.nodes.size,
      queueLength: this.processingQueue.length,
      eventStore: this.eventStore.getStats()
    };
  }

  /**
   * Subscribe once - auto-unsubscribe after first trigger
   */
  once(channel, handler, options = {}) {
    const wrappedHandler = async (event) => {
      this.unsubscribe(subscription);
      return handler(event);
    };
    const subscription = this.subscribe(channel, wrappedHandler, options);
    return subscription;
  }

  /**
   * Route events - add routing rules that forward events between channels
   */
  addRoute(fromChannel, toChannel, transform = null) {
    this.subscribe(fromChannel, async (event) => {
      const payload = transform ? transform(event.payload) : event.payload;
      await this.publish(new Event(toChannel, payload, {
        source: `route:${fromChannel}`,
        correlationId: event.correlationId
      }));
    }, { priority: EventPriority.HIGH });
    return this;
  }

  /**
   * Replay events from the event store
   */
  async replay(channel, options = {}) {
    const { since, limit = 100, handler } = options;
    let events = this.eventStore.getEvents({ channel, since, limit });

    for (const event of events) {
      const subs = this.subscriptions.get(channel) || [];
      for (const sub of subs) {
        if (sub.active) {
          try { await sub.handler(event); } catch { /* skip */ }
        }
      }
      if (handler) await handler(event);
    }

    return { replayed: events.length, channel };
  }

  /**
   * Get per-channel statistics
   */
  getChannelStats() {
    const stats = {};
    for (const [channel, subs] of this.subscriptions) {
      stats[channel] = {
        subscribers: subs.length,
        active: subs.filter(s => s.active).length,
        totalDelivered: subs.reduce((sum, s) => sum + s.stats.delivered, 0),
        totalFailed: subs.reduce((sum, s) => sum + s.stats.failed, 0)
      };
    }
    return stats;
  }

  /**
   * List all active channels
   */
  getChannels() {
    return Array.from(this.subscriptions.keys());
  }

  /**
   * Get subscription count
   */
  getSubscriptionCount() {
    let count = 0;
    for (const subs of this.subscriptions.values()) {
      count += subs.filter(s => s.active).length;
    }
    return count;
  }

  /**
   * Clear all subscriptions
   */
  clear() {
    this.subscriptions.clear();
    this.processingQueue = [];
    this.emit('cleared');
  }

  /**
   * Sleep utility
   */
  _sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Export singleton
let bus = null;

export function getEventBus(options) {
  if (!bus) {
    bus = new DistributedEventBus(options);
  }
  return bus;
}

export default {
  Event,
  Subscription,
  EventStore,
  DistributedEventBus,
  EventPriority,
  EventStatus,
  getEventBus
};