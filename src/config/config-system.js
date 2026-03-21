#!/usr/bin/env node

import { EventEmitter } from 'events';
import fs from 'fs';
import path from 'path';
import { watch } from 'fs';

// ═══════════════════════════════════════════════════════════════════════════
// CONFIG HOT-RELOAD SYSTEM
// File watching, environment variables, validation, migrations
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Config source types
 */
export const ConfigSource = {
  FILE: 'file',
  ENV: 'env',
  REMOTE: 'remote',
  MEMORY: 'memory'
};

/**
 * Config schema validator
 */
export class ConfigSchema {
  constructor(schema) {
    this.schema = schema;
  }

  /**
   * Validate config against schema
   */
  validate(config) {
    const errors = [];

    for (const [key, rules] of Object.entries(this.schema)) {
      const value = config[key];

      // Required check
      if (rules.required && (value === undefined || value === null)) {
        errors.push({ key, error: 'Required field missing' });
        continue;
      }

      if (value === undefined || value === null) continue;

      // Type check
      if (rules.type) {
        const actualType = typeof value;
        if (actualType !== rules.type) {
          errors.push({ key, error: `Expected ${rules.type}, got ${actualType}` });
          continue;
        }
      }

      // Enum check
      if (rules.enum && !rules.enum.includes(value)) {
        errors.push({ key, error: `Value must be one of: ${rules.enum.join(', ')}` });
      }

      // Range check
      if (rules.min !== undefined && value < rules.min) {
        errors.push({ key, error: `Value must be >= ${rules.min}` });
      }
      if (rules.max !== undefined && value > rules.max) {
        errors.push({ key, error: `Value must be <= ${rules.max}` });
      }

      // Pattern check
      if (rules.pattern && !new RegExp(rules.pattern).test(String(value))) {
        errors.push({ key, error: `Value must match pattern: ${rules.pattern}` });
      }

      // Custom validator
      if (rules.validate) {
        const result = rules.validate(value);
        if (result !== true) {
          errors.push({ key, error: result || 'Validation failed' });
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }
}

/**
 * Configuration file watcher
 */
export class ConfigWatcher extends EventEmitter {
  constructor(filePath, options = {}) {
    super();

    this.filePath = filePath;
    this.encoding = options.encoding || 'utf-8';
    this.parser = options.parser || this._defaultParser;
    this.watcher = null;

    // Current config
    this.config = null;
    this.lastModified = null;
    this.lastLoaded = null;
  }

  /**
   * Default parser
   */
  _defaultParser(content, filePath) {
    const ext = path.extname(filePath).toLowerCase();

    switch (ext) {
      case '.json':
        return JSON.parse(content);
      case '.js':
      case '.mjs':
        // Dynamic import for JS config files
        throw new Error('JS config files should be imported directly');
      case '.yaml':
      case '.yml':
        throw new Error('YAML support requires js-yaml package');
      case '.toml':
        throw new Error('TOML support requires toml package');
      case '.env':
        return this._parseEnvFile(content);
      default:
        return JSON.parse(content);
    }
  }

  /**
   * Parse .env file
   */
  _parseEnvFile(content) {
    const result = {};

    for (const line of content.split('\n')) {
      const trimmed = line.trim();

      // Skip comments and empty lines
      if (!trimmed || trimmed.startsWith('#')) continue;

      const eqIndex = trimmed.indexOf('=');
      if (eqIndex === -1) continue;

      const key = trimmed.substring(0, eqIndex).trim();
      let value = trimmed.substring(eqIndex + 1).trim();

      // Remove quotes
      if ((value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }

      result[key] = value;
    }

    return result;
  }

  /**
   * Start watching
   */
  start() {
    this.load();

    this.watcher = watch(this.filePath, (eventType) => {
      if (eventType === 'change') {
        this.load();
      }
    });

    return this;
  }

  /**
   * Stop watching
   */
  stop() {
    if (this.watcher) {
      this.watcher.close();
      this.watcher = null;
    }
  }

  /**
   * Load config file
   */
  load() {
    try {
      const stats = fs.statSync(this.filePath);
      const content = fs.readFileSync(this.filePath, this.encoding);

      const config = this.parser(content, this.filePath);

      const oldConfig = this.config;
      this.config = config;
      this.lastModified = stats.mtime;
      this.lastLoaded = Date.now();

      if (oldConfig !== null) {
        this.emit('changed', { config, previous: oldConfig });
      } else {
        this.emit('loaded', { config });
      }

      return config;
    } catch (error) {
      this.emit('error', { error: error.message, path: this.filePath });
      return null;
    }
  }

  /**
   * Get current config
   */
  getConfig() {
    return this.config;
  }

  /**
   * Get config value
   */
  get(key, defaultValue = undefined) {
    if (!this.config) return defaultValue;

    const keys = key.split('.');
    let value = this.config;

    for (const k of keys) {
      if (value === undefined || value === null) return defaultValue;
      value = value[k];
    }

    return value !== undefined ? value : defaultValue;
  }
}

/**
 * Environment variable loader
 */
export class EnvLoader {
  constructor(options = {}) {
    this.prefix = options.prefix || '';
    this.separator = options.separator || '__';
    this.namespaces = options.namespaces || [];
  }

  /**
   * Load environment variables
   */
  load() {
    const config = {};

    for (const [key, value] of Object.entries(process.env)) {
      // Filter by prefix if set
      if (this.prefix && !key.startsWith(this.prefix)) continue;

      // Convert to nested object
      const cleanKey = this.prefix ? key.slice(this.prefix.length) : key;
      this._setNested(config, cleanKey, value);
    }

    return config;
  }

  /**
   * Set nested value
   */
  _setNested(obj, key, value) {
    // Check for separator-based nesting
    if (key.includes(this.separator)) {
      const parts = key.split(this.separator);
      let current = obj;

      for (let i = 0; i < parts.length - 1; i++) {
        const part = parts[i].toLowerCase();
        if (!current[part]) current[part] = {};
        current = current[part];
      }

      current[parts[parts.length - 1].toLowerCase()] = this._parseValue(value);
    } else {
      obj[key.toLowerCase()] = this._parseValue(value);
    }
  }

  /**
   * Parse value (convert string to appropriate type)
   */
  _parseValue(value) {
    if (value === 'true') return true;
    if (value === 'false') return false;
    if (value === 'null') return null;
    if (value === '') return '';

    // Try to parse as number
    const num = Number(value);
    if (!isNaN(num) && value.trim() !== '') {
      return num;
    }

    // Try to parse as JSON
    if ((value.startsWith('{') && value.endsWith('}')) ||
        (value.startsWith('[') && value.endsWith(']'))) {
      try {
        return JSON.parse(value);
      } catch {
        // Not valid JSON
      }
    }

    return value;
  }
}

/**
 * Config Manager
 */
export class ConfigManager extends EventEmitter {
  constructor(options = {}) {
    super();

    this.sources = new Map();
    this.schema = options.schema ? new ConfigSchema(options.schema) : null;
    this.config = {};
    this.overrides = {};

    // Auto-reload
    this.autoReload = options.autoReload !== false;
  }

  /**
   * Load config from file
   */
  loadFile(key, filePath, options = {}) {
    const watcher = new ConfigWatcher(filePath, options);

    watcher.on('loaded', (data) => {
      this._mergeConfig(key, data.config);
    });

    watcher.on('changed', (data) => {
      this._mergeConfig(key, data.config);
      this.emit('config:changed', { source: key, config: data.config });
    });

    watcher.on('error', (error) => {
      this.emit('error', { source: key, ...error });
    });

    if (this.autoReload) {
      watcher.start();
    } else {
      watcher.load();
    }

    this.sources.set(key, { type: ConfigSource.FILE, watcher });
  }

  /**
   * Load config from environment
   */
  loadEnv(prefix = '') {
    const loader = new EnvLoader({ prefix });
    const config = loader.load();

    this._mergeConfig('env', config);
    this.sources.set('env', { type: ConfigSource.ENV, loader });

    return config;
  }

  /**
   * Load config from object
   */
  loadObject(key, obj) {
    this._mergeConfig(key, obj);
    this.sources.set(key, { type: ConfigSource.MEMORY, data: obj });
  }

  /**
   * Merge config from source
   */
  _mergeConfig(key, config) {
    this.config[key] = this._deepMerge(this.config[key] || {}, config);
    this._rebuildConfig();
  }

  /**
   * Deep merge objects
   */
  _deepMerge(target, source) {
    const output = { ...target };

    for (const [key, value] of Object.entries(source)) {
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        output[key] = this._deepMerge(output[key] || {}, value);
      } else {
        output[key] = value;
      }
    }

    return output;
  }

  /**
   * Rebuild flat config from sources
   */
  _rebuildConfig() {
    let merged = {};

    // Merge all source configs
    for (const config of Object.values(this.config)) {
      merged = this._deepMerge(merged, config);
    }

    // Apply overrides
    merged = this._deepMerge(merged, this.overrides);

    // Update flat config
    this.flatConfig = merged;
    this.emit('config:updated', merged);
  }

  /**
   * Get config value
   */
  get(key, defaultValue = undefined) {
    const keys = key.split('.');
    let value = this.flatConfig || {};

    for (const k of keys) {
      if (value === undefined || value === null) return defaultValue;
      value = value[k];
    }

    return value !== undefined ? value : defaultValue;
  }

  /**
   * Set config value (override)
   */
  set(key, value) {
    const keys = key.split('.');
    let target = this.overrides;

    for (let i = 0; i < keys.length - 1; i++) {
      if (!target[keys[i]]) target[keys[i]] = {};
      target = target[keys[i]];
    }

    target[keys[keys.length - 1]] = value;
    this._rebuildConfig();
  }

  /**
   * Validate config against schema
   */
  validate() {
    if (!this.schema) {
      return { valid: true, errors: [] };
    }

    return this.schema.validate(this.flatConfig);
  }

  /**
   * Export config
   */
  export() {
    return {
      config: this.flatConfig,
      overrides: this.overrides,
      sources: Array.from(this.sources.keys()),
      timestamp: Date.now()
    };
  }

  /**
   * Save config to file
   */
  async save(filePath) {
    const fs = await import('fs/promises');
    const data = JSON.stringify(this.export(), null, 2);
    await fs.writeFile(filePath, data, 'utf-8');
    this.emit('config:saved', { path: filePath });
    return { saved: true, path: filePath };
  }

  /**
   * Load config from file
   */
  async load(filePath) {
    const fs = await import('fs/promises');
    const data = JSON.parse(await fs.readFile(filePath, 'utf-8'));
    if (data.overrides) {
      this.overrides = data.overrides;
      this._rebuildConfig();
    }
    this.emit('config:loaded', { path: filePath });
    return { loaded: true, path: filePath };
  }

  /**
   * Reset config to defaults
   */
  reset() {
    this.overrides = {};
    this._rebuildConfig();
    this.emit('config:reset');
  }

  /**
   * Get all keys
   */
  keys() {
    return this._flattenKeys(this.flatConfig || {});
  }

  _flattenKeys(obj, prefix = '') {
    const keys = [];
    for (const [key, value] of Object.entries(obj)) {
      const fullKey = prefix ? `${prefix}.${key}` : key;
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        keys.push(...this._flattenKeys(value, fullKey));
      } else {
        keys.push(fullKey);
      }
    }
    return keys;
  }

  /**
   * Stop all watchers
   */
  stop() {
    for (const source of this.sources.values()) {
      if (source.watcher) {
        source.watcher.stop();
      }
    }
  }

  /**
   * Get config status
   */
  getStatus() {
    return {
      sources: Array.from(this.sources.entries()).map(([key, source]) => ({
        key,
        type: source.type
      })),
      flatKeys: Object.keys(this.flatConfig || {}).length,
      overrides: Object.keys(this.overrides).length
    };
  }
}

// Export singleton
let manager = null;

export function getConfigManager(options) {
  if (!manager) {
    manager = new ConfigManager(options);
  }
  return manager;
}

export default {
  ConfigManager,
  ConfigWatcher,
  ConfigSchema,
  EnvLoader,
  ConfigSource,
  getConfigManager
};