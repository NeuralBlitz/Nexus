export const manifest = {
  name: 'config-plugin',
  id: 'config-plugin',
  version: '1.0.0',
  description: 'Configuration management',
  author: 'NEXUS',
  main: 'index.js',
  permissions: []
};

let api;
const configs = new Map();
const defaults = new Map();
const validators = new Map();

export async function init(context) {
  api = context;
  api.log('Config plugin initialized');
}

export async function activate(context) {
  api.log('Config plugin activated');
}

export function deactivate() {
  api.log('Config plugin deactivated');
}

export const functions = {
  set: (key, value, options = {}) => {
    const { env, namespace } = options;
    const configKey = functions.makeKey(key, { env, namespace });
    
    if (validators.has(configKey)) {
      const valid = validators.get(configKey)(value);
      if (!valid) return { success: false, error: 'Validation failed' };
    }
    
    configs.set(configKey, {
      key,
      value,
      env: env || process.env.NODE_ENV || 'development',
      namespace: namespace || 'default',
      updatedAt: Date.now(),
      createdAt: configs.has(configKey) ? configs.get(configKey).createdAt : Date.now()
    });
    return { success: true };
  },

  get: (key, options = {}) => {
    const configKey = functions.makeKey(key, options);
    const value = configs.get(configKey);
    if (value) return value.value;
    return defaults.get(key) ?? options.default ?? null;
  },

  has: (key, options = {}) => {
    const configKey = functions.makeKey(key, options);
    return configs.has(configKey) || defaults.has(key);
  },

  delete: (key, options = {}) => {
    const configKey = functions.makeKey(key, options);
    return configs.delete(configKey);
  },

  setDefault: (key, value) => {
    defaults.set(key, value);
    return true;
  },

  getAll: (options = {}) => {
    const { env, namespace } = options;
    const result = {};
    for (const [key, config] of configs) {
      if ((!env || config.env === env) && (!namespace || config.namespace === namespace)) {
        result[config.key] = config.value;
      }
    }
    return result;
  },

  keys: (options = {}) => {
    const { env, namespace } = options;
    const result = [];
    for (const [, config] of configs) {
      if ((!env || config.env === env) && (!namespace || config.namespace === namespace)) {
        result.push(config.key);
      }
    }
    return result;
  },

  clear: (options = {}) => {
    const { env, namespace } = options;
    let count = 0;
    for (const [key, config] of configs) {
      if ((!env || config.env === env) && (!namespace || config.namespace === namespace)) {
        configs.delete(key);
        count++;
      }
    }
    return { cleared: count };
  },

  registerValidator: (key, validator) => {
    validators.set(key, validator);
    return true;
  },

  merge: (key, value, options = {}) => {
    const existing = functions.get(key, options);
    const merged = existing ? { ...existing, ...value } : value;
    return functions.set(key, merged, options);
  },

  increment: (key, amount = 1, options = {}) => {
    const current = functions.get(key, options) || 0;
    return functions.set(key, current + amount, options);
  },

  toggle: (key, options = {}) => {
    const current = functions.get(key, options);
    if (typeof current !== 'boolean') return { success: false, error: 'Not a boolean' };
    return functions.set(key, !current, options);
  },

  makeKey: (key, options = {}) => {
    const { env, namespace } = options;
    return `${namespace || 'default'}:${env || 'development'}:${key}`;
  },

  snapshot: () => {
    return Array.from(configs.entries()).map(([key, config]) => ({ key, ...config }));
  },

  restore: (snapshot) => {
    configs.clear();
    for (const item of snapshot) {
      configs.set(item.key, { ...item, updatedAt: Date.now() });
    }
    return { restored: snapshot.length };
  },

  diff: (options = {}) => {
    const { env, namespace } = options;
    const result = { added: [], modified: [], removed: [] };
    const existing = functions.keys({ env, namespace });
    
    for (const key of existing) {
      const config = configs.get(functions.makeKey(key, { env, namespace }));
      if (config.createdAt === config.updatedAt) result.added.push(key);
      else result.modified.push(key);
    }
    
    return result;
  }
};

export default { manifest, init, activate, deactivate, functions };
