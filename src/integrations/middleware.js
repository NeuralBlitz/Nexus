#!/usr/bin/env node

import { EventEmitter } from 'events';
import crypto from 'crypto';
import { WebSocket } from 'ws';

// ═══════════════════════════════════════════════════════════════════════════
// WEBSOCKET AUTHENTICATION MIDDLEWARE
// ═══════════════════════════════════════════════════════════════════════════

export class WebSocketAuth extends EventEmitter {
  constructor(config = {}) {
    super();

    this.secret = config.secret || process.env.WS_AUTH_SECRET || crypto.randomBytes(32).toString('hex');
    this.tokenExpiry = config.tokenExpiry || 3600000; // 1 hour
    this.sessions = new Map();
    this.revokedTokens = new Set();

    // Cleanup interval for expired sessions
    this.cleanupInterval = setInterval(() => this.cleanup(), 60000);
  }

  /**
   * Generate a session token for WebSocket connection
   */
  generateToken(userId, metadata = {}) {
    const tokenId = crypto.randomBytes(16).toString('hex');
    const timestamp = Date.now();
    const payload = {
      id: tokenId,
      userId,
      metadata,
      createdAt: timestamp,
      expiresAt: timestamp + this.tokenExpiry
    };

    // Create signature
    const data = JSON.stringify(payload);
    const signature = crypto
      .createHmac('sha256', this.secret)
      .update(data)
      .digest('hex');

    const token = Buffer.from(JSON.stringify({ payload, signature })).toString('base64');

    // Store session
    this.sessions.set(tokenId, payload);

    return token;
  }

  /**
   * Verify a WebSocket token
   */
  verifyToken(token) {
    try {
      const decoded = JSON.parse(Buffer.from(token, 'base64').toString());
      const { payload, signature } = decoded;

      // Check if token is revoked
      if (this.revokedTokens.has(payload.id)) {
        return { valid: false, error: 'Token revoked' };
      }

      // Verify signature
      const data = JSON.stringify(payload);
      const expectedSignature = crypto
        .createHmac('sha256', this.secret)
        .update(data)
        .digest('hex');

      if (signature !== expectedSignature) {
        return { valid: false, error: 'Invalid signature' };
      }

      // Check expiry
      if (Date.now() > payload.expiresAt) {
        this.sessions.delete(payload.id);
        return { valid: false, error: 'Token expired' };
      }

      // Update last activity
      payload.lastActivity = Date.now();
      this.sessions.set(payload.id, payload);

      return { valid: true, session: payload };
    } catch (error) {
      return { valid: false, error: 'Invalid token format' };
    }
  }

  /**
   * Revoke a token
   */
  revokeToken(tokenId) {
    this.revokedTokens.add(tokenId);
    this.sessions.delete(tokenId);
  }

  /**
   * Revoke all tokens for a user
   */
  revokeUserTokens(userId) {
    for (const [id, session] of this.sessions) {
      if (session.userId === userId) {
        this.revokedTokens.add(id);
        this.sessions.delete(id);
      }
    }
  }

  /**
   * WebSocket upgrade middleware
   */
  middleware() {
    return (request, socket, head, next) => {
      const url = new URL(request.url, `http://${request.headers.host}`);
      const token = url.searchParams.get('token') || request.headers['authorization']?.replace('Bearer ', '');

      if (!token) {
        if (this.allowAnonymous) {
          request.wsSession = { anonymous: true, userId: 'anonymous' };
          return next();
        }
        socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
        socket.destroy();
        return;
      }

      const result = this.verifyToken(token);

      if (!result.valid) {
        socket.write(`HTTP/1.1 401 Unauthorized: ${result.error}\r\n\r\n`);
        socket.destroy();
        return;
      }

      request.wsSession = result.session;
      next();
    };
  }

  /**
   * Clean up expired sessions
   */
  cleanup() {
    const now = Date.now();
    for (const [id, session] of this.sessions) {
      if (now > session.expiresAt) {
        this.sessions.delete(id);
      }
    }
  }

  /**
   * Get session stats
   */
  getStats() {
    return {
      activeSessions: this.sessions.size,
      revokedTokens: this.revokedTokens.size
    };
  }

  /**
   * Destroy the auth handler
   */
  destroy() {
    clearInterval(this.cleanupInterval);
    this.sessions.clear();
    this.revokedTokens.clear();
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// CORS MIDDLEWARE
// ═══════════════════════════════════════════════════════════════════════════

export class CorsMiddleware {
  constructor(config = {}) {
    this.origin = config.origin || '*';
    this.methods = config.methods || ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'];
    this.allowedHeaders = config.allowedHeaders || ['Content-Type', 'Authorization', 'X-API-Key', 'X-Request-ID'];
    this.exposedHeaders = config.exposedHeaders || ['X-Request-ID', 'X-RateLimit-Remaining', 'X-RateLimit-Reset'];
    this.credentials = config.credentials || false;
    this.maxAge = config.maxAge || 86400;
    this.preflightContinue = config.preflightContinue || false;
  }

  /**
   * Express middleware
   */
  middleware() {
    return (req, res, next) => {
      // Set CORS headers
      if (this.origin === '*') {
        res.setHeader('Access-Control-Allow-Origin', '*');
      } else if (Array.isArray(this.origin)) {
        const requestOrigin = req.headers.origin;
        if (this.origin.includes(requestOrigin)) {
          res.setHeader('Access-Control-Allow-Origin', requestOrigin);
        }
      } else {
        res.setHeader('Access-Control-Allow-Origin', this.origin);
      }

      res.setHeader('Access-Control-Allow-Methods', this.methods.join(', '));
      res.setHeader('Access-Control-Allow-Headers', this.allowedHeaders.join(', '));
      res.setHeader('Access-Control-Expose-Headers', this.exposedHeaders.join(', '));
      res.setHeader('Access-Control-Max-Age', this.maxAge.toString());

      if (this.credentials) {
        res.setHeader('Access-Control-Allow-Credentials', 'true');
      }

      // Handle preflight requests
      if (req.method === 'OPTIONS') {
        if (this.preflightContinue) {
          return next();
        }
        return res.status(204).end();
      }

      next();
    };
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// REQUEST LOGGER MIDDLEWARE
// ═══════════════════════════════════════════════════════════════════════════

export class RequestLogger extends EventEmitter {
  constructor(config = {}) {
    super();

    this.logLevel = config.logLevel || 'info'; // 'debug', 'info', 'warn', 'error'
    this.logBody = config.logBody || false;
    this.logHeaders = config.logHeaders || false;
    this.sensitiveHeaders = config.sensitiveHeaders || ['authorization', 'cookie', 'x-api-key'];
    this.maxBodyLength = config.maxBodyLength || 1000;
    this.includeUserAgent = config.includeUserAgent !== false;
    this.customFields = config.customFields || [];

    this.logs = [];
    this.maxLogs = config.maxLogs || 10000;
  }

  /**
   * Check if should log based on level
   */
  shouldLog(level) {
    const levels = { debug: 0, info: 1, warn: 2, error: 3 };
    return levels[level] >= levels[this.logLevel];
  }

  /**
   * Sanitize headers
   */
  sanitizeHeaders(headers) {
    const sanitized = { ...headers };
    for (const key of this.sensitiveHeaders) {
      if (sanitized[key]) {
        sanitized[key] = '[REDACTED]';
      }
    }
    return sanitized;
  }

  /**
   * Log a request
   */
  logRequest(req, res, duration, error = null) {
    const entry = {
      id: req.requestId || crypto.randomBytes(8).toString('hex'),
      timestamp: new Date().toISOString(),
      method: req.method,
      path: req.originalUrl || req.url,
      status: res.statusCode,
      duration: Math.round(duration),
      ip: req.ip || req.socket.remoteAddress,
      userId: req.auth?.userId || req.wsSession?.userId || 'anonymous'
    };

    if (this.includeUserAgent) {
      entry.userAgent = req.headers['user-agent'];
    }

    if (this.logHeaders) {
      entry.headers = this.sanitizeHeaders(req.headers);
    }

    if (this.logBody && req.body) {
      const bodyStr = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
      entry.body = bodyStr.length > this.maxBodyLength 
        ? bodyStr.substring(0, this.maxBodyLength) + '...' 
        : bodyStr;
    }

    if (error) {
      entry.error = error.message;
      entry.level = 'error';
    } else if (res.statusCode >= 500) {
      entry.level = 'error';
    } else if (res.statusCode >= 400) {
      entry.level = 'warn';
    } else {
      entry.level = 'info';
    }

    // Add custom fields
    for (const field of this.customFields) {
      if (req[field] !== undefined) {
        entry[field] = req[field];
      }
    }

    // Store log
    this.logs.push(entry);
    if (this.logs.length > this.maxLogs) {
      this.logs.shift();
    }

    // Emit event
    this.emit('log', entry);

    // Console output
    if (this.shouldLog(entry.level)) {
      const colorCode = {
        debug: '\x1b[90m',
        info: '\x1b[36m',
        warn: '\x1b[33m',
        error: '\x1b[31m'
      }[entry.level];

      console.log(
        `${colorCode}[${entry.level.toUpperCase()}]\x1b[0m ${entry.method} ${entry.path} ${entry.status} ${entry.duration}ms`
      );
    }

    return entry;
  }

  /**
   * Express middleware
   */
  middleware() {
    return (req, res, next) => {
      const startTime = Date.now();
      req.requestId = req.requestId || `req_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
      res.setHeader('X-Request-ID', req.requestId);

      // Capture response end
      const originalEnd = res.end;
      res.end = function(chunk, encoding) {
        const duration = Date.now() - startTime;
        this.logRequest(req, res, duration);
        return originalEnd.call(this, chunk, encoding);
      }.bind(this);

      next();
    };
  }

  /**
   * Get logs
   */
  getLogs(filters = {}) {
    let logs = [...this.logs];

    if (filters.level) {
      logs = logs.filter(l => l.level === filters.level);
    }
    if (filters.method) {
      logs = logs.filter(l => l.method === filters.method);
    }
    if (filters.status) {
      logs = logs.filter(l => l.status === filters.status);
    }
    if (filters.userId) {
      logs = logs.filter(l => l.userId === filters.userId);
    }
    if (filters.since) {
      logs = logs.filter(l => new Date(l.timestamp) >= new Date(filters.since));
    }

    return logs.slice(-(filters.limit || 100));
  }

  /**
   * Get stats
   */
  getStats() {
    const stats = {
      total: this.logs.length,
      byLevel: {},
      byMethod: {},
      byStatus: {},
      avgDuration: 0
    };

    let totalDuration = 0;

    for (const log of this.logs) {
      stats.byLevel[log.level] = (stats.byLevel[log.level] || 0) + 1;
      stats.byMethod[log.method] = (stats.byMethod[log.method] || 0) + 1;
      stats.byStatus[log.status] = (stats.byStatus[log.status] || 0) + 1;
      totalDuration += log.duration;
    }

    stats.avgDuration = this.logs.length > 0 ? Math.round(totalDuration / this.logs.length) : 0;

    return stats;
  }

  /**
   * Clear logs
   */
  clear() {
    this.logs = [];
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// COMPRESSION MIDDLEWARE (Simple Implementation)
// ═══════════════════════════════════════════════════════════════════════════

export class CompressionMiddleware {
  constructor(config = {}) {
    this.threshold = config.threshold || 1024; // Don't compress smaller than 1KB
    this.level = config.level || 6; // Compression level 1-9
    this.types = config.types || [
      'text/plain',
      'text/html',
      'text/css',
      'text/javascript',
      'application/json',
      'application/javascript',
      'application/xml',
      'image/svg+xml'
    ];
  }

  /**
   * Check if content should be compressed
   */
  shouldCompress(contentType, contentLength) {
    if (contentLength < this.threshold) return false;
    
    for (const type of this.types) {
      if (contentType.includes(type)) return true;
    }
    
    return false;
  }

  /**
   * Express middleware
   */
  middleware() {
    return async (req, res, next) => {
      const acceptEncoding = req.headers['accept-encoding'] || '';

      // Store original send/json methods
      const originalSend = res.send;
      const originalJson = res.json;

      const compress = async (data) => {
        const contentType = res.getHeader('content-type') || '';
        const dataStr = typeof data === 'string' ? data : JSON.stringify(data);
        const dataBuffer = Buffer.from(dataStr);

        if (!this.shouldCompress(contentType, dataBuffer.length)) {
          return dataBuffer;
        }

        // Try gzip
        if (acceptEncoding.includes('gzip')) {
          try {
            const { gzip } = await import('zlib');
            const compressed = await new Promise((resolve, reject) => {
              gzip(dataBuffer, (err, result) => {
                if (err) reject(err);
                else resolve(result);
              });
            });
            
            res.setHeader('Content-Encoding', 'gzip');
            res.setHeader('Content-Length', compressed.length);
            return compressed;
          } catch (error) {
            // Fall through
          }
        }

        // Try deflate
        if (acceptEncoding.includes('deflate')) {
          try {
            const { deflate } = await import('zlib');
            const compressed = await new Promise((resolve, reject) => {
              deflate(dataBuffer, (err, result) => {
                if (err) reject(err);
                else resolve(result);
              });
            });
            
            res.setHeader('Content-Encoding', 'deflate');
            res.setHeader('Content-Length', compressed.length);
            return compressed;
          } catch (error) {
            // Fall through
          }
        }

        return dataBuffer;
      };

      // Override send
      res.send = async function(data) {
        const compressed = await compress(data);
        res.setHeader('Content-Length', compressed.length);
        return originalSend.call(this, compressed);
      };

      // Override json
      res.json = async function(data) {
        res.setHeader('Content-Type', 'application/json');
        const compressed = await compress(JSON.stringify(data));
        res.setHeader('Content-Length', compressed.length);
        return originalSend.call(this, compressed);
      };

      next();
    };
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// HEALTH CHECK MIDDLEWARE
// ═══════════════════════════════════════════════════════════════════════════

export class HealthChecker extends EventEmitter {
  constructor(config = {}) {
    super();

    this.checks = new Map();
    this.timeout = config.timeout || 5000;
    this.history = [];
    this.maxHistory = config.maxHistory || 100;

    // Register default checks
    this.registerCheck('memory', async () => {
      const usage = process.memoryUsage();
      return {
        healthy: usage.heapUsed / usage.heapTotal < 0.9,
        details: {
          heapUsed: Math.round(usage.heapUsed / 1024 / 1024),
          heapTotal: Math.round(usage.heapTotal / 1024 / 1024),
          rss: Math.round(usage.rss / 1024 / 1024),
          external: Math.round(usage.external / 1024 / 1024)
        }
      };
    });

    this.registerCheck('uptime', async () => {
      return {
        healthy: true,
        details: {
          uptime: process.uptime(),
          startedAt: new Date(Date.now() - process.uptime() * 1000).toISOString()
        }
      };
    });
  }

  /**
   * Register a health check
   */
  registerCheck(name, handler, options = {}) {
    this.checks.set(name, {
      name,
      handler,
      critical: options.critical || false,
      timeout: options.timeout || this.timeout
    });
  }

  /**
   * Remove a health check
   */
  unregisterCheck(name) {
    this.checks.delete(name);
  }

  /**
   * Run all health checks
   */
  async runChecks() {
    const results = {
      healthy: true,
      timestamp: new Date().toISOString(),
      checks: {},
      duration: 0
    };

    const startTime = Date.now();
    const promises = [];

    for (const [name, check] of this.checks) {
      promises.push(
        Promise.race([
          check.handler().then(result => ({ name, ...result, timeout: false })),
          new Promise((resolve) => 
            setTimeout(() => resolve({ 
              name, 
              healthy: false, 
              error: 'Check timed out',
              timeout: true 
            }), check.timeout)
          )
        ]).catch(error => ({
          name,
          healthy: false,
          error: error.message
        }))
      );
    }

    const checkResults = await Promise.all(promises);

    for (const result of checkResults) {
      results.checks[result.name] = {
        healthy: result.healthy,
        details: result.details || {},
        error: result.error || null,
        timeout: result.timeout || false
      };

      if (!result.healthy) {
        results.healthy = false;
      }
    }

    results.duration = Date.now() - startTime;
    results.status = results.healthy ? 'healthy' : 'unhealthy';

    // Store in history
    this.history.push(results);
    if (this.history.length > this.maxHistory) {
      this.history.shift();
    }

    // Emit event
    this.emit('check', results);

    return results;
  }

  /**
   * Express middleware for health endpoint
   */
  middleware(options = {}) {
    return async (req, res) => {
      try {
        const results = await this.runChecks();
        const statusCode = results.healthy ? 200 : 503;
        res.status(statusCode).json(results);
      } catch (error) {
        res.status(500).json({
          healthy: false,
          status: 'error',
          error: error.message
        });
      }
    };
  }

  /**
   * Get health history
   */
  getHistory(limit = 10) {
    return this.history.slice(-limit);
  }

  /**
   * Get stats
   */
  getStats() {
    const totalChecks = this.history.length;
    const healthyChecks = this.history.filter(h => h.healthy).length;

    return {
      totalChecks,
      healthyChecks,
      unhealthyChecks: totalChecks - healthyChecks,
      checkCount: this.checks.size,
      historySize: this.history.length
    };
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// API KEY ROTATION MIDDLEWARE
// ═══════════════════════════════════════════════════════════════════════════

export class APIKeyManager extends EventEmitter {
  constructor(config = {}) {
    super();

    this.keys = new Map();
    this.rotationInterval = config.rotationInterval || 86400000; // 24 hours
    this.gracePeriod = config.gracePeriod || 3600000; // 1 hour
    this.prefix = config.prefix || 'nxk_';
    this.keyLength = config.keyLength || 32;
  }

  /**
   * Generate a new API key
   */
  generateKey(options = {}) {
    const keyId = crypto.randomBytes(16).toString('hex');
    const keyValue = this.prefix + crypto.randomBytes(this.keyLength).toString('hex');
    
    const key = {
      id: keyId,
      key: keyValue,
      name: options.name || 'API Key',
      userId: options.userId || 'system',
      role: options.role || 'user',
      permissions: options.permissions || ['read'],
      createdAt: Date.now(),
      expiresAt: options.expiresAt || Date.now() + this.rotationInterval,
      lastUsed: null,
      usageCount: 0,
      active: true
    };

    this.keys.set(keyId, key);
    this.keys.set(keyValue, key); // Allow lookup by key value

    this.emit('created', key);

    return key;
  }

  /**
   * Validate an API key
   */
  validateKey(keyValue) {
    const key = this.keys.get(keyValue);

    if (!key) {
      return { valid: false, error: 'Invalid API key' };
    }

    if (!key.active) {
      return { valid: false, error: 'API key is deactivated' };
    }

    if (Date.now() > key.expiresAt) {
      // Check grace period for rotation
      if (Date.now() > key.expiresAt + this.gracePeriod) {
        return { valid: false, error: 'API key expired' };
      }
      return { valid: true, key, warning: 'Key expired, grace period active' };
    }

    // Update usage
    key.lastUsed = Date.now();
    key.usageCount++;

    return { valid: true, key };
  }

  /**
   * Rotate a key (creates new, marks old for grace period)
   */
  rotateKey(keyId) {
    const oldKey = this.keys.get(keyId);
    if (!oldKey) {
      throw new Error('Key not found');
    }

    // Create new key with same permissions
    const newKey = this.generateKey({
      name: oldKey.name + ' (rotated)',
      userId: oldKey.userId,
      role: oldKey.role,
      permissions: oldKey.permissions
    });

    // Mark old key for grace period expiry
    oldKey.expiresAt = Date.now();
    oldKey.rotatedTo = newKey.id;

    this.emit('rotated', { oldKey, newKey });

    return newKey;
  }

  /**
   * Deactivate a key
   */
  deactivateKey(keyValue) {
    const key = this.keys.get(keyValue);
    if (key) {
      key.active = false;
      this.emit('deactivated', key);
      return true;
    }
    return false;
  }

  /**
   * Delete a key
   */
  deleteKey(keyId) {
    const key = this.keys.get(keyId);
    if (key) {
      this.keys.delete(keyId);
      this.keys.delete(key.key);
      this.emit('deleted', key);
      return true;
    }
    return false;
  }

  /**
   * Get all keys (sanitized)
   */
  getAllKeys() {
    const uniqueKeys = new Map();
    
    for (const [idOrKey, key] of this.keys) {
      if (idOrKey === key.id) {
        uniqueKeys.set(key.id, {
          id: key.id,
          name: key.name,
          userId: key.userId,
          role: key.role,
          permissions: key.permissions,
          createdAt: new Date(key.createdAt).toISOString(),
          expiresAt: new Date(key.expiresAt).toISOString(),
          lastUsed: key.lastUsed ? new Date(key.lastUsed).toISOString() : null,
          usageCount: key.usageCount,
          active: key.active
        });
      }
    }

    return Array.from(uniqueKeys.values());
  }

  /**
   * Get keys for a user
   */
  getUserKeys(userId) {
    return this.getAllKeys().filter(k => k.userId === userId);
  }

  /**
   * Express middleware
   */
  middleware() {
    return (req, res, next) => {
      const apiKey = req.headers['x-api-key'];
      
      if (!apiKey) {
        req.apiKey = null;
        return next();
      }

      const result = this.validateKey(apiKey);

      if (!result.valid) {
        return res.status(401).json({ error: result.error });
      }

      req.apiKey = result.key;
      req.auth = {
        userId: result.key.userId,
        role: result.key.role,
        permissions: result.key.permissions
      };

      if (result.warning) {
        res.setHeader('X-API-Key-Warning', result.warning);
      }

      next();
    };
  }

  /**
   * Get stats
   */
  getStats() {
    const allKeys = this.getAllKeys();
    const activeKeys = allKeys.filter(k => k.active);
    const expiredKeys = allKeys.filter(k => new Date(k.expiresAt) < new Date());

    return {
      total: allKeys.length,
      active: activeKeys.length,
      expired: expiredKeys.length,
      totalUsage: allKeys.reduce((sum, k) => sum + k.usageCount, 0)
    };
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════════════════

export default {
  WebSocketAuth,
  CorsMiddleware,
  RequestLogger,
  CompressionMiddleware,
  HealthChecker,
  APIKeyManager
};
