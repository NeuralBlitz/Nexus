#!/usr/bin/env node

import { EventEmitter } from 'events';
import crypto from 'crypto';

// ═══════════════════════════════════════════════════════════════════════════
// RATE LIMITER - Token Bucket + Sliding Window Implementation
// ═══════════════════════════════════════════════════════════════════════════

export class RateLimiter extends EventEmitter {
  constructor(config = {}) {
    super();

    this.windowMs = config.windowMs || 60000; // 1 minute default
    this.maxRequests = config.maxRequests || 100;
    this.message = config.message || 'Too many requests';
    this.statusCode = config.statusCode || 429;
    this.skipSuccessfulRequests = config.skipSuccessfulRequests || false;
    this.skipFailedRequests = config.skipFailedRequests || false;

    // Storage for rate limit data
    this.store = new Map();

    // Cleanup interval
    this.cleanupInterval = setInterval(() => this.cleanup(), this.windowMs);

    // Key generators
    this.keyGenerators = {
      ip: (req) => req.ip || req.socket.remoteAddress,
      apiKey: (req) => req.headers['x-api-key'],
      user: (req) => req.headers['x-user-id'],
      custom: config.keyGenerator || null
    };
  }

  /**
   * Get the key for rate limiting
   */
  getKey(req, type = 'ip') {
    const generator = this.keyGenerators[type];
    if (generator) {
      return generator(req);
    }
    return type;
  }

  /**
   * Check if request is allowed
   */
  check(key, options = {}) {
    const windowMs = options.windowMs || this.windowMs;
    const maxRequests = options.maxRequests || this.maxRequests;
    const now = Date.now();

    let bucket = this.store.get(key);

    if (!bucket) {
      bucket = {
        tokens: maxRequests,
        lastRefill: now,
        requests: []
      };
      this.store.set(key, bucket);
    }

    // Refill tokens based on time passed
    const timePassed = now - bucket.lastRefill;
    const tokensToAdd = Math.floor((timePassed / windowMs) * maxRequests);
    
    if (tokensToAdd > 0) {
      bucket.tokens = Math.min(maxRequests, bucket.tokens + tokensToAdd);
      bucket.lastRefill = now;
    }

    // Remove old requests from sliding window
    bucket.requests = bucket.requests.filter(t => now - t < windowMs);

    // Check if allowed
    const allowed = bucket.tokens > 0 || bucket.requests.length < maxRequests;

    if (allowed) {
      bucket.tokens = Math.max(0, bucket.tokens - 1);
      bucket.requests.push(now);
    }

    const remaining = Math.max(0, Math.min(maxRequests - bucket.requests.length, bucket.tokens));
    const resetAt = now + windowMs;

    return {
      allowed,
      remaining,
      resetAt,
      total: maxRequests,
      retryAfter: allowed ? 0 : Math.ceil((bucket.requests[0] + windowMs - now) / 1000)
    };
  }

  /**
   * Express middleware
   */
  middleware(options = {}) {
    return (req, res, next) => {
      const key = this.getKey(req, options.keyType || 'ip');
      const result = this.check(key, options);

      // Set rate limit headers
      res.setHeader('X-RateLimit-Limit', result.total);
      res.setHeader('X-RateLimit-Remaining', result.remaining);
      res.setHeader('X-RateLimit-Reset', Math.ceil(result.resetAt / 1000));

      if (!result.allowed) {
        res.setHeader('Retry-After', result.retryAfter);
        return res.status(this.statusCode).json({
          error: this.message,
          retryAfter: result.retryAfter
        });
      }

      next();
    };
  }

  /**
   * Create middleware for specific endpoint
   */
  endpoint(options = {}) {
    return this.middleware({ ...options, keyType: options.keyType || 'apiKey' });
  }

  /**
   * Clean up expired entries
   */
  cleanup() {
    const now = Date.now();
    for (const [key, bucket] of this.store) {
      if (now - bucket.lastRefill > this.windowMs * 2) {
        this.store.delete(key);
      }
    }
  }

  /**
   * Get stats
   */
  getStats() {
    return {
      totalKeys: this.store.size,
      windowMs: this.windowMs,
      maxRequests: this.maxRequests
    };
  }

  /**
   * Reset rate limit for a key
   */
  reset(key) {
    this.store.delete(key);
  }

  /**
   * Reset all rate limits
   */
  resetAll() {
    this.store.clear();
  }

  /**
   * Destroy the rate limiter
   */
  destroy() {
    clearInterval(this.cleanupInterval);
    this.store.clear();
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// WEBHOOK SIGNATURE VERIFIER
// ═══════════════════════════════════════════════════════════════════════════

export class WebhookVerifier extends EventEmitter {
  constructor(config = {}) {
    super();

    this.secret = config.secret || process.env.WEBHOOK_SECRET;
    this.algorithms = config.algorithms || ['sha256', 'sha1', 'md5'];
    this.tolerance = config.tolerance || 300000; // 5 minutes
    this.headerNames = {
      signature: config.signatureHeader || 'X-Signature',
      timestamp: config.timestampHeader || 'X-Timestamp',
      nonce: config.nonceHeader || 'X-Nonce'
    };
  }

  /**
   * Generate signature for payload
   */
  generateSignature(payload, algorithm = 'sha256') {
    const hmac = crypto.createHmac(algorithm, this.secret);
    const data = typeof payload === 'string' ? payload : JSON.stringify(payload);
    hmac.update(data);
    return hmac.digest('hex');
  }

  /**
   * Verify GitHub webhook signature
   */
  verifyGitHub(signature, payload) {
    if (!this.secret || !signature) return false;

    const sig = signature.replace('sha256=', '');
    const hmac = crypto.createHmac('sha256', this.secret);
    hmac.update(payload);
    const expected = hmac.digest('hex');

    try {
      return crypto.timingSafeEqual(
        Buffer.from(sig, 'hex'),
        Buffer.from(expected, 'hex')
      );
    } catch {
      return false;
    }
  }

  /**
   * Verify Stripe webhook signature
   */
  verifyStripe(signature, payload, timestamp) {
    if (!this.secret || !signature) return false;

    // Check timestamp tolerance
    const now = Math.floor(Date.now() / 1000);
    if (Math.abs(now - timestamp) > this.tolerance / 1000) {
      return false;
    }

    const sigParts = signature.split(',');
    const timestampPart = sigParts.find(p => p.startsWith('t='));
    const signaturePart = sigParts.find(p => p.startsWith('v1='));

    if (!timestampPart || !signaturePart) return false;

    const signedTimestamp = timestampPart.slice(2);
    const signedPayload = `${signedTimestamp}.${payload}`;

    const expected = this.generateSignature(signedPayload, 'sha256');
    return crypto.timingSafeEqual(
      Buffer.from(signaturePart.slice(3)),
      Buffer.from(expected)
    );
  }

  /**
   * Verify Slack webhook signature
   */
  verifySlack(signature, timestamp, body) {
    if (!this.secret || !signature) return false;

    // Check timestamp tolerance
    const now = Math.floor(Date.now() / 1000);
    if (Math.abs(now - parseInt(timestamp)) > this.tolerance / 1000) {
      return false;
    }

    const sigBasestring = `v0:${timestamp}:${body}`;
    const expected = 'v0=' + this.generateSignature(sigBasestring, 'sha256');

    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expected)
    );
  }

  /**
   * Verify generic HMAC signature
   */
  verifyHMAC(signature, payload, algorithm = 'sha256') {
    if (!this.secret || !signature) return false;

    const expected = this.generateSignature(payload, algorithm);

    try {
      return crypto.timingSafeEqual(
        Buffer.from(signature),
        Buffer.from(expected)
      );
    } catch {
      return false;
    }
  }

  /**
   * Verify Discord webhook signature
   */
  verifyDiscord(signature, timestamp, body) {
    if (!this.secret || !signature) return false;

    // Check timestamp tolerance
    const now = Math.floor(Date.now() / 1000);
    if (Math.abs(now - parseInt(timestamp)) > this.tolerance / 1000) {
      return false;
    }

    const message = `${timestamp}${body}`;
    const expected = crypto.createHmac('sha256', this.secret)
      .update(message)
      .digest('hex');

    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expected)
    );
  }

  /**
   * Express middleware for webhook verification
   */
  middleware(options = {}) {
    return (req, res, next) => {
      const provider = options.provider || 'generic';

      // Store raw body for verification
      const rawBody = req.body;
      const body = typeof rawBody === 'string' ? rawBody : JSON.stringify(rawBody);

      let verified = false;

      switch (provider) {
        case 'github':
          verified = this.verifyGitHub(
            req.headers['x-hub-signature-256'],
            body
          );
          break;

        case 'stripe':
          verified = this.verifyStripe(
            req.headers['stripe-signature'],
            body,
            req.headers['stripe-timestamp']
          );
          break;

        case 'slack':
          verified = this.verifySlack(
            req.headers['x-slack-signature'],
            req.headers['x-slack-request-timestamp'],
            body
          );
          break;

        case 'discord':
          verified = this.verifyDiscord(
            req.headers['x-signature-ed25519'],
            req.headers['x-signature-timestamp'],
            body
          );
          break;

        default:
          const signature = req.headers[this.headerNames.signature.toLowerCase()];
          verified = this.verifyHMAC(signature, body);
      }

      req.webhookVerified = verified;

      if (options.requireVerification && !verified) {
        return res.status(401).json({ error: 'Invalid webhook signature' });
      }

      next();
    };
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// AGENT-TO-AGENT COMMUNICATION PROTOCOL
// ═══════════════════════════════════════════════════════════════════════════

export class AgentCommunicator extends EventEmitter {
  constructor(config = {}) {
    super();

    this.agents = new Map();
    this.messageQueue = [];
    this.messageHistory = [];
    this.maxHistory = config.maxHistory || 1000;
    this.protocols = new Map();

    // Register default protocols
    this._registerDefaultProtocols();
  }

  _registerDefaultProtocols() {
    // Request-Response protocol
    this.registerProtocol('request-response', {
      description: 'Basic request-response communication',
      handler: async (message, sender, receiver) => {
        const response = await receiver.receiveMessage(message);
        return { type: 'response', data: response };
      }
    });

    // Broadcast protocol
    this.registerProtocol('broadcast', {
      description: 'Broadcast message to all agents',
      handler: async (message, sender) => {
        const responses = [];
        for (const [id, agent] of this.agents) {
          if (id !== sender.id) {
            try {
              const response = await agent.receiveMessage(message);
              responses.push({ agentId: id, response });
            } catch (error) {
              responses.push({ agentId: id, error: error.message });
            }
          }
        }
        return { type: 'broadcast-response', responses };
      }
    });

    // Delegate protocol
    this.registerProtocol('delegate', {
      description: 'Delegate task to another agent',
      handler: async (message, sender, receiver) => {
        const taskMessage = {
          type: 'delegated-task',
          originalSender: sender.id,
          task: message.task,
          context: message.context
        };
        return receiver.receiveMessage(taskMessage);
      }
    });

    // Collaboration protocol
    this.registerProtocol('collaborate', {
      description: 'Start collaborative work session',
      handler: async (message, sender, receiver) => {
        const sessionId = `collab_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const session = {
          id: sessionId,
          participants: [sender.id, receiver.id],
          topic: message.topic,
          startTime: Date.now(),
          messages: []
        };
        return { type: 'collab-start', session };
      }
    });

    // Consensus protocol (voting)
    this.registerProtocol('consensus', {
      description: 'Reach consensus through voting',
      handler: async (message, sender) => {
        const votes = [];
        for (const [id, agent] of this.agents) {
          if (id !== sender.id) {
            try {
              const vote = await agent.receiveMessage({
                type: 'vote-request',
                proposal: message.proposal,
                options: message.options
              });
              votes.push({ agentId: id, vote });
            } catch (error) {
              votes.push({ agentId: id, error: error.message });
            }
          }
        }
        // Tally votes
        const tally = {};
        for (const v of votes) {
          if (v.vote) {
            tally[v.vote] = (tally[v.vote] || 0) + 1;
          }
        }
        const winner = Object.entries(tally).sort((a, b) => b[1] - a[1])[0];
        return {
          type: 'consensus-result',
          votes,
          tally,
          winner: winner ? winner[0] : null
        };
      }
    });
  }

  /**
   * Register an agent for communication
   */
  registerAgent(agent) {
    this.agents.set(agent.id, agent);
    this.emit('agent:registered', { agentId: agent.id });
  }

  /**
   * Unregister an agent
   */
  unregisterAgent(agentId) {
    this.agents.delete(agentId);
    this.emit('agent:unregistered', { agentId });
  }

  /**
   * Get an agent by ID
   */
  getAgent(agentId) {
    return this.agents.get(agentId);
  }

  /**
   * Get all registered agents
   */
  getAllAgents() {
    return Array.from(this.agents.values());
  }

  /**
   * Register a communication protocol
   */
  registerProtocol(name, protocol) {
    this.protocols.set(name, protocol);
  }

  /**
   * Send a message from one agent to another
   */
  async sendMessage(fromAgentId, toAgentId, message, options = {}) {
    const sender = this.agents.get(fromAgentId);
    const receiver = this.agents.get(toAgentId);

    if (!sender) throw new Error(`Sender agent not found: ${fromAgentId}`);
    if (!receiver) throw new Error(`Receiver agent not found: ${toAgentId}`);

    const protocol = options.protocol || 'request-response';
    const protocolHandler = this.protocols.get(protocol);

    if (!protocolHandler) throw new Error(`Protocol not found: ${protocol}`);

    const messageEnvelope = {
      id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      from: fromAgentId,
      to: toAgentId,
      protocol,
      content: message,
      timestamp: Date.now(),
      metadata: options.metadata || {}
    };

    // Store in history
    this._addToHistory(messageEnvelope);

    // Use protocol handler
    const result = await protocolHandler.handler(message, sender, receiver);

    return {
      messageId: messageEnvelope.id,
      result
    };
  }

  /**
   * Send message using protocol
   */
  async useProtocol(protocolName, fromAgentId, targetAgentId, message, options = {}) {
    const protocol = this.protocols.get(protocolName);
    if (!protocol) throw new Error(`Protocol not found: ${protocolName}`);

    return this.sendMessage(fromAgentId, targetAgentId, message, {
      ...options,
      protocol: protocolName
    });
  }

  /**
   * Broadcast to all agents
   */
  async broadcast(fromAgentId, message, options = {}) {
    return this.sendMessage(fromAgentId, '*', message, {
      ...options,
      protocol: 'broadcast'
    });
  }

  /**
   * Delegate task to another agent
   */
  async delegate(fromAgentId, toAgentId, task, context = {}) {
    return this.sendMessage(fromAgentId, toAgentId, {
      task,
      context
    }, {
      protocol: 'delegate'
    });
  }

  /**
   * Request consensus from agents
   */
  async requestConsensus(fromAgentId, proposal, options = {}) {
    return this.sendMessage(fromAgentId, '*', {
      proposal,
      options: options.choices || ['yes', 'no', 'abstain']
    }, {
      protocol: 'consensus'
    });
  }

  /**
   * Get communication history
   */
  getHistory(filters = {}) {
    let history = [...this.messageHistory];

    if (filters.from) {
      history = history.filter(m => m.from === filters.from);
    }
    if (filters.to) {
      history = history.filter(m => m.to === filters.to);
    }
    if (filters.protocol) {
      history = history.filter(m => m.protocol === filters.protocol);
    }

    return history.slice(-(filters.limit || 100));
  }

  /**
   * Add message to history
   */
  _addToHistory(message) {
    this.messageHistory.push(message);
    if (this.messageHistory.length > this.maxHistory) {
      this.messageHistory.shift();
    }
  }

  /**
   * Get stats
   */
  getStats() {
    return {
      totalAgents: this.agents.size,
      totalProtocols: this.protocols.size,
      totalMessages: this.messageHistory.length,
      messagesByProtocol: this._getMessagesByProtocol()
    };
  }

  _getMessagesByProtocol() {
    const counts = {};
    for (const msg of this.messageHistory) {
      counts[msg.protocol] = (counts[msg.protocol] || 0) + 1;
    }
    return counts;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// REDIS-BACKED CACHE (Optional)
// ═══════════════════════════════════════════════════════════════════════════

export class RedisCache extends EventEmitter {
  constructor(config = {}) {
    super();

    this.host = config.host || 'localhost';
    this.port = config.port || 6379;
    this.password = config.password;
    this.db = config.db || 0;
    this.keyPrefix = config.keyPrefix || 'nexus:';
    this.defaultTTL = config.defaultTTL || 3600; // 1 hour

    this.client = null;
    this.connected = false;
    this.fallbackCache = new Map(); // In-memory fallback
    this.useFallback = true;
  }

  async connect() {
    try {
      // Dynamic import for optional dependency
      const redis = await import('redis');
      
      this.client = redis.createClient({
        socket: {
          host: this.host,
          port: this.port
        },
        password: this.password,
        database: this.db
      });

      this.client.on('error', (err) => {
        console.error('Redis error:', err);
        this.connected = false;
        this.useFallback = true;
        this.emit('error', err);
      });

      this.client.on('connect', () => {
        this.connected = true;
        this.useFallback = false;
        this.emit('connected');
      });

      this.client.on('disconnect', () => {
        this.connected = false;
        this.useFallback = true;
        this.emit('disconnected');
      });

      await this.client.connect();
      console.log('✅ Redis cache connected');
    } catch (error) {
      console.warn('⚠️ Redis not available, using in-memory fallback');
      this.useFallback = true;
      this.emit('fallback');
    }
  }

  _getKey(key) {
    return `${this.keyPrefix}${key}`;
  }

  async get(key) {
    const fullKey = this._getKey(key);

    if (this.useFallback || !this.client) {
      const item = this.fallbackCache.get(fullKey);
      if (item && item.expiry > Date.now()) {
        return item.value;
      }
      this.fallbackCache.delete(fullKey);
      return null;
    }

    try {
      const value = await this.client.get(fullKey);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      console.error('Redis get error:', error);
      return null;
    }
  }

  async set(key, value, ttl = null) {
    const fullKey = this._getKey(key);
    const expiry = ttl || this.defaultTTL;

    if (this.useFallback || !this.client) {
      this.fallbackCache.set(fullKey, {
        value,
        expiry: Date.now() + expiry * 1000
      });
      return true;
    }

    try {
      await this.client.setEx(fullKey, expiry, JSON.stringify(value));
      return true;
    } catch (error) {
      console.error('Redis set error:', error);
      return false;
    }
  }

  async delete(key) {
    const fullKey = this._getKey(key);

    if (this.useFallback || !this.client) {
      return this.fallbackCache.delete(fullKey);
    }

    try {
      return await this.client.del(fullKey);
    } catch (error) {
      console.error('Redis delete error:', error);
      return false;
    }
  }

  async has(key) {
    const value = await this.get(key);
    return value !== null;
  }

  async clear() {
    if (this.useFallback || !this.client) {
      this.fallbackCache.clear();
      return true;
    }

    try {
      const keys = await this.client.keys(`${this.keyPrefix}*`);
      if (keys.length > 0) {
        await this.client.del(keys);
      }
      return true;
    } catch (error) {
      console.error('Redis clear error:', error);
      return false;
    }
  }

  async getStats() {
    if (this.useFallback || !this.client) {
      return {
        type: 'memory',
        entries: this.fallbackCache.size,
        connected: false
      };
    }

    try {
      const info = await this.client.info();
      const keyspace = await this.client.dbSize();
      
      return {
        type: 'redis',
        entries: keyspace,
        connected: this.connected,
        info: info.split('\r\n').slice(0, 10).join(', ')
      };
    } catch (error) {
      return {
        type: 'redis',
        entries: 0,
        connected: false,
        error: error.message
      };
    }
  }

  async disconnect() {
    if (this.client) {
      try {
        await this.client.quit();
      } catch (error) {
        // Ignore
      }
    }
    this.fallbackCache.clear();
    this.connected = false;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════════════════

export default {
  RateLimiter,
  WebhookVerifier,
  AgentCommunicator,
  RedisCache
};
