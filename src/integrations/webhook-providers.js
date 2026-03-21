#!/usr/bin/env node

import { EventEmitter } from 'events';
import crypto from 'crypto';

// ═══════════════════════════════════════════════════════════════════════════
// WEBHOOK PROVIDERS - GitLab, Bitbucket, N8N, and more
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Base Webhook Provider
 */
export class WebhookProvider extends EventEmitter {
  constructor(config = {}) {
    super();

    this.name = config.name || 'unknown';
    this.secret = config.secret;
    this.webhooks = new Map();
    this.logs = [];
    this.maxLogs = config.maxLogs || 1000;
  }

  /**
   * Verify webhook signature
   */
  verifySignature(payload, signature) {
    throw new Error('verifySignature must be implemented');
  }

  /**
   * Parse webhook event
   */
  parseEvent(payload, headers) {
    throw new Error('parseEvent must be implemented');
  }

  /**
   * Process incoming webhook
   */
  async processWebhook(payload, headers) {
    // Verify signature
    const signature = this.getSignature(headers);
    if (this.secret && !this.verifySignature(payload, signature)) {
      const error = new Error('Invalid webhook signature');
      this.emit('error', { error, provider: this.name });
      throw error;
    }

    // Parse event
    const event = this.parseEvent(payload, headers);

    // Log
    this._log('receive', event);

    // Emit
    this.emit('webhook', event);
    this.emit(`webhook:${event.type}`, event);

    return event;
  }

  /**
   * Get signature from headers
   */
  getSignature(headers) {
    return headers['x-hub-signature-256'] || 
           headers['x-gitlab-token'] || 
           headers['x-signature'] || 
           headers['authorization'];
  }

  /**
   * Register a webhook endpoint
   */
  registerWebhook(config) {
    const id = `wh_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    const webhook = {
      id,
      ...config,
      createdAt: Date.now(),
      lastTriggered: null,
      triggerCount: 0
    };
    this.webhooks.set(id, webhook);
    return webhook;
  }

  /**
   * Log an event
   */
  _log(type, data) {
    const entry = {
      id: `log_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      provider: this.name,
      type,
      data,
      timestamp: Date.now()
    };
    this.logs.push(entry);
    if (this.logs.length > this.maxLogs) {
      this.logs.shift();
    }
    return entry;
  }

  /**
   * Get logs
   */
  getLogs(limit = 100) {
    return this.logs.slice(-limit);
  }

  /**
   * Get status
   */
  getStatus() {
    return {
      name: this.name,
      configured: !!this.secret,
      webhooks: this.webhooks.size,
      logs: this.logs.length
    };
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// GITLAB WEBHOOK PROVIDER
// ═══════════════════════════════════════════════════════════════════════════

export class GitLabWebhookProvider extends WebhookProvider {
  constructor(config = {}) {
    super({ ...config, name: 'gitlab' });
  }

  /**
   * Verify GitLab webhook token
   */
  verifySignature(payload, token) {
    if (!this.secret) return true;
    return token === this.secret;
  }

  /**
   * Parse GitLab webhook event
   */
  parseEvent(payload, headers) {
    const eventType = headers['x-gitlab-event'] || 'unknown';
    const hookId = headers['x-gitlab-hook-id'];
    const instance = headers['x-gitlab-instance'];

    return {
      provider: 'gitlab',
      type: this._mapEventType(eventType),
      originalType: eventType,
      hookId,
      instance,
      project: payload.project ? {
        id: payload.project.id,
        name: payload.project.name,
        path: payload.project.path_with_namespace,
        url: payload.project.web_url
      } : null,
      user: payload.user ? {
        id: payload.user.id,
        username: payload.user.username,
        name: payload.user.name
      } : null,
      data: payload,
      timestamp: Date.now()
    };
  }

  /**
   * Map GitLab event types to standard types
   */
  _mapEventType(gitlabEvent) {
    const mapping = {
      'Push Hook': 'push',
      'Tag Push Hook': 'tag',
      'Merge Request Hook': 'merge_request',
      'Issue Hook': 'issue',
      'Note Hook': 'comment',
      'Confidential Issue Hook': 'confidential_issue',
      'Pipeline Hook': 'pipeline',
      'Job Hook': 'job',
      'Wiki Page Hook': 'wiki',
      'Deployment Hook': 'deployment',
      'Release Hook': 'release',
      'Subgroup Hook': 'subgroup',
      'Member Hook': 'member'
    };
    return mapping[gitlabEvent] || gitlabEvent.toLowerCase().replace(' hook', '');
  }

  /**
   * Generate GitLab webhook URL payload
   */
  generateWebhookConfig(url, events, options = {}) {
    return {
      url,
      secret_token: this.secret,
      push_events: events.includes('push'),
      issues_events: events.includes('issue'),
      merge_requests_events: events.includes('merge_request'),
      tag_push_events: events.includes('tag'),
      note_events: events.includes('comment'),
      pipeline_events: events.includes('pipeline'),
      job_events: events.includes('job'),
      wiki_page_events: events.includes('wiki'),
      deployment_events: events.includes('deployment'),
      release_events: events.includes('release'),
      enable_ssl_verification: options.sslVerification !== false
    };
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// BITBUCKET WEBHOOK PROVIDER
// ═══════════════════════════════════════════════════════════════════════════

export class BitbucketWebhookProvider extends WebhookProvider {
  constructor(config = {}) {
    super({ ...config, name: 'bitbucket' });
  }

  /**
   * Verify Bitbucket webhook signature (HMAC-SHA256)
   */
  verifySignature(payload, signature) {
    if (!this.secret) return true;
    if (!signature) return false;

    const payloadStr = typeof payload === 'string' ? payload : JSON.stringify(payload);
    const expectedSig = 'sha256=' + crypto
      .createHmac('sha256', this.secret)
      .update(payloadStr)
      .digest('hex');

    try {
      return crypto.timingSafeEqual(
        Buffer.from(signature),
        Buffer.from(expectedSig)
      );
    } catch {
      return false;
    }
  }

  /**
   * Parse Bitbucket webhook event
   */
  parseEvent(payload, headers) {
    const eventType = headers['x-event-key'] || 'unknown';
    const hookId = headers['x-hook-uuid'];
    const deliveryId = headers['x-delivery-id'];

    const [category, action] = eventType.split(':');

    return {
      provider: 'bitbucket',
      type: this._mapEventType(category, action),
      originalType: eventType,
      category,
      action,
      hookId,
      deliveryId,
      repository: payload.repository ? {
        uuid: payload.repository.uuid,
        name: payload.repository.name,
        fullName: payload.repository.full_name,
        url: payload.repository.links?.html?.href
      } : null,
      actor: payload.actor ? {
        uuid: payload.actor.uuid,
        username: payload.actor.username,
        displayName: payload.actor.display_name
      } : null,
      data: payload,
      timestamp: Date.now()
    };
  }

  /**
   * Map Bitbucket event types to standard types
   */
  _mapEventType(category, action) {
    const mapping = {
      'repo': {
        'push': 'push',
        'fork': 'fork',
        'updated': 'repository_updated'
      },
      'pullrequest': {
        'created': 'pull_request_opened',
        'updated': 'pull_request_updated',
        'approved': 'pull_request_approved',
        'merged': 'pull_request_merged',
        'declined': 'pull_request_declined'
      },
      'issue': {
        'created': 'issue_created',
        'updated': 'issue_updated',
        'commented': 'issue_commented',
        'resolved': 'issue_resolved'
      },
      'comment': {
        'created': 'comment_created',
        'updated': 'comment_updated',
        'deleted': 'comment_deleted'
      }
    };

    return mapping[category]?.[action] || `${category}_${action}`;
  }

  /**
   * Generate Bitbucket webhook config
   */
  generateWebhookConfig(url, events, options = {}) {
    return {
      url,
      events: events,
      active: true,
      secret: this.secret
    };
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// N8N WEBHOOK PROVIDER
// ═══════════════════════════════════════════════════════════════════════════

export class N8NWebhookProvider extends WebhookProvider {
  constructor(config = {}) {
    super({ ...config, name: 'n8n' });
    this.baseUrl = config.n8nBaseUrl || process.env.N8N_BASE_URL;
    this.apiKey = config.n8nApiKey || process.env.N8N_API_KEY;
  }

  /**
   * Verify N8N webhook (HMAC or header-based)
   */
  verifySignature(payload, signature) {
    if (!this.secret) return true;

    const payloadStr = typeof payload === 'string' ? payload : JSON.stringify(payload);
    const expectedSig = crypto
      .createHmac('sha256', this.secret)
      .update(payloadStr)
      .digest('hex');

    return signature === expectedSig || signature === this.secret;
  }

  /**
   * Parse N8N webhook event
   */
  parseEvent(payload, headers) {
    const workflowId = headers['x-n8n-workflow-id'] || payload.workflowId;
    const executionId = headers['x-n8n-execution-id'] || payload.executionId;
    const eventType = payload.eventType || 'webhook';

    return {
      provider: 'n8n',
      type: eventType,
      workflowId,
      executionId,
      node: payload.node || null,
      data: payload.data || payload,
      timestamp: Date.now()
    };
  }

  /**
   * Trigger N8N workflow
   */
  async triggerWorkflow(workflowId, data = {}) {
    if (!this.baseUrl || !this.apiKey) {
      throw new Error('N8N not configured');
    }

    const response = await fetch(`${this.baseUrl}/api/v1/workflows/${workflowId}/execute`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-N8N-API-KEY': this.apiKey
      },
      body: JSON.stringify(data)
    });

    if (!response.ok) {
      throw new Error(`N8N API error: ${response.status}`);
    }

    const result = await response.json();
    this._log('trigger', { workflowId, data, result });

    return result;
  }

  /**
   * Get N8N workflow status
   */
  async getWorkflowStatus(executionId) {
    if (!this.baseUrl || !this.apiKey) {
      throw new Error('N8N not configured');
    }

    const response = await fetch(`${this.baseUrl}/api/v1/executions/${executionId}`, {
      headers: {
        'X-N8N-API-KEY': this.apiKey
      }
    });

    if (!response.ok) {
      throw new Error(`N8N API error: ${response.status}`);
    }

    return response.json();
  }

  /**
   * List N8N workflows
   */
  async listWorkflows() {
    if (!this.baseUrl || !this.apiKey) {
      throw new Error('N8N not configured');
    }

    const response = await fetch(`${this.baseUrl}/api/v1/workflows`, {
      headers: {
        'X-N8N-API-KEY': this.apiKey
      }
    });

    if (!response.ok) {
      throw new Error(`N8N API error: ${response.status}`);
    }

    return response.json();
  }

  /**
   * Get status
   */
  getStatus() {
    return {
      ...super.getStatus(),
      configured: !!(this.baseUrl && this.apiKey),
      baseUrl: this.baseUrl || null
    };
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// ZAPIER WEBHOOK PROVIDER
// ═══════════════════════════════════════════════════════════════════════════

export class ZapierWebhookProvider extends WebhookProvider {
  constructor(config = {}) {
    super({ ...config, name: 'zapier' });
  }

  /**
   * Verify Zapier webhook (basic token auth)
   */
  verifySignature(payload, token) {
    if (!this.secret) return true;
    return token === this.secret;
  }

  /**
   * Parse Zapier webhook event
   */
  parseEvent(payload, headers) {
    return {
      provider: 'zapier',
      type: payload.eventType || 'zap',
      zapId: payload.zapId,
      runId: payload.runId,
      data: payload,
      timestamp: Date.now()
    };
  }

  /**
   * Send data to Zapier catch hook
   */
  async sendToZapier(hookUrl, data) {
    const response = await fetch(hookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(data)
    });

    if (!response.ok) {
      throw new Error(`Zapier webhook error: ${response.status}`);
    }

    this._log('send', { hookUrl, data });

    return { success: true };
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// WEBHOOK PROVIDER MANAGER
// ═══════════════════════════════════════════════════════════════════════════

export class WebhookProviderManager extends EventEmitter {
  constructor(config = {}) {
    super();

    this.providers = new Map();
    this.secret = config.secret || process.env.WEBHOOK_SECRET;

    // Register default providers
    this.registerProvider(new GitLabWebhookProvider({ secret: this.secret }));
    this.registerProvider(new BitbucketWebhookProvider({ secret: this.secret }));
    this.registerProvider(new N8NWebhookProvider({ secret: this.secret }));
    this.registerProvider(new ZapierWebhookProvider({ secret: this.secret }));
  }

  /**
   * Register a webhook provider
   */
  registerProvider(provider) {
    this.providers.set(provider.name, provider);

    // Forward events
    provider.on('webhook', (event) => this.emit('webhook', event));
    provider.on('error', (error) => this.emit('error', error));

    return this;
  }

  /**
   * Get a provider by name
   */
  getProvider(name) {
    return this.providers.get(name);
  }

  /**
   * Process webhook by provider
   */
  async processWebhook(providerName, payload, headers) {
    const provider = this.providers.get(providerName);
    if (!provider) {
      throw new Error(`Unknown provider: ${providerName}`);
    }

    return provider.processWebhook(payload, headers);
  }

  /**
   * Process webhook with auto-detection
   */
  async processWebhookAuto(payload, headers) {
    // Auto-detect provider from headers
    if (headers['x-gitlab-event']) {
      return this.processWebhook('gitlab', payload, headers);
    }
    if (headers['x-event-key']) {
      return this.processWebhook('bitbucket', payload, headers);
    }
    if (headers['x-n8n-workflow-id']) {
      return this.processWebhook('n8n', payload, headers);
    }
    if (headers['x-zapier']) {
      return this.processWebhook('zapier', payload, headers);
    }
    if (headers['x-hub-signature-256']) {
      // Could be GitHub - use existing provider
      return this.processWebhook('github', payload, headers);
    }

    // Default to generic
    return {
      provider: 'generic',
      type: 'unknown',
      data: payload,
      timestamp: Date.now()
    };
  }

  /**
   * Get all providers status
   */
  getAllStatus() {
    const status = {};
    for (const [name, provider] of this.providers) {
      status[name] = provider.getStatus();
    }
    return status;
  }

  /**
   * Get all logs
   */
  getAllLogs(limit = 100) {
    const allLogs = [];
    for (const provider of this.providers.values()) {
      allLogs.push(...provider.getLogs(100));
    }
    return allLogs.sort((a, b) => b.timestamp - a.timestamp).slice(0, limit);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════════════════

export default {
  WebhookProvider,
  GitLabWebhookProvider,
  BitbucketWebhookProvider,
  N8NWebhookProvider,
  ZapierWebhookProvider,
  WebhookProviderManager
};
