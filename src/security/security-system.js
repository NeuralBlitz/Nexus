#!/usr/bin/env node

import { EventEmitter } from 'events';
import crypto from 'crypto';

// ═══════════════════════════════════════════════════════════════════════════
// SECURITY SYSTEM
// RBAC, API Keys, Rate Limiting, Audit Logging
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Permissions
 */
export const Permission = {
  // Agent permissions
  AGENTS_READ: 'agents:read',
  AGENTS_WRITE: 'agents:write',
  AGENTS_EXECUTE: 'agents:execute',
  AGENTS_ADMIN: 'agents:admin',

  // Provider permissions
  PROVIDERS_READ: 'providers:read',
  PROVIDERS_WRITE: 'providers:write',
  PROVIDERS_ADMIN: 'providers:admin',

  // Channel permissions
  CHANNELS_READ: 'channels:read',
  CHANNELS_WRITE: 'channels:write',
  CHANNELS_ADMIN: 'channels:admin',

  // System permissions
  SYSTEM_READ: 'system:read',
  SYSTEM_ADMIN: 'system:admin',

  // Data permissions
  DATA_READ: 'data:read',
  DATA_WRITE: 'data:write',
  DATA_DELETE: 'data:delete',

  // Plugin permissions
  PLUGINS_READ: 'plugins:read',
  PLUGINS_WRITE: 'plugins:write',
  PLUGINS_ADMIN: 'plugins:admin'
};

/**
 * Roles with permissions
 */
export const Roles = {
  SUPER_ADMIN: {
    name: 'Super Admin',
    description: 'Full system access',
    permissions: Object.values(Permission)
  },
  ADMIN: {
    name: 'Admin',
    description: 'Administrative access',
    permissions: [
      Permission.AGENTS_READ, Permission.AGENTS_WRITE, Permission.AGENTS_EXECUTE,
      Permission.PROVIDERS_READ, Permission.PROVIDERS_WRITE,
      Permission.CHANNELS_READ, Permission.CHANNELS_WRITE,
      Permission.SYSTEM_READ,
      Permission.DATA_READ, Permission.DATA_WRITE,
      Permission.PLUGINS_READ, Permission.PLUGINS_WRITE
    ]
  },
  OPERATOR: {
    name: 'Operator',
    description: 'Can execute tasks and manage agents',
    permissions: [
      Permission.AGENTS_READ, Permission.AGENTS_EXECUTE,
      Permission.PROVIDERS_READ,
      Permission.CHANNELS_READ,
      Permission.DATA_READ,
      Permission.PLUGINS_READ
    ]
  },
  USER: {
    name: 'User',
    description: 'Basic user access',
    permissions: [
      Permission.AGENTS_READ,
      Permission.PROVIDERS_READ,
      Permission.DATA_READ
    ]
  },
  VIEWER: {
    name: 'Viewer',
    description: 'Read-only access',
    permissions: [
      Permission.AGENTS_READ,
      Permission.PROVIDERS_READ,
      Permission.SYSTEM_READ
    ]
  }
};

/**
 * API Key class
 */
export class ApiKey {
  constructor(options = {}) {
    this.id = options.id || `key_${crypto.randomBytes(8).toString('hex')}`;
    this.name = options.name || 'Unnamed Key';
    this.key = this._generateKey();
    this.secret = this._generateSecret();
    this.userId = options.userId;
    this.role = options.role || 'USER';
    this.permissions = options.permissions || Roles[this.role]?.permissions || [];
    this.enabled = options.enabled !== false;
    this.expiresAt = options.expiresAt || null;
    this.rateLimit = options.rateLimit || { requests: 100, window: 60000 };
    this.allowedIps = options.allowedIps || [];
    this.allowedOrigins = options.allowedOrigins || [];

    // Metadata
    this.createdAt = Date.now();
    this.lastUsed = null;
    this.usageCount = 0;

    // Stats
    this.stats = {
      requests: 0,
      successful: 0,
      failed: 0,
      rateLimited: 0
    };
  }

  _generateKey() {
    return `nxk_${crypto.randomBytes(32).toString('hex')}`;
  }

  _generateSecret() {
    return `nxs_${crypto.randomBytes(64).toString('hex')}`;
  }

  /**
   * Check if key is valid
   */
  isValid() {
    if (!this.enabled) return false;
    if (this.expiresAt && Date.now() > this.expiresAt) return false;
    return true;
  }

  /**
   * Check if key has permission
   */
  hasPermission(permission) {
    return this.permissions.includes(permission);
  }

  /**
   * Record usage
   */
  recordUsage(success = true) {
    this.usageCount++;
    this.lastUsed = Date.now();
    this.stats.requests++;
    if (success) {
      this.stats.successful++;
    } else {
      this.stats.failed++;
    }
  }

  /**
   * To JSON (safe)
   */
  toJSON() {
    return {
      id: this.id,
      name: this.name,
      keyPrefix: this.key.substring(0, 10) + '...',
      userId: this.userId,
      role: this.role,
      enabled: this.enabled,
      expiresAt: this.expiresAt,
      createdAt: this.createdAt,
      lastUsed: this.lastUsed,
      usageCount: this.usageCount
    };
  }
}

/**
 * User class
 */
export class User {
  constructor(options = {}) {
    this.id = options.id || `user_${crypto.randomBytes(8).toString('hex')}`;
    this.username = options.username;
    this.email = options.email;
    this.role = options.role || 'USER';
    this.permissions = options.permissions || Roles[this.role]?.permissions || [];
    this.enabled = options.enabled !== false;
    this.metadata = options.metadata || {};

    // Stats
    this.createdAt = Date.now();
    this.lastLogin = null;
    this.loginCount = 0;

    // Sessions
    this.sessions = new Map();
  }

  /**
   * Check if user has permission
   */
  hasPermission(permission) {
    return this.permissions.includes(permission);
  }

  /**
   * Create a session
   */
  createSession(options = {}) {
    const session = {
      id: `sess_${crypto.randomBytes(16).toString('hex')}`,
      userId: this.id,
      createdAt: Date.now(),
      expiresAt: options.expiresAt || Date.now() + 3600000,
      ip: options.ip,
      userAgent: options.userAgent,
      metadata: options.metadata || {}
    };

    this.sessions.set(session.id, session);
    this.lastLogin = Date.now();
    this.loginCount++;

    return session;
  }

  /**
   * Validate session
   */
  validateSession(sessionId) {
    const session = this.sessions.get(sessionId);
    if (!session) return false;
    if (Date.now() > session.expiresAt) {
      this.sessions.delete(sessionId);
      return false;
    }
    return true;
  }

  /**
   * To JSON (safe)
   */
  toJSON() {
    return {
      id: this.id,
      username: this.username,
      role: this.role,
      enabled: this.enabled,
      createdAt: this.createdAt,
      lastLogin: this.lastLogin,
      loginCount: this.loginCount
    };
  }
}

/**
 * Audit Log Entry
 */
export class AuditEntry {
  constructor(event) {
    this.id = `audit_${Date.now()}_${crypto.randomBytes(6).toString('hex')}`;
    this.timestamp = Date.now();
    this.event = event.type;
    this.userId = event.userId;
    this.resource = event.resource;
    this.action = event.action;
    this.result = event.result; // 'success', 'failure', 'denied'
    this.details = event.details || {};
    this.ip = event.ip;
    this.userAgent = event.userAgent;
    this.duration = event.duration;
  }

  toJSON() {
    return {
      id: this.id,
      timestamp: this.timestamp,
      event: this.event,
      userId: this.userId,
      resource: this.resource,
      action: this.action,
      result: this.result,
      details: this.details,
      ip: this.ip,
      duration: this.duration
    };
  }
}

/**
 * Rate Limiter
 */
export class RateLimiter {
  constructor(options = {}) {
    this.limits = new Map();
    this.defaultLimit = options.defaultLimit || { requests: 100, window: 60000 };
    this.cleanupInterval = options.cleanupInterval || 60000;

    // Start cleanup
    setInterval(() => this._cleanup(), this.cleanupInterval);
  }

  /**
   * Check if request is allowed
   */
  check(key, limit = null) {
    const { requests, window } = limit || this.defaultLimit;
    const now = Date.now();

    if (!this.limits.has(key)) {
      this.limits.set(key, {
        count: 1,
        resetAt: now + window,
        firstRequest: now
      });
      return { allowed: true, remaining: requests - 1, resetAt: now + window };
    }

    const entry = this.limits.get(key);

    // Reset if window passed
    if (now > entry.resetAt) {
      entry.count = 1;
      entry.resetAt = now + window;
      entry.firstRequest = now;
      return { allowed: true, remaining: requests - 1, resetAt: entry.resetAt };
    }

    // Increment
    entry.count++;

    if (entry.count > requests) {
      return {
        allowed: false,
        remaining: 0,
        resetAt: entry.resetAt,
        retryAfter: entry.resetAt - now
      };
    }

    return {
      allowed: true,
      remaining: requests - entry.count,
      resetAt: entry.resetAt
    };
  }

  /**
   * Reset limit for key
   */
  reset(key) {
    this.limits.delete(key);
  }

  /**
   * Cleanup expired entries
   */
  _cleanup() {
    const now = Date.now();
    for (const [key, entry] of this.limits) {
      if (now > entry.resetAt + 60000) {
        this.limits.delete(key);
      }
    }
  }
}

/**
 * Security Manager
 */
export class SecurityManager extends EventEmitter {
  constructor(options = {}) {
    super();

    this.users = new Map();
    this.apiKeys = new Map();
    this.auditLog = [];
    this.rateLimiter = new RateLimiter(options.rateLimiter);

    // Security config
    this.config = {
      maxAuditLogSize: options.maxAuditLogSize || 10000,
      sessionTimeout: options.sessionTimeout || 3600000,
      apiKeyExpiry: options.apiKeyExpiry || 2592000000, // 30 days
      requireApiKey: options.requireApiKey !== false,
      ...options.config
    };

    // Create default admin user
    this.createUser({
      username: 'admin',
      email: 'admin@nexus.local',
      role: 'SUPER_ADMIN'
    });
  }

  /**
   * Create a user
   */
  createUser(options) {
    const user = new User(options);
    this.users.set(user.id, user);
    this.emit('user:created', { userId: user.id });
    return user;
  }

  /**
   * Get user
   */
  getUser(userId) {
    return this.users.get(userId);
  }

  /**
   * Get user by username
   */
  getUserByUsername(username) {
    return Array.from(this.users.values()).find(u => u.username === username);
  }

  /**
   * Create API key
   */
  createApiKey(options) {
    const apiKey = new ApiKey(options);
    this.apiKeys.set(apiKey.key, apiKey);
    this.emit('apikey:created', { keyId: apiKey.id });
    return apiKey;
  }

  /**
   * Validate API key
   */
  validateApiKey(key) {
    const apiKey = this.apiKeys.get(key);
    if (!apiKey) return null;
    if (!apiKey.isValid()) return null;
    return apiKey;
  }

  /**
   * Authenticate request
   */
  authenticate(req) {
    // Try API key first
    const apiKeyHeader = req.headers['x-api-key'] || req.headers['authorization']?.replace('Bearer ', '');

    if (apiKeyHeader) {
      const apiKey = this.validateApiKey(apiKeyHeader);
      if (apiKey) {
        apiKey.recordUsage(true);
        const user = this.users.get(apiKey.userId);
        return {
          authenticated: true,
          type: 'apikey',
          apiKey,
          user,
          permissions: apiKey.permissions
        };
      }
    }

    // Try session token
    const sessionToken = req.headers['x-session-token'];
    if (sessionToken) {
      for (const user of this.users.values()) {
        if (user.validateSession(sessionToken)) {
          return {
            authenticated: true,
            type: 'session',
            user,
            permissions: user.permissions
          };
        }
      }
    }

    return { authenticated: false };
  }

  /**
   * Check permission
   */
  checkPermission(auth, permission) {
    if (!auth.authenticated) return false;
    return auth.permissions.includes(permission);
  }

  /**
   * Require permission (throws if not authorized)
   */
  requirePermission(auth, permission) {
    if (!this.checkPermission(auth, permission)) {
      this.logAudit({
        type: 'authorization:denied',
        userId: auth.user?.id,
        action: permission,
        result: 'denied'
      });
      throw new Error(`Permission denied: ${permission}`);
    }
  }

  /**
   * Check rate limit
   */
  checkRateLimit(key) {
    const apiKey = this.apiKeys.get(key);
    const limit = apiKey?.rateLimit;
    return this.rateLimiter.check(key, limit);
  }

  /**
   * Log audit entry
   */
  logAudit(event) {
    const entry = new AuditEntry(event);
    this.auditLog.push(entry);

    // Trim if too large
    if (this.auditLog.length > this.config.maxAuditLogSize) {
      this.auditLog = this.auditLog.slice(-this.config.maxAuditLogSize);
    }

    this.emit('audit:log', entry);
    return entry;
  }

  /**
   * Get audit log
   */
  getAuditLog(options = {}) {
    const { userId, resource, action, result, limit = 100, offset = 0 } = options;

    let filtered = this.auditLog;

    if (userId) filtered = filtered.filter(e => e.userId === userId);
    if (resource) filtered = filtered.filter(e => e.resource === resource);
    if (action) filtered = filtered.filter(e => e.action === action);
    if (result) filtered = filtered.filter(e => e.result === result);

    return filtered.slice(offset, offset + limit);
  }

  /**
   * Generate secure token
   */
  generateToken(length = 32) {
    return crypto.randomBytes(length).toString('hex');
  }

  /**
   * Hash password
   */
  hashPassword(password, salt = null) {
    salt = salt || crypto.randomBytes(16).toString('hex');
    const hash = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
    return { hash, salt };
  }

  /**
   * Verify password
   */
  verifyPassword(password, hash, salt) {
    const computed = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
    try {
      return crypto.timingSafeEqual(Buffer.from(computed, 'hex'), Buffer.from(hash, 'hex'));
    } catch {
      return false;
    }
  }

  /**
   * Create JWT token
   */
  createJWT(payload, secret, options = {}) {
    const { expiresIn = 3600 } = options;
    const header = { alg: 'HS256', typ: 'JWT' };
    const now = Math.floor(Date.now() / 1000);
    const fullPayload = { ...payload, iat: now, exp: now + expiresIn };

    const encode = (obj) => Buffer.from(JSON.stringify(obj)).toString('base64url');
    const encodedHeader = encode(header);
    const encodedPayload = encode(fullPayload);
    const signature = crypto.createHmac('sha256', secret).update(`${encodedHeader}.${encodedPayload}`).digest('base64url');

    return `${encodedHeader}.${encodedPayload}.${signature}`;
  }

  /**
   * Verify JWT token
   */
  verifyJWT(token, secret) {
    try {
      const [header, payload, signature] = token.split('.');
      const expectedSig = crypto.createHmac('sha256', secret).update(`${header}.${payload}`).digest('base64url');

      if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSig))) {
        return { valid: false, error: 'Invalid signature' };
      }

      const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString());
      if (decoded.exp && decoded.exp < Math.floor(Date.now() / 1000)) {
        return { valid: false, error: 'Token expired' };
      }

      return { valid: true, payload: decoded };
    } catch (error) {
      return { valid: false, error: error.message };
    }
  }

  /**
   * Check if user has permission
   */
  hasPermission(userId, permission) {
    const user = this.users.get(userId);
    if (!user) return false;
    return user.hasPermission(permission);
  }

  /**
   * Get user's role and permissions
   */
  getUserPermissions(userId) {
    const user = this.users.get(userId);
    if (!user) return null;
    return {
      userId: user.id,
      username: user.username,
      role: user.role,
      permissions: Array.from(user.permissions)
    };
  }

  /**
   * Get recent audit log entries
   */
  getRecentAuditLog(count = 20) {
    return this.auditLog.slice(-count).reverse();
  }

  /**
   * Query audit log
   */
  queryAuditLog(filters = {}) {
    let results = [...this.auditLog];
    if (filters.userId) results = results.filter(e => e.userId === filters.userId);
    if (filters.action) results = results.filter(e => e.action === filters.action);
    if (filters.result) results = results.filter(e => e.result === filters.result);
    if (filters.since) results = results.filter(e => e.timestamp >= filters.since);
    return results.slice(-(filters.limit || 50));
  }

  /**
   * Get security stats
   */
  getStats() {
    return {
      users: this.users.size,
      apiKeys: this.apiKeys.size,
      auditLogSize: this.auditLog.length,
      activeApiKeys: Array.from(this.apiKeys.values()).filter(k => k.enabled).length
    };
  }
}

// Export singleton
let security = null;

export function getSecurityManager(options) {
  if (!security) {
    security = new SecurityManager(options);
  }
  return security;
}

export default {
  SecurityManager,
  ApiKey,
  User,
  AuditEntry,
  RateLimiter,
  Permission,
  Roles,
  getSecurityManager
};