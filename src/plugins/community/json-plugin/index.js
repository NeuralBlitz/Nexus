export const manifest = {
  name: 'json-plugin',
  id: 'json-plugin',
  version: '1.0.0',
  description: 'JSON utilities and manipulation',
  author: 'NEXUS',
  main: 'index.js',
  permissions: []
};

let api;

export async function init(context) {
  api = context;
  api.log('JSON plugin initialized');
}

export async function activate(context) {
  api.log('JSON plugin activated');
}

export function deactivate() {
  api.log('JSON plugin deactivated');
}

export const functions = {
  parse: (text) => {
    try { return { success: true, data: JSON.parse(text) }; }
    catch (e) { return { success: false, error: e.message }; }
  },

  stringify: (obj, pretty = false) => {
    return pretty ? JSON.stringify(obj, null, 2) : JSON.stringify(obj);
  },

  minify: (json) => JSON.stringify(JSON.parse(json)),

  pretty: (json) => JSON.stringify(JSON.parse(json), null, 2),

  get: (obj, path) => {
    return path.split('.').reduce((o, k) => o?.[k], obj);
  },

  set: (obj, path, value) => {
    const keys = path.split('.');
    const last = keys.pop();
    const target = keys.reduce((o, k) => o[k] = o[k] || {}, obj);
    target[last] = value;
    return obj;
  },

  delete: (obj, path) => {
    const keys = path.split('.');
    const last = keys.pop();
    const target = keys.reduce((o, k) => o?.[k], obj);
    delete target?.[last];
    return obj;
  },

  merge: (...objects) => Object.assign({}, ...objects),

  clone: (obj) => JSON.parse(JSON.stringify(obj)),

  flatten: (obj, prefix = '') => {
    const result = {};
    for (const [key, value] of Object.entries(obj)) {
      const newKey = prefix ? `${prefix}.${key}` : key;
      if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        Object.assign(result, functions.flatten(value, newKey));
      } else {
        result[newKey] = value;
      }
    }
    return result;
  },

  unflatten: (obj) => {
    const result = {};
    for (const [key, value] of Object.entries(obj)) {
      functions.set(result, key, value);
    }
    return result;
  },

  diff: (a, b) => {
    const changes = [];
    const allKeys = new Set([...Object.keys(a || {}), ...Object.keys(b || {})]);
    for (const key of allKeys) {
      if (JSON.stringify(a?.[key]) !== JSON.stringify(b?.[key])) {
        changes.push({ key, old: a?.[key], new: b?.[key] });
      }
    }
    return changes;
  },

  validate: (schema, data) => {
    const errors = [];
    for (const [key, type] of Object.entries(schema)) {
      if (type.required && !(key in data)) errors.push(`Missing required: ${key}`);
      if (data[key] !== undefined && typeof data[key] !== type.type) errors.push(`Invalid type for ${key}`);
    }
    return { valid: errors.length === 0, errors };
  },

  path: (obj, jsonPath) => {
    const tokens = jsonPath.match(/[\w]+|\[(\d+)\]|\[([^\]]+)\]/g) || [];
    let current = obj;
    for (const token of tokens) {
      if (token.startsWith('[')) {
        const idx = token.replace(/[[\]]/g, '');
        current = current?.[isNaN(idx) ? idx : parseInt(idx)];
      } else {
        current = current?.[token];
      }
    }
    return current;
  }
};

export default { manifest, init, activate, deactivate, functions };
