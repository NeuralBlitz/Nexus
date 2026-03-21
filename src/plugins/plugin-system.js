#!/usr/bin/env node

import { EventEmitter } from 'events';
import { pathToFileURL } from 'url';
import { createRequire } from 'module';
import fs from 'fs';
import path from 'path';

// ═══════════════════════════════════════════════════════════════════════════
// ADVANCED PLUGIN SYSTEM
// Hot-loading, lifecycle management, hooks, sandboxing
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Plugin states
 */
export const PluginState = {
  UNLOADED: 'unloaded',
  LOADING: 'loading',
  LOADED: 'loaded',
  ACTIVE: 'active',
  PAUSED: 'paused',
  ERROR: 'error',
  DISABLED: 'disabled'
};

/**
 * Hook types
 */
export const HookType = {
  BEFORE: 'before',
  AFTER: 'after',
  AROUND: 'around',
  ON_ERROR: 'onError'
};

/**
 * Plugin Context - Provides sandboxed access to platform APIs
 */
class PluginContext {
  constructor(plugin, platform) {
    this.plugin = plugin;
    this.platform = platform;

    // Limited API access
    this.api = {
      // Logging
      log: (msg, level = 'info') => {
        this.platform.emit('plugin:log', { plugin: plugin.id, message: msg, level });
      },

      // Emit custom events
      emit: (event, data) => {
        plugin.emit(event, data);
      },

      // Subscribe to events
      on: (event, handler) => {
        plugin.on(event, handler);
      },

      // Access agents
      agents: {
        list: () => platform.getAgents(),
        get: (id) => platform.getAgent(id),
        execute: (agentId, task) => platform.executeAgent(agentId, task)
      },

      // Access providers
      providers: {
        list: () => platform.getProviders(),
        complete: (prompt, options) => platform.providerComplete(prompt, options)
      },

      // Access channels
      channels: {
        list: () => platform.getChannels(),
        send: (channelId, target, message) => platform.sendToChannel(channelId, target, message)
      },

      // Storage
      storage: {
        get: (key) => plugin.storage.get(key),
        set: (key, value) => plugin.storage.set(key, value),
        delete: (key) => plugin.storage.delete(key),
        getAll: () => Object.fromEntries(plugin.storage)
      },

      // HTTP client
      http: platform.getHttpClient ? platform.getHttpClient() : null,

      // File system (read-only by default)
      fs: {
        readFile: (filePath) => plugin.config.sandboxFs ? null : fs.promises.readFile(filePath, 'utf-8'),
        writeFile: (filePath, content) => plugin.config.sandboxFs ? null : fs.promises.writeFile(filePath, content)
      }
    };
  }
}

/**
 * Plugin Class
 */
export class Plugin extends EventEmitter {
  constructor(manifest, pluginPath) {
    super();

    this.id = manifest.id || manifest.name;
    this.name = manifest.name;
    this.version = manifest.version || '1.0.0';
    this.description = manifest.description || '';
    this.author = manifest.author || 'Unknown';
    this.license = manifest.license || 'MIT';

    this.path = pluginPath;
    this.manifest = manifest;

    this.state = PluginState.UNLOADED;
    this.error = null;

    // Plugin configuration
    this.config = {
      sandboxFs: manifest.sandboxFs !== false,
      autoActivate: manifest.autoActivate !== false,
      dependencies: manifest.dependencies || [],
      permissions: manifest.permissions || [],
      hooks: manifest.hooks || [],
      ...manifest.config
    };

    // Plugin storage
    this.storage = new Map();

    // Hooks registered by this plugin
    this.registeredHooks = [];

    // Plugin module reference
    this.module = null;

    // Metrics
    this.metrics = {
      loadTime: null,
      activations: 0,
      hookCalls: 0,
      errors: 0,
      lastError: null
    };

    // Created timestamp
    this.createdAt = Date.now();
  }

  /**
   * Load the plugin module
   */
  async load(context) {
    this.state = PluginState.LOADING;
    this.context = context;

    const startTime = Date.now();

    try {
      // Check dependencies
      await this._checkDependencies();

      // Load module
      const modulePath = path.join(this.path, this.manifest.main || 'index.js');
      const moduleUrl = pathToFileURL(modulePath).href;

      this.module = await import(moduleUrl);

      // Initialize if there's an init function
      if (this.module.init && typeof this.module.init === 'function') {
        await this.module.init(this.context.api);
      }

      this.state = PluginState.LOADED;
      this.metrics.loadTime = Date.now() - startTime;

      this.emit('loaded', { plugin: this.id, time: this.metrics.loadTime });
      return true;
    } catch (error) {
      this.state = PluginState.ERROR;
      this.error = error.message;
      this.metrics.errors++;
      this.metrics.lastError = error;

      this.emit('error', { plugin: this.id, error: error.message });
      return false;
    }
  }

  /**
   * Check plugin dependencies
   */
  async _checkDependencies() {
    for (const dep of this.config.dependencies) {
      // Check npm packages
      if (dep.startsWith('npm:')) {
        const packageName = dep.replace('npm:', '');
        try {
          createRequire(import.meta.url)(packageName);
        } catch {
          throw new Error(`Missing dependency: ${packageName}`);
        }
      }
    }
  }

  /**
   * Activate the plugin
   */
  async activate() {
    if (this.state !== PluginState.LOADED && this.state !== PluginState.PAUSED) {
      throw new Error(`Cannot activate plugin in state: ${this.state}`);
    }

    try {
      // Register hooks
      if (this.module.hooks) {
        for (const [hookName, handler] of Object.entries(this.module.hooks)) {
          this.registerHook(hookName, handler);
        }
      }

      // Call activate if exists
      if (this.module.activate && typeof this.module.activate === 'function') {
        await this.module.activate(this.context.api);
      }

      this.state = PluginState.ACTIVE;
      this.metrics.activations++;

      this.emit('activated', { plugin: this.id });
      return true;
    } catch (error) {
      this.state = PluginState.ERROR;
      this.error = error.message;
      this.metrics.errors++;
      return false;
    }
  }

  /**
   * Register a hook
   */
  registerHook(hookName, handler) {
    const hook = {
      plugin: this.id,
      name: hookName,
      handler,
      registeredAt: Date.now()
    };

    this.registeredHooks.push(hook);
    this.context.platform.registerHook(hookName, hook);

    return hook;
  }

  /**
   * Deactivate the plugin
   */
  async deactivate() {
    if (this.state !== PluginState.ACTIVE) {
      return false;
    }

    try {
      // Unregister hooks
      for (const hook of this.registeredHooks) {
        this.context.platform.unregisterHook(hook);
      }
      this.registeredHooks = [];

      // Call deactivate if exists
      if (this.module.deactivate && typeof this.module.deactivate === 'function') {
        await this.module.deactivate(this.context.api);
      }

      this.state = PluginState.LOADED;

      this.emit('deactivated', { plugin: this.id });
      return true;
    } catch (error) {
      this.error = error.message;
      this.metrics.errors++;
      return false;
    }
  }

  /**
   * Pause the plugin
   */
  pause() {
    if (this.state === PluginState.ACTIVE) {
      this.state = PluginState.PAUSED;
      this.emit('paused', { plugin: this.id });
    }
  }

  /**
   * Resume the plugin
   */
  resume() {
    if (this.state === PluginState.PAUSED) {
      this.state = PluginState.ACTIVE;
      this.emit('resumed', { plugin: this.id });
    }
  }

  /**
   * Unload the plugin
   */
  async unload() {
    if (this.state === PluginState.ACTIVE) {
      await this.deactivate();
    }

    this.state = PluginState.UNLOADED;
    this.module = null;

    this.emit('unloaded', { plugin: this.id });
  }

  /**
   * Reload the plugin
   */
  async reload(context) {
    await this.unload();
    await this.load(context);
    if (this.config.autoActivate) {
      await this.activate();
    }
  }

  /**
   * Get plugin info
   */
  getInfo() {
    return {
      id: this.id,
      name: this.name,
      version: this.version,
      description: this.description,
      author: this.author,
      state: this.state,
      config: this.config,
      metrics: this.metrics,
      hooks: this.registeredHooks.map(h => h.name)
    };
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// PLUGIN MANAGER
// ═══════════════════════════════════════════════════════════════════════════

export class PluginManager extends EventEmitter {
  constructor(options = {}) {
    super();

    this.plugins = new Map();
    this.hooks = new Map(); // hookName -> [handlers]
    this.pluginDirs = options.pluginDirs || ['./plugins', './.nexus/plugins'];
    this.platform = options.platform || {};

    // Sandboxing
    this.sandboxEnabled = options.sandbox !== false;

    // Hot reload
    this.hotReloadEnabled = options.hotReload || false;
    this.fileWatchers = new Map();
  }

  /**
   * Initialize the plugin manager
   */
  async initialize() {
    // Discover plugins
    await this.discoverPlugins();

    // Load all found plugins
    for (const [id, plugin] of this.plugins) {
      if (plugin.config.autoActivate) {
        await this.loadAndActivate(id);
      }
    }

    // Start watching for changes
    if (this.hotReloadEnabled) {
      this._startFileWatcher();
    }

    return this;
  }

  /**
   * Discover plugins in configured directories
   */
  async discoverPlugins() {
    for (const dir of this.pluginDirs) {
      try {
        const fullPath = path.resolve(dir);
        if (!fs.existsSync(fullPath)) continue;

        const entries = fs.readdirSync(fullPath, { withFileTypes: true });

        for (const entry of entries) {
          if (entry.isDirectory()) {
            const pluginPath = path.join(fullPath, entry.name);
            const manifestPath = path.join(pluginPath, 'plugin.json');

            if (fs.existsSync(manifestPath)) {
              try {
                const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
                this.register(manifest, pluginPath);
              } catch (error) {
                console.error(`Failed to load plugin manifest: ${entry.name}`, error.message);
              }
            } else {
              // Fallback: check for inline manifest export in index.js
              const indexPath = path.join(pluginPath, 'index.js');
              if (fs.existsSync(indexPath)) {
                try {
                  const moduleUrl = pathToFileURL(indexPath).href;
                  const mod = await import(moduleUrl);
                  if (mod.manifest) {
                    this.register(mod.manifest, pluginPath);
                  }
                } catch (error) {
                  // Skip invalid plugins silently
                }
              }
            }
          }
        }
      } catch (error) {
        // Directory doesn't exist or not accessible
      }
    }
  }

  /**
   * Register a plugin
   */
  register(manifest, pluginPath) {
    const plugin = new Plugin(manifest, pluginPath);
    const context = new PluginContext(plugin, this);

    plugin.context = context;
    this.plugins.set(plugin.id, plugin);

    // Forward events
    plugin.on('error', (data) => this.emit('plugin:error', data));
    plugin.on('loaded', (data) => this.emit('plugin:loaded', data));
    plugin.on('activated', (data) => this.emit('plugin:activated', data));

    this.emit('plugin:registered', { plugin: plugin.id });
    return plugin;
  }

  /**
   * Unregister a plugin
   */
  async unregister(pluginId) {
    const plugin = this.plugins.get(pluginId);
    if (!plugin) return false;

    await plugin.unload();
    this.plugins.delete(pluginId);

    this.emit('plugin:unregistered', { plugin: pluginId });
    return true;
  }

  /**
   * Load and activate a plugin
   */
  async loadAndActivate(pluginId) {
    const plugin = this.plugins.get(pluginId);
    if (!plugin) throw new Error(`Plugin not found: ${pluginId}`);

    const context = new PluginContext(plugin, this);
    const loaded = await plugin.load(context);

    if (loaded && plugin.config.autoActivate) {
      await plugin.activate();
    }

    return loaded;
  }

  /**
   * Get a plugin
   */
  get(pluginId) {
    return this.plugins.get(pluginId);
  }

  /**
   * Get all plugins
   */
  getAll() {
    return Array.from(this.plugins.values());
  }

  /**
   * Get active plugins
   */
  getActive() {
    return this.getAll().filter(p => p.state === PluginState.ACTIVE);
  }

  /**
   * Register a hook handler
   */
  registerHook(hookName, hook) {
    if (!this.hooks.has(hookName)) {
      this.hooks.set(hookName, []);
    }
    this.hooks.get(hookName).push(hook);
  }

  /**
   * Unregister a hook
   */
  unregisterHook(hook) {
    const hooks = this.hooks.get(hook.name);
    if (hooks) {
      const index = hooks.findIndex(h => h.plugin === hook.plugin);
      if (index !== -1) {
        hooks.splice(index, 1);
      }
    }
  }

  /**
   * Execute a hook
   */
  async executeHook(hookName, data, options = {}) {
    const hooks = this.hooks.get(hookName) || [];
    let result = data;

    for (const hook of hooks) {
      try {
        const hookResult = await hook.handler(result, options);
        if (hookResult !== undefined) {
          result = hookResult;
        }
      } catch (error) {
        this.emit('hook:error', { hook: hookName, plugin: hook.plugin, error: error.message });

        if (options.stopOnError) {
          throw error;
        }
      }
    }

    return result;
  }

  /**
   * Execute a before hook
   */
  async executeBefore(hookName, data) {
    return this.executeHook(`before:${hookName}`, data);
  }

  /**
   * Execute an after hook
   */
  async executeAfter(hookName, data) {
    return this.executeHook(`after:${hookName}`, data);
  }

  /**
   * Get hooks for a plugin
   */
  getPluginHooks(pluginId) {
    const allHooks = [];
    for (const [hookName, hooks] of this.hooks) {
      for (const hook of hooks) {
        if (hook.plugin === pluginId) {
          allHooks.push(hookName);
        }
      }
    }
    return allHooks;
  }

  /**
   * Install a plugin from npm
   */
  async installFromNpm(packageName) {
    // This would run npm install
    // For now, just emit event
    this.emit('plugin:install', { package: packageName });
    return true;
  }

  /**
   * Start file watcher for hot reload
   */
  _startFileWatcher() {
    for (const [id, plugin] of this.plugins) {
      if (plugin.path) {
        try {
          const watcher = fs.watch(plugin.path, { recursive: true }, (eventType, filename) => {
            if (filename && filename.endsWith('.js')) {
              this.emit('plugin:changed', { plugin: id, file: filename });
              plugin.reload(plugin.context);
            }
          });
          this.fileWatchers.set(id, watcher);
        } catch {
          // Watcher not supported
        }
      }
    }
  }

  /**
   * Stop file watchers
   */
  _stopFileWatchers() {
    for (const [, watcher] of this.fileWatchers) {
      watcher.close();
    }
    this.fileWatchers.clear();
  }

  /**
   * Get manager status
   */
  getStatus() {
    const plugins = this.getAll();

    return {
      total: plugins.length,
      active: plugins.filter(p => p.state === PluginState.ACTIVE).length,
      loaded: plugins.filter(p => p.state === PluginState.LOADED).length,
      error: plugins.filter(p => p.state === PluginState.ERROR).length,
      hooks: this.hooks.size,
      plugins: plugins.map(p => p.getInfo())
    };
  }

  /**
   * Stop all plugins
   */
  async stopAll() {
    this._stopFileWatchers();

    for (const plugin of this.plugins.values()) {
      await plugin.unload();
    }

    this.hooks.clear();
    this.emit('stopped');
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// BUILT-IN PLUGINS (examples)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Example Plugin Manifest:
 * 
 * {
 *   "id": "my-plugin",
 *   "name": "My Plugin",
 *   "version": "1.0.0",
 *   "description": "A sample plugin",
 *   "author": "Developer",
 *   "main": "index.js",
 *   "autoActivate": true,
 *   "dependencies": [],
 *   "permissions": ["agents.read", "providers.read"],
 *   "hooks": ["before:task", "after:task"]
 * }
 * 
 * Example Plugin Module (index.js):
 * 
 * export async function init(api) {
 *   api.log('Plugin initialized');
 * }
 * 
 * export async function activate(api) {
 *   api.log('Plugin activated');
 * }
 * 
 * export async function deactivate(api) {
 *   api.log('Plugin deactivated');
 * }
 * 
 * export const hooks = {
 *   'before:task': async (task, api) => {
 *     api.log(`Task starting: ${task.description}`);
 *     return task;
 *   },
 *   'after:task': async (result, api) => {
 *     api.log(`Task completed`);
 *     return result;
 *   }
 * };
 */

// Export singleton
let manager = null;

export function getPluginManager(options) {
  if (!manager) {
    manager = new PluginManager(options);
  }
  return manager;
}

export default {
  Plugin,
  PluginManager,
  PluginState,
  HookType,
  getPluginManager
};