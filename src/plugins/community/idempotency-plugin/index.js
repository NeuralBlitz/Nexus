export const manifest = {
  name: 'idempotency-plugin',
  id: 'idempotency-plugin',
  version: '1.0.0',
  description: 'Idempotency key management',
  author: 'NEXUS',
  main: 'index.js',
  permissions: []
};

let api;
const store = new Map();
const defaultTTL = 86400000;

export async function init(context) {
  api = context;
  api.log('Idempotency plugin initialized');
}

export async function activate(context) {
  api.log('Idempotency plugin activated');
}

export function deactivate() {
  api.log('Idempotency plugin deactivated');
}

export const functions = {
  check: (key) => {
    const entry = store.get(key);
    if (!entry) return { exists: false };
    if (Date.now() > entry.expiresAt) { store.delete(key); return { exists: false, expired: true }; }
    return { exists: true, ...entry };
  },

  start: (key, data = {}, options = {}) => {
    const { ttl = defaultTTL } = options;
    if (store.has(key)) {
      const entry = store.get(key);
      if (Date.now() <= entry.expiresAt) return { started: false, status: entry.status };
    }
    store.set(key, {
      status: 'processing',
      data,
      result: null,
      createdAt: Date.now(),
      expiresAt: Date.now() + ttl
    });
    return { started: true, status: 'processing' };
  },

  complete: (key, result) => {
    const entry = store.get(key);
    if (!entry) return { success: false, error: 'Key not found' };
    entry.status = 'completed';
    entry.result = result;
    entry.completedAt = Date.now();
    return { success: true, result };
  },

  fail: (key, error) => {
    const entry = store.get(key);
    if (!entry) return { success: false, error: 'Key not found' };
    entry.status = 'failed';
    entry.error = error;
    entry.failedAt = Date.now();
    return { success: true };
  },

  get: (key) => store.get(key) || null,

  delete: (key) => store.delete(key),

  clear: () => {
    const count = store.size;
    store.clear();
    return { cleared: count };
  },

  cleanup: () => {
    let cleaned = 0;
    for (const [key, entry] of store) {
      if (Date.now() > entry.expiresAt) { store.delete(key); cleaned++; }
    }
    return { cleaned };
  },

  isProcessing: (key) => {
    const entry = store.get(key);
    return entry?.status === 'processing';
  },

  isCompleted: (key) => {
    const entry = store.get(key);
    return entry?.status === 'completed';
  },

  isFailed: (key) => {
    const entry = store.get(key);
    return entry?.status === 'failed';
  },

  wrap: async (key, fn, options = {}) => {
    const { ttl = defaultTTL, onExisting, onComplete, onError } = options;
    
    const check = functions.check(key);
    if (check.exists) {
      if (check.status === 'completed') {
        if (onExisting) onExisting(check.result);
        return { cached: true, result: check.result };
      }
      if (check.status === 'processing') {
        return { processing: true };
      }
    }

    functions.start(key, {}, { ttl });
    
    try {
      const result = await fn();
      functions.complete(key, result);
      if (onComplete) onComplete(result);
      return { success: true, result };
    } catch (error) {
      functions.fail(key, error.message);
      if (onError) onError(error);
      throw error;
    }
  }
};

export default { manifest, init, activate, deactivate, functions };
