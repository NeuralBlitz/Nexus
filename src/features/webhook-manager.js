import { EventEmitter } from 'events';
import crypto from 'crypto';

export class WebhookEndpoint {
  constructor(config) {
    this.id = config.id || `webhook_${Date.now()}`;
    this.url = config.url;
    this.secret = config.secret;
    this.events = new Set(config.events || ['*']);
    this.enabled = config.enabled !== false;
    this.retryCount = config.retryCount || 3;
    this.retryDelay = config.retryDelay || 1000;
    this.timeout = config.timeout || 30000;
    this.headers = config.headers || {};
    this.transform = config.transform || ((data) => data);
  }

  matches(event) {
    return this.events.has('*') || this.events.has(event);
  }
}

export class WebhookPayload {
  constructor(event, data, options = {}) {
    this.id = `payload_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    this.event = event;
    this.data = data;
    this.timestamp = Date.now();
    this.endpointId = options.endpointId;
    this.attempts = 0;
    this.nextRetry = null;
    this.status = 'pending';
    this.response = null;
  }
}

export class WebhookManager extends EventEmitter {
  constructor(options = {}) {
    super();

    this.endpoints = new Map();
    this.queue = [];
    this.processing = false;
    this.payloads = new Map();

    this.retryConfig = {
      maxRetries: options.maxRetries || 5,
      baseDelay: options.baseDelay || 1000,
      maxDelay: options.maxDelay || 60000,
      backoffMultiplier: options.backoffMultiplier || 2
    };

    this.stats = {
      totalWebhooks: 0,
      totalDeliveries: 0,
      successfulDeliveries: 0,
      failedDeliveries: 0,
      pendingDeliveries: 0
    };
  }

  register(config) {
    const endpoint = new WebhookEndpoint(config);
    this.endpoints.set(endpoint.id, endpoint);
    this.stats.totalWebhooks++;
    this.emit('endpoint:registered', endpoint);
    return endpoint;
  }

  unregister(endpointId) {
    const deleted = this.endpoints.delete(endpointId);
    if (deleted) {
      this.emit('endpoint:unregistered', { endpointId });
    }
    return deleted;
  }

  getEndpoint(endpointId) {
    return this.endpoints.get(endpointId);
  }

  listEndpoints(filters = {}) {
    let results = Array.from(this.endpoints.values());

    if (filters.enabled !== undefined) {
      results = results.filter(e => e.enabled === filters.enabled);
    }
    if (filters.event) {
      results = results.filter(e => e.matches(filters.event));
    }

    return results;
  }

  async trigger(event, data, options = {}) {
    const endpoints = options.endpoints
      ? options.endpoints.map(id => this.endpoints.get(id)).filter(Boolean)
      : this.listEndpoints({ enabled: true }).filter(e => e.matches(event));

    if (endpoints.length === 0) {
      this.emit('no:endpoints', { event });
      return [];
    }

    const results = [];

    for (const endpoint of endpoints) {
      const payload = new WebhookPayload(event, data, {
        endpointId: endpoint.id
      });

      this.payloads.set(payload.id, payload);
      this.stats.pendingDeliveries++;

      if (options.async) {
        this.queue.push(payload);
        this.processQueue();
      } else {
        const result = await this.deliver(endpoint, payload);
        results.push(result);
      }
    }

    return results;
  }

  async deliver(endpoint, payload) {
    const body = endpoint.transform({
      event: payload.event,
      timestamp: payload.timestamp,
      data: payload.data
    });

    const headers = {
      'Content-Type': 'application/json',
      'X-Webhook-Event': payload.event,
      'X-Webhook-Timestamp': payload.timestamp.toString(),
      ...endpoint.headers
    };

    if (endpoint.secret) {
      const signature = this.sign(body, endpoint.secret);
      headers['X-Webhook-Signature'] = signature;
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), endpoint.timeout);

      const response = await fetch(endpoint.url, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      payload.response = {
        status: response.status,
        statusText: response.statusText,
        headers: Object.fromEntries(response.headers.entries())
      };

      if (response.ok) {
        payload.status = 'delivered';
        this.stats.successfulDeliveries++;
        this.emit('delivered', { endpoint: endpoint.id, payload });
      } else {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
    } catch (error) {
      payload.status = 'failed';
      payload.error = error.message;

      if (payload.attempts < endpoint.retryCount) {
        payload.attempts++;
        payload.nextRetry = Date.now() + this.calculateRetryDelay(payload.attempts);
        this.queue.push(payload);
        this.emit('retry:scheduled', { endpoint: endpoint.id, payload, nextRetry: payload.nextRetry });
      } else {
        this.stats.failedDeliveries++;
        this.emit('failed', { endpoint: endpoint.id, payload });
      }
    }

    this.stats.pendingDeliveries--;
    this.stats.totalDeliveries++;

    return payload;
  }

  sign(body, secret) {
    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(JSON.stringify(body));
    return `sha256=${hmac.digest('hex')}`;
  }

  calculateRetryDelay(attempt) {
    const delay = Math.min(
      this.retryConfig.baseDelay * Math.pow(this.retryConfig.backoffMultiplier, attempt - 1),
      this.retryConfig.maxDelay
    );
    return delay + Math.random() * 1000;
  }

  async processQueue() {
    if (this.processing || this.queue.length === 0) return;

    this.processing = true;

    while (this.queue.length > 0) {
      const now = Date.now();
      const ready = this.queue.filter(p => !p.nextRetry || p.nextRetry <= now);

      if (ready.length === 0) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        continue;
      }

      const payload = ready[0];
      const endpoint = this.endpoints.get(payload.endpointId);

      if (endpoint) {
        await this.deliver(endpoint, payload);
      }
    }

    this.processing = false;
  }

  getPayload(payloadId) {
    return this.payloads.get(payloadId);
  }

  getStats() {
    return {
      ...this.stats,
      endpoints: this.endpoints.size,
      queueSize: this.queue.length,
      processing: this.processing
    };
  }

  replay(endpointId, payloadIds) {
    const results = [];

    for (const payloadId of payloadIds) {
      const payload = this.payloads.get(payloadId);
      const endpoint = this.endpoints.get(endpointId || payload.endpointId);

      if (payload && endpoint) {
        payload.attempts = 0;
        payload.status = 'pending';
        payload.nextRetry = null;
        this.queue.push(payload);
        results.push(payload);
      }
    }

    this.processQueue();
    return results;
  }
}

export function createWebhookSignature(body, secret, timestamp) {
  const signature = crypto
    .createHmac('sha256', secret)
    .update(`${timestamp}.${JSON.stringify(body)}`)
    .digest('hex');
  return `t=${timestamp},v1=${signature}`;
}

export function verifyWebhookSignature(body, signature, secret, tolerance = 300) {
  const parts = Object.fromEntries(signature.split(',').map(p => p.split('=')));
  const timestamp = parseInt(parts.t);

  if (Math.abs(Date.now() - timestamp * 1000) > tolerance * 1000) {
    return false;
  }

  const expected = createWebhookSignature(body, secret, timestamp);
  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
}

let webhookManager = null;

export function getWebhookManager(options = {}) {
  if (!webhookManager) {
    webhookManager = new WebhookManager(options);
  }
  return webhookManager;
}

export default { WebhookManager, WebhookEndpoint, WebhookPayload, getWebhookManager, createWebhookSignature, verifyWebhookSignature };
