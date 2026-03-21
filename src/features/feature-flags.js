#!/usr/bin/env node

import { EventEmitter } from 'events';
import crypto from 'crypto';

// ═══════════════════════════════════════════════════════════════════════════
// FEATURE FLAGS SYSTEM
// Feature toggles, percentage rollouts, user targeting, A/B testing
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Feature flag evaluation context
 */
export class EvaluationContext {
  constructor(options = {}) {
    this.userId = options.userId || null;
    this.userEmail = options.userEmail || null;
    this.userRoles = options.userRoles || [];
    this.userSegments = options.userSegments || [];
    this.attributes = options.attributes || {};
    this.environment = options.environment || process.env.NODE_ENV || 'development';
  }

  /**
   * Get consistent hash for percentage rollouts
   */
  getHash(key = null) {
    const seed = key || this.userId || this.userEmail || 'anonymous';
    const hash = crypto.createHash('md5').update(seed).digest('hex');
    return parseInt(hash.substring(0, 8), 16) / 0xffffffff;
  }
}

/**
 * Feature flag variation
 */
export class FlagVariation {
  constructor(config) {
    this.id = config.id || crypto.randomBytes(4).toString('hex');
    this.name = config.name;
    this.value = config.value;
    this.weight = config.weight || 100; // For A/B testing
  }

  /**
   * Check if this variation should be used based on hash
   */
  shouldUse(hash) {
    const threshold = this.weight / 100;
    return hash < threshold;
  }
}

/**
 * Targeting rule
 */
export class TargetingRule {
  constructor(config) {
    this.attribute = config.attribute;
    this.operator = config.operator; // 'eq', 'neq', 'in', 'not_in', 'contains', 'gt', 'lt', 'gte', 'lte', 'regex'
    this.values = Array.isArray(config.values) ? config.values : [config.values];
  }

  /**
   * Evaluate rule against context
   */
  evaluate(context) {
    let value;

    // Get value from context
    if (this.attribute === 'userId') value = context.userId;
    else if (this.attribute === 'userEmail') value = context.userEmail;
    else if (this.attribute === 'environment') value = context.environment;
    else value = context.attributes[this.attribute];

    // Evaluate based on operator
    switch (this.operator) {
      case 'eq':
        return value === this.values[0];
      case 'neq':
        return value !== this.values[0];
      case 'in':
        return this.values.includes(value);
      case 'not_in':
        return !this.values.includes(value);
      case 'contains':
        return typeof value === 'string' && value.includes(this.values[0]);
      case 'gt':
        return value > this.values[0];
      case 'lt':
        return value < this.values[0];
      case 'gte':
        return value >= this.values[0];
      case 'lte':
        return value <= this.values[0];
      case 'regex':
        return new RegExp(this.values[0]).test(value);
      default:
        return false;
    }
  }
}

/**
 * Feature Flag
 */
export class FeatureFlag {
  constructor(config) {
    this.key = config.key;
    this.name = config.name || config.key;
    this.description = config.description || '';
    this.enabled = config.enabled !== false;
    this.defaultValue = config.defaultValue !== undefined ? config.defaultValue : false;

    // Variations (for A/B testing)
    this.variations = (config.variations || []).map(v => 
      v instanceof FlagVariation ? v : new FlagVariation(v)
    );

    // Targeting rules
    this.rules = (config.rules || []).map(r =>
      r instanceof TargetingRule ? r : new TargetingRule(r)
    );

    // Percentage rollout (0-100)
    this.percentage = config.percentage || 100;

    // User ID list (exact match)
    this.userList = config.userList || [];

    // User ID blacklist
    this.blacklist = config.blacklist || [];

    // Environment filter
    this.environments = config.environments || ['development', 'staging', 'production'];

    // Metadata
    this.createdAt = Date.now();
    this.updatedAt = Date.now();
    this.version = config.version || 1;

    // Tags
    this.tags = config.tags || [];
  }

  /**
   * Evaluate flag for context
   */
  evaluate(context) {
    // Check if flag is enabled
    if (!this.enabled) {
      return { value: this.defaultValue, variation: null, reason: 'flag_disabled' };
    }

    // Check environment
    if (!this.environments.includes(context.environment)) {
      return { value: this.defaultValue, variation: null, reason: 'environment_not_allowed' };
    }

    // Check blacklist
    if (context.userId && this.blacklist.includes(context.userId)) {
      return { value: this.defaultValue, variation: null, reason: 'user_blacklisted' };
    }

    // Check user list (exact match takes priority)
    if (this.userList.length > 0 && context.userId) {
      if (this.userList.includes(context.userId)) {
        return { value: true, variation: 'user_list', reason: 'user_in_list' };
      }
      return { value: this.defaultValue, variation: null, reason: 'user_not_in_list' };
    }

    // Evaluate targeting rules
    for (const rule of this.rules) {
      if (!rule.evaluate(context)) {
        return { value: this.defaultValue, variation: null, reason: 'rule_not_matched' };
      }
    }

    // Percentage rollout
    const hash = context.getHash(this.key);
    if (hash * 100 > this.percentage) {
      return { value: this.defaultValue, variation: null, reason: 'percentage_rollout' };
    }

    // Select variation if configured
    if (this.variations.length > 0) {
      const variation = this._selectVariation(hash);
      return { value: variation.value, variation: variation.id, reason: 'variation_selected' };
    }

    return { value: true, variation: null, reason: 'flag_enabled' };
  }

  /**
   * Select variation based on hash
   */
  _selectVariation(hash) {
    let cumulativeWeight = 0;

    for (const variation of this.variations) {
      cumulativeWeight += variation.weight;
      if (hash * 100 < cumulativeWeight) {
        return variation;
      }
    }

    return this.variations[this.variations.length - 1];
  }

  /**
   * Enable flag
   */
  enable() {
    this.enabled = true;
    this.updatedAt = Date.now();
    this.version++;
  }

  /**
   * Disable flag
   */
  disable() {
    this.enabled = false;
    this.updatedAt = Date.now();
    this.version++;
  }

  /**
   * Update percentage rollout
   */
  setPercentage(percentage) {
    this.percentage = Math.max(0, Math.min(100, percentage));
    this.updatedAt = Date.now();
    this.version++;
  }

  /**
   * Add user to list
   */
  addUser(userId) {
    if (!this.userList.includes(userId)) {
      this.userList.push(userId);
      this.updatedAt = Date.now();
      this.version++;
    }
  }

  /**
   * Remove user from list
   */
  removeUser(userId) {
    this.userList = this.userList.filter(id => id !== userId);
    this.updatedAt = Date.now();
    this.version++;
  }

  /**
   * To JSON
   */
  toJSON() {
    return {
      key: this.key,
      name: this.name,
      description: this.description,
      enabled: this.enabled,
      defaultValue: this.defaultValue,
      percentage: this.percentage,
      variations: this.variations.map(v => ({ id: v.id, name: v.name, value: v.value, weight: v.weight })),
      userList: this.userList,
      blacklist: this.blacklist,
      environments: this.environments,
      tags: this.tags,
      version: this.version,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }
}

/**
 * Feature Flags Manager
 */
export class FeatureFlagManager extends EventEmitter {
  constructor(options = {}) {
    super();

    this.flags = new Map();
    this.defaultContext = new EvaluationContext(options.defaultContext);

    // Persistence
    this.storage = options.storage || null;

    // Polling for remote changes
    this.pollInterval = options.pollInterval || null;
    this.pollTimer = null;

    // Cache
    this.cache = new Map();
    this.cacheEnabled = options.cache !== false;
    this.cacheTtl = options.cacheTtl || 60000; // 1 minute
  }

  /**
   * Register a flag
   */
  register(flagConfig) {
    const flag = flagConfig instanceof FeatureFlag ? flagConfig : new FeatureFlag(flagConfig);
    this.flags.set(flag.key, flag);

    this.emit('flag:registered', { key: flag.key });
    return flag;
  }

  /**
   * Register multiple flags
   */
  registerMany(flags) {
    flags.forEach(flag => this.register(flag));
    return this;
  }

  /**
   * Get a flag
   */
  getFlag(key) {
    return this.flags.get(key);
  }

  /**
   * Check if feature is enabled
   */
  isEnabled(key, context = null) {
    const result = this.evaluate(key, context);
    return result.value === true;
  }

  /**
   * Evaluate a flag
   */
  evaluate(key, context = null) {
    const evalContext = context instanceof EvaluationContext
      ? context
      : new EvaluationContext(context || this.defaultContext);

    // Check cache
    const cacheKey = this._getCacheKey(key, evalContext);
    if (this.cacheEnabled && this.cache.has(cacheKey)) {
      const cached = this.cache.get(cacheKey);
      if (Date.now() < cached.expiresAt) {
        return cached.result;
      }
    }

    const flag = this.flags.get(key);
    if (!flag) {
      return { value: false, variation: null, reason: 'flag_not_found' };
    }

    const result = flag.evaluate(evalContext);

    // Cache result
    if (this.cacheEnabled) {
      this.cache.set(cacheKey, {
        result,
        expiresAt: Date.now() + this.cacheTtl
      });
    }

    return result;
  }

  /**
   * Evaluate multiple flags
   */
  evaluateAll(context = null) {
    const evalContext = context instanceof EvaluationContext
      ? context
      : new EvaluationContext(context || this.defaultContext);

    const results = {};

    for (const [key, flag] of this.flags) {
      results[key] = flag.evaluate(evalContext);
    }

    return results;
  }

  /**
   * Get all enabled flags for context
   */
  getEnabled(context = null) {
    const evalContext = context instanceof EvaluationContext
      ? context
      : new EvaluationContext(context || this.defaultContext);

    const enabled = [];

    for (const [key, flag] of this.flags) {
      const result = flag.evaluate(evalContext);
      if (result.value === true) {
        enabled.push(key);
      }
    }

    return enabled;
  }

  /**
   * Generate cache key
   */
  _getCacheKey(key, context) {
    return `${key}:${context.userId || 'anon'}:${context.environment}`;
  }

  /**
   * Clear cache
   */
  clearCache() {
    this.cache.clear();
  }

  /**
   * Load flags from JSON
   */
  loadFromJSON(data) {
    for (const flagData of data) {
      this.register(flagData);
    }
    return this;
  }

  /**
   * Export all flags
   */
  exportFlags() {
    return Array.from(this.flags.values()).map(f => f.toJSON());
  }

  /**
   * Get stats
   */
  getStats() {
    const flags = Array.from(this.flags.values());

    return {
      totalFlags: flags.length,
      enabledFlags: flags.filter(f => f.enabled).length,
      disabledFlags: flags.filter(f => !f.enabled).length,
      cacheSize: this.cache.size,
      flags: flags.map(f => ({
        key: f.key,
        enabled: f.enabled,
        percentage: f.percentage,
        version: f.version
      }))
    };
  }

  /**
   * Start polling for remote changes
   */
  startPolling(fetchFn) {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
    }

    this.pollTimer = setInterval(async () => {
      try {
        const flags = await fetchFn();
        this.loadFromJSON(flags);
        this.clearCache();
        this.emit('flags:updated');
      } catch (error) {
        this.emit('error', { type: 'polling', error: error.message });
      }
    }, this.pollInterval);
  }

  /**
   * Stop polling
   */
  stopPolling() {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  }
}

/**
 * Feature flag middleware for Express
 */
export function featureFlagMiddleware(manager, options = {}) {
  return (req, res, next) => {
    // Create context from request
    const context = new EvaluationContext({
      userId: req.user?.id || req.headers['x-user-id'],
      userEmail: req.user?.email || req.headers['x-user-email'],
      userRoles: req.user?.roles || [],
      attributes: {
        ip: req.ip,
        userAgent: req.headers['user-agent'],
        path: req.path,
        method: req.method
      },
      environment: process.env.NODE_ENV
    });

    // Attach to request
    req.features = {
      evaluate: (key) => manager.evaluate(key, context),
      isEnabled: (key) => manager.isEnabled(key, context),
      getAll: () => manager.evaluateAll(context),
      getEnabled: () => manager.getEnabled(context)
    };

    next();
  };
}

// Export singleton
let manager = null;

export function getFeatureFlagManager(options) {
  if (!manager) {
    manager = new FeatureFlagManager(options);
  }
  return manager;
}

export default {
  FeatureFlag,
  FeatureFlagManager,
  EvaluationContext,
  FlagVariation,
  TargetingRule,
  featureFlagMiddleware,
  getFeatureFlagManager
};