import { EventEmitter } from 'events';
import crypto from 'crypto';

export class APIKey {
  constructor(config) {
    this.id = config.id || crypto.randomBytes(16).toString('hex');
    this.key = config.key || this.generateKey(config.prefix || 'nxs');
    this.name = config.name;
    this.userId = config.userId;
    this.scopes = new Set(config.scopes || ['read']);
    this.createdAt = Date.now();
    this.expiresAt = config.expiresAt || null;
    this.lastUsedAt = null;
    this.revoked = false;
    this.metadata = config.metadata || {};
  }

  generateKey(prefix) {
    return `${prefix}_${crypto.randomBytes(32).toString('hex')}`;
  }

  isValid() {
    if (this.revoked) return false;
    if (this.expiresAt && Date.now() > this.expiresAt) return false;
    return true;
  }

  hasScope(scope) {
    if (this.scopes.has('admin')) return true;
    return this.scopes.has(scope);
  }

  revoke() {
    this.revoked = true;
  }

  touch() {
    this.lastUsedAt = Date.now();
  }

  toJSON() {
    return {
      id: this.id,
      key: this.key,
      name: this.name,
      userId: this.userId,
      scopes: Array.from(this.scopes),
      createdAt: this.createdAt,
      expiresAt: this.expiresAt,
      lastUsedAt: this.lastUsedAt,
      revoked: this.revoked
    };
  }
}

export class APIVersion {
  constructor(version, options = {}) {
    this.version = version;
    this.deprecated = options.deprecated || false;
    this.sunsetAt = options.sunsetAt || null;
    this.addedAt = options.addedAt || Date.now();
    this.routes = new Map();
  }

  addRoute(path, methods = ['GET']) {
    this.routes.set(path, methods);
  }

  isActive() {
    if (this.deprecated && this.sunsetAt && Date.now() > this.sunsetAt) {
      return false;
    }
    return true;
  }
}

export class APIVersioning extends EventEmitter {
  constructor(options = {}) {
    super();

    this.versions = new Map();
    this.keys = new Map();
    this.rateLimits = new Map();
    this.middleware = [];

    this.defaultVersion = options.defaultVersion || 'v1';
    this.supportedVersions = options.supportedVersions || ['v1'];

    this.registerVersion('v1', { addedAt: Date.now() });
    this.registerVersion('v2', { addedAt: Date.now() });
  }

  registerVersion(version, options = {}) {
    const apiVersion = new APIVersion(version, options);
    this.versions.set(version, apiVersion);
    this.emit('version:registered', apiVersion);
    return apiVersion;
  }

  deprecateVersion(version, sunsetAt) {
    const apiVersion = this.versions.get(version);
    if (apiVersion) {
      apiVersion.deprecated = true;
      apiVersion.sunsetAt = sunsetAt;
      this.emit('version:deprecated', apiVersion);
    }
  }

  createKey(name, options = {}) {
    const apiKey = new APIKey({ name, ...options });
    this.keys.set(apiKey.id, apiKey);
    this.emit('key:created', apiKey);
    return apiKey;
  }

  getKey(keyId) {
    return this.keys.get(keyId);
  }

  validateKey(key) {
    const apiKey = Array.from(this.keys.values()).find(k => k.key === key);
    if (!apiKey) return { valid: false, error: 'Invalid API key' };
    if (!apiKey.isValid()) return { valid: false, error: 'API key expired or revoked' };
    apiKey.touch();
    return { valid: true, key: apiKey };
  }

  revokeKey(keyId) {
    const key = this.keys.get(keyId);
    if (key) {
      key.revoke();
      this.emit('key:revoked', key);
      return true;
    }
    return false;
  }

  checkScope(keyId, scope) {
    const key = this.keys.get(keyId);
    if (!key) return false;
    return key.hasScope(scope);
  }

  setRateLimit(keyId, limit) {
    this.rateLimits.set(keyId, {
      limit,
      remaining: limit,
      resetAt: Date.now() + 60000
    });
  }

  checkRateLimit(keyId) {
    const rateLimit = this.rateLimits.get(keyId);
    if (!rateLimit) return { allowed: true };

    if (Date.now() > rateLimit.resetAt) {
      rateLimit.remaining = rateLimit.limit;
      rateLimit.resetAt = Date.now() + 60000;
    }

    if (rateLimit.remaining <= 0) {
      return { allowed: false, retryAfter: Math.ceil((rateLimit.resetAt - Date.now()) / 1000) };
    }

    rateLimit.remaining--;
    return { allowed: true, remaining: rateLimit.remaining };
  }

  use(middleware) {
    this.middleware.push(middleware);
  }

  parseVersion(req) {
    const versionHeader = req.headers['api-version'];
    const versionParam = req.query.version;

    let version = versionParam || versionHeader || this.defaultVersion;

    if (!this.versions.has(version)) {
      version = this.defaultVersion;
    }

    return version;
  }

  createRouter(version) {
    const apiVersion = this.versions.get(version);
    if (!apiVersion) {
      throw new Error(`API version not found: ${version}`);
    }

    return {
      get: (path, handler) => this.addRoute(version, 'GET', path, handler),
      post: (path, handler) => this.addRoute(version, 'POST', path, handler),
      put: (path, handler) => this.addRoute(version, 'PUT', path, handler),
      patch: (path, handler) => this.addRoute(version, 'PATCH', path, handler),
      delete: (path, handler) => this.addRoute(version, 'DELETE', path, handler)
    };
  }

  addRoute(version, method, path, handler) {
    const apiVersion = this.versions.get(version);
    if (apiVersion) {
      apiVersion.addRoute(path, [method]);
      this.emit('route:added', { version, method, path });
    }
  }

  getActiveVersions() {
    return Array.from(this.versions.values())
      .filter(v => v.isActive())
      .map(v => v.version);
  }

  getStats() {
    return {
      versions: Array.from(this.versions.entries()).map(([name, v]) => ({
        name,
        deprecated: v.deprecated,
        routes: v.routes.size,
        isActive: v.isActive()
      })),
      totalKeys: this.keys.size,
      activeKeys: Array.from(this.keys.values()).filter(k => k.isValid()).length
    };
  }
}

let apiVersioning = null;

export function getAPIVersioning(options = {}) {
  if (!apiVersioning) {
    apiVersioning = new APIVersioning(options);
  }
  return apiVersioning;
}

export default { APIVersioning, APIVersion, APIKey, getAPIVersioning };
