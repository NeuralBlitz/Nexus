#!/usr/bin/env node

import https from 'https';
import http from 'http';
import { URL } from 'url';
import crypto from 'crypto';

// ═══════════════════════════════════════════════════════════════════════════
// API INTEGRATIONS MODULE
// ═══════════════════════════════════════════════════════════════════════════

/**
 * HTTP client utility for API requests
 */
class HttpClient {
  constructor(baseUrl, headers = {}) {
    this.baseUrl = baseUrl;
    this.headers = {
      'Content-Type': 'application/json',
      ...headers
    };
  }

  async request(method, path, data = null, additionalHeaders = {}) {
    const url = new URL(path, this.baseUrl);
    const isHttps = url.protocol === 'https:';
    const transport = isHttps ? https : http;

    const options = {
      hostname: url.hostname,
      port: url.port || (isHttps ? 443 : 80),
      path: url.pathname + url.search,
      method,
      headers: {
        ...this.headers,
        ...additionalHeaders
      }
    };

    return new Promise((resolve, reject) => {
      const req = transport.request(options, (res) => {
        let body = '';

        res.on('data', chunk => body += chunk);
        res.on('end', () => {
          try {
            const parsed = JSON.parse(body);
            resolve({
              status: res.statusCode,
              headers: res.headers,
              data: parsed
            });
          } catch {
            resolve({
              status: res.statusCode,
              headers: res.headers,
              data: body
            });
          }
        });
      });

      req.on('error', reject);
      req.setTimeout(30000, () => {
        req.destroy();
        reject(new Error('Request timeout'));
      });

      if (data) {
        req.write(JSON.stringify(data));
      }

      req.end();
    });
  }

  get(path, headers) {
    return this.request('GET', path, null, headers);
  }

  post(path, data, headers) {
    return this.request('POST', path, data, headers);
  }

  put(path, data, headers) {
    return this.request('PUT', path, data, headers);
  }

  patch(path, data, headers) {
    return this.request('PATCH', path, data, headers);
  }

  delete(path, headers) {
    return this.request('DELETE', path, null, headers);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// GITHUB INTEGRATION
// ═══════════════════════════════════════════════════════════════════════════

export class GitHubIntegration {
  constructor(token = process.env.GITHUB_TOKEN) {
    this.token = token;
    this.client = new HttpClient('https://api.github.com', {
      'Authorization': `token ${token}`,
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'NEXUS-Platform'
    });
  }

  /**
   * Check if configured
   */
  isConfigured() {
    return !!this.token;
  }

  /**
   * Get authenticated user info
   */
  async getUser() {
    if (!this.isConfigured()) throw new Error('GitHub token not configured');
    const response = await this.client.get('/user');
    return response.data;
  }

  /**
   * List repositories for authenticated user
   */
  async listRepos(options = {}) {
    const { page = 1, perPage = 30, sort = 'updated' } = options;
    const response = await this.client.get(
      `/user/repos?page=${page}&per_page=${perPage}&sort=${sort}`
    );
    return response.data;
  }

  /**
   * Get repository info
   */
  async getRepo(owner, repo) {
    const response = await this.client.get(`/repos/${owner}/${repo}`);
    return response.data;
  }

  /**
   * List issues for a repository
   */
  async listIssues(owner, repo, options = {}) {
    const { state = 'open', page = 1, perPage = 30 } = options;
    const response = await this.client.get(
      `/repos/${owner}/${repo}/issues?state=${state}&page=${page}&per_page=${perPage}`
    );
    return response.data;
  }

  /**
   * Create an issue
   */
  async createIssue(owner, repo, issue) {
    const response = await this.client.post(
      `/repos/${owner}/${repo}/issues`,
      {
        title: issue.title,
        body: issue.body,
        labels: issue.labels || [],
        assignees: issue.assignees || []
      }
    );
    return response.data;
  }

  /**
   * List pull requests
   */
  async listPullRequests(owner, repo, options = {}) {
    const { state = 'open', page = 1, perPage = 30 } = options;
    const response = await this.client.get(
      `/repos/${owner}/${repo}/pulls?state=${state}&page=${page}&per_page=${perPage}`
    );
    return response.data;
  }

  /**
   * Create a pull request
   */
  async createPullRequest(owner, repo, pr) {
    const response = await this.client.post(
      `/repos/${owner}/${repo}/pulls`,
      {
        title: pr.title,
        body: pr.body,
        head: pr.head,
        base: pr.base,
        draft: pr.draft || false
      }
    );
    return response.data;
  }

  /**
   * Get repository contents
   */
  async getFileContents(owner, repo, path, ref = null) {
    let url = `/repos/${owner}/${repo}/contents/${path}`;
    if (ref) url += `?ref=${ref}`;

    const response = await this.client.get(url);

    if (response.data.content) {
      return Buffer.from(response.data.content, 'base64').toString('utf-8');
    }

    return response.data;
  }

  /**
   * List commits
   */
  async listCommits(owner, repo, options = {}) {
    const { sha, since, until, page = 1, perPage = 30 } = options;

    let url = `/repos/${owner}/${repo}/commits?page=${page}&per_page=${perPage}`;
    if (sha) url += `&sha=${sha}`;
    if (since) url += `&since=${since}`;
    if (until) url += `&until=${until}`;

    const response = await this.client.get(url);
    return response.data;
  }

  /**
   * Get commit details
   */
  async getCommit(owner, repo, sha) {
    const response = await this.client.get(`/repos/${owner}/${repo}/commits/${sha}`);
    return response.data;
  }

  /**
   * Create a webhook
   */
  async createWebhook(owner, repo, webhook) {
    const response = await this.client.post(
      `/repos/${owner}/${repo}/hooks`,
      {
        name: 'web',
        config: {
          url: webhook.url,
          content_type: 'json',
          secret: webhook.secret
        },
        events: webhook.events || ['push', 'pull_request', 'issues'],
        active: true
      }
    );
    return response.data;
  }

  /**
   * Search repositories
   */
  async searchRepos(query, options = {}) {
    const { page = 1, perPage = 30, sort = 'stars' } = options;
    const response = await this.client.get(
      `/search/repositories?q=${encodeURIComponent(query)}&page=${page}&per_page=${perPage}&sort=${sort}`
    );
    return response.data;
  }

  /**
   * Get rate limit status
   */
  async getRateLimit() {
    const response = await this.client.get('/rate_limit');
    return response.data;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// SLACK INTEGRATION
// ═══════════════════════════════════════════════════════════════════════════

export class SlackIntegration {
  constructor(token = process.env.SLACK_BOT_TOKEN) {
    this.token = token;
    this.client = new HttpClient('https://slack.com/api', {
      'Authorization': `Bearer ${token}`
    });
  }

  /**
   * Check if configured
   */
  isConfigured() {
    return !!this.token;
  }

  /**
   * Test authentication
   */
  async authTest() {
    const response = await this.client.get('/auth.test');
    return response.data;
  }

  /**
   * List channels
   */
  async listChannels(options = {}) {
    const { types = 'public_channel,private_channel', limit = 100 } = options;
    const response = await this.client.get(
      `/conversations.list?types=${types}&limit=${limit}`
    );
    return response.data;
  }

  /**
   * Get channel info
   */
  async getChannel(channelId) {
    const response = await this.client.get(
      `/conversations.info?channel=${channelId}`
    );
    return response.data;
  }

  /**
   * Post message to channel
   */
  async postMessage(channel, text, options = {}) {
    const response = await this.client.post('/chat.postMessage', {
      channel,
      text,
      ...options
    });
    return response.data;
  }

  /**
   * Post rich message (blocks)
   */
  async postBlocks(channel, blocks, text = '') {
    const response = await this.client.post('/chat.postMessage', {
      channel,
      text,
      blocks
    });
    return response.data;
  }

  /**
   * Update a message
   */
  async updateMessage(channel, ts, text, blocks = null) {
    const data = { channel, ts, text };
    if (blocks) data.blocks = blocks;

    const response = await this.client.post('/chat.update', data);
    return response.data;
  }

  /**
   * Delete a message
   */
  async deleteMessage(channel, ts) {
    const response = await this.client.post('/chat.delete', {
      channel,
      ts
    });
    return response.data;
  }

  /**
   * Get conversation history
   */
  async getHistory(channel, options = {}) {
    const { limit = 100, oldest, latest } = options;

    let url = `/conversations.history?channel=${channel}&limit=${limit}`;
    if (oldest) url += `&oldest=${oldest}`;
    if (latest) url += `&latest=${latest}`;

    const response = await this.client.get(url);
    return response.data;
  }

  /**
   * Upload file to channel
   */
  async uploadFile(channel, file, options = {}) {
    const response = await this.client.post('/files.upload', {
      channels: channel,
      file: file.content,
      filename: file.filename,
      filetype: file.filetype || 'auto',
      title: options.title,
      initial_comment: options.comment
    });
    return response.data;
  }

  /**
   * List users
   */
  async listUsers(limit = 100) {
    const response = await this.client.get(`/users.list?limit=${limit}`);
    return response.data;
  }

  /**
   * Get user info
   */
  async getUserInfo(userId) {
    const response = await this.client.get(`/users.info?user=${userId}`);
    return response.data;
  }

  /**
   * Create a reminder
   */
  async createReminder(text, time, user = null) {
    const data = { text, time };
    if (user) data.user = user;

    const response = await this.client.post('/reminders.add', data);
    return response.data;
  }

  /**
   * Send notification to a webhook
   */
  static async sendWebhook(webhookUrl, message) {
    const client = new HttpClient(webhookUrl);
    return client.post('', message);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// WEBHOOK MANAGER
// ═══════════════════════════════════════════════════════════════════════════

export class WebhookManager {
  constructor(secret = process.env.WEBHOOK_SECRET) {
    this.secret = secret;
    this.handlers = new Map();
    this.logs = [];
  }

  /**
   * Verify webhook signature
   */
  verifySignature(payload, signature) {
    if (!this.secret) return true;

    const expected = crypto
      .createHmac('sha256', this.secret)
      .update(payload)
      .digest('hex');

    try {
      return crypto.timingSafeEqual(
        Buffer.from(signature),
        Buffer.from(`sha256=${expected}`)
      );
    } catch {
      return false;
    }
  }

  /**
   * Register a webhook handler
   */
  register(event, handler) {
    if (!this.handlers.has(event)) {
      this.handlers.set(event, []);
    }
    this.handlers.get(event).push(handler);
  }

  /**
   * Handle incoming webhook
   */
  async handle(event, payload, signature = null) {
    // Verify signature if secret is set
    if (this.secret && signature) {
      if (!this.verifySignature(JSON.stringify(payload), signature)) {
        throw new Error('Invalid webhook signature');
      }
    }

    // Log the event
    this.logs.push({
      event,
      timestamp: new Date().toISOString(),
      payload: JSON.stringify(payload).substring(0, 1000)
    });

    // Keep only last 100 logs
    if (this.logs.length > 100) {
      this.logs = this.logs.slice(-100);
    }

    // Execute handlers
    const handlers = this.handlers.get(event) || [];
    const results = [];

    for (const handler of handlers) {
      try {
        const result = await handler(payload);
        results.push({ success: true, result });
      } catch (error) {
        results.push({ success: false, error: error.message });
      }
    }

    return {
      event,
      handlersExecuted: handlers.length,
      results
    };
  }

  /**
   * Send webhook to external URL
  */
  async send(url, event, data, options = {}) {
    const { method = 'POST', headers = {}, timeout = 10000 } = options;

    const payload = {
      event,
      data,
      timestamp: new Date().toISOString(),
      source: 'nexus-platform'
    };

    // Sign payload if secret is set
    let signature = null;
    if (this.secret) {
      signature = crypto
        .createHmac('sha256', this.secret)
        .update(JSON.stringify(payload))
        .digest('hex');
    }

    const client = new HttpClient(url);
    const additionalHeaders = {
      'X-Nexus-Event': event,
      ...headers
    };

    if (signature) {
      additionalHeaders['X-Hub-Signature-256'] = `sha256=${signature}`;
    }

    try {
      const response = await client.request(method, '', payload, additionalHeaders);
      return { success: true, response };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Get recent webhook logs
   */
  getLogs(limit = 50) {
    return this.logs.slice(-limit);
  }

  /**
   * Clear logs
   */
  clearLogs() {
    this.logs = [];
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// WEBHOOK SERVER (Express middleware)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Create Express middleware for handling webhooks
 */
export function createWebhookMiddleware(webhookManager) {
  return async (req, res, next) => {
    // Only handle POST to /webhooks
    if (req.method !== 'POST' || !req.path.startsWith('/webhooks/')) {
      return next();
    }

    const event = req.path.replace('/webhooks/', '');
    const signature = req.headers['x-hub-signature-256'] ||
      req.headers['x-webhook-signature'];

    try {
      const result = await webhookManager.handle(event, req.body, signature);

      res.json({
        success: true,
        ...result
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  };
}

// Export singleton instances
let github = null;
let slack = null;
let webhooks = null;

export function getGitHub() {
  if (!github) {
    github = new GitHubIntegration();
  }
  return github;
}

export function getSlack() {
  if (!slack) {
    slack = new SlackIntegration();
  }
  return slack;
}

export function getWebhookManager(secret) {
  if (!webhooks) {
    webhooks = new WebhookManager(secret);
  }
  return webhooks;
}

export default {
  GitHubIntegration,
  SlackIntegration,
  WebhookManager,
  createWebhookMiddleware,
  getGitHub,
  getSlack,
  getWebhookManager
};