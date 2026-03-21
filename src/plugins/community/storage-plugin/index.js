export const manifest = {
  name: 'storage-plugin',
  id: 'storage-plugin',
  version: '1.0.0',
  description: 'Key-value storage with TTL support',
  author: 'NEXUS',
  main: 'index.js',
  permissions: []
};

let api;
const storage = new Map();
const indexes = new Map();

export async function init(context) {
  api = context;
  api.log('Storage plugin initialized');
}

export async function activate(context) {
  api.log('Storage plugin activated');
}

export function deactivate() {
  api.log('Storage plugin deactivated');
}

export const functions = {
  set: (key, value, options = {}) => {
    const { ttl, tags } = options;
    const item = {
      value,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      ttl: ttl ? Date.now() + ttl : null,
      tags: tags || [],
      size: JSON.stringify(value).length
    };
    storage.set(key, item);

    for (const tag of item.tags) {
      if (!indexes.has(tag)) indexes.set(tag, new Set());
      indexes.get(tag).add(key);
    }

    return { success: true };
  },

  get: (key) => {
    const item = storage.get(key);
    if (!item) return null;
    if (item.ttl && Date.now() > item.ttl) { storage.delete(key); return null; }
    item.updatedAt = Date.now();
    return item.value;
  },

  has: (key) => {
    const item = storage.get(key);
    if (!item) return false;
    if (item.ttl && Date.now() > item.ttl) { storage.delete(key); return false; }
    return true;
  },

  delete: (key) => storage.delete(key),

  getMany: (keys) => {
    const result = {};
    for (const key of keys) result[key] = functions.get(key);
    return result;
  },

  setMany: (items, options = {}) => {
    for (const [key, value] of Object.entries(items)) functions.set(key, value, options);
    return { set: Object.keys(items).length };
  },

  update: (key, updates) => {
    const item = storage.get(key);
    if (!item) return null;
    item.value = { ...item.value, ...updates };
    item.updatedAt = Date.now();
    return item.value;
  },

  increment: (key, amount = 1) => {
    const current = functions.get(key) || 0;
    const newValue = current + amount;
    functions.set(key, newValue);
    return newValue;
  },

  decrement: (key, amount = 1) => functions.increment(key, -amount),

  append: (key, value) => {
    const current = functions.get(key) || [];
    const arr = Array.isArray(current) ? [...current, value] : [current, value];
    functions.set(key, arr);
    return arr;
  },

  prepend: (key, value) => {
    const current = functions.get(key) || [];
    const arr = Array.isArray(current) ? [value, ...current] : [value, current];
    functions.set(key, arr);
    return arr;
  },

  getTTL: (key) => {
    const item = storage.get(key);
    if (!item || !item.ttl) return null;
    return Math.max(0, item.ttl - Date.now());
  },

  setTTL: (key, ttl) => {
    const item = storage.get(key);
    if (!item) return false;
    item.ttl = Date.now() + ttl;
    return true;
  },

  expire: (key, seconds) => functions.setTTL(key, seconds * 1000),

  persist: (key) => {
    const item = storage.get(key);
    if (!item) return false;
    item.ttl = null;
    return true;
  },

  touch: (key) => {
    const item = storage.get(key);
    if (!item) return false;
    item.updatedAt = Date.now();
    return true;
  },

  tags: (key) => storage.get(key)?.tags || [],

  addTags: (key, tags) => {
    const item = storage.get(key);
    if (!item) return false;
    for (const tag of tags) {
      if (!item.tags.includes(tag)) item.tags.push(tag);
      if (!indexes.has(tag)) indexes.set(tag, new Set());
      indexes.get(tag).add(key);
    }
    return true;
  },

  removeTags: (key, tags) => {
    const item = storage.get(key);
    if (!item) return false;
    item.tags = item.tags.filter(t => !tags.includes(t));
    for (const tag of tags) indexes.get(tag)?.delete(key);
    return true;
  },

  getByTag: (tag) => Array.from(indexes.get(tag) || []).map(key => ({ key, value: functions.get(key) })),

  findByTags: (tags, match = 'all') => {
    if (tags.length === 0) return [];
    let result = new Set(indexes.get(tags[0]) || []);
    if (match === 'all') {
      for (const tag of tags.slice(1)) {
        result = new Set([...result].filter(key => indexes.get(tag)?.has(key)));
      }
    } else {
      for (const tag of tags.slice(1)) {
        for (const key of indexes.get(tag) || []) result.add(key);
      }
    }
    return Array.from(result).map(key => ({ key, value: functions.get(key) }));
  },

  keys: () => Array.from(storage.keys()),

  values: () => Array.from(storage.keys()).map(k => functions.get(k)),

  entries: () => Array.from(storage.keys()).map(k => [k, functions.get(k)]),

  size: () => storage.size,

  stats: () => {
    let totalSize = 0;
    const tags = new Set();
    const now = Date.now();
    let expired = 0;

    for (const [, item] of storage) {
      totalSize += item.size;
      item.tags.forEach(t => tags.add(t));
      if (item.ttl && item.ttl < now) expired++;
    }

    return {
      keys: storage.size,
      totalSize,
      uniqueTags: tags.size,
      expired,
      ttlEnabled: Array.from(storage.values()).filter(i => i.ttl).length
    };
  },

  clear: () => { storage.clear(); indexes.clear(); return { cleared: true }; },

  cleanup: () => {
    let cleaned = 0;
    for (const [key, item] of storage) {
      if (item.ttl && Date.now() > item.ttl) { storage.delete(key); cleaned++; }
    }
    return { cleaned };
  }
};

export default { manifest, init, activate, deactivate, functions };
