export const manifest = {
  name: 'pipeline-plugin',
  id: 'pipeline-plugin',
  version: '1.0.0',
  description: 'Data pipeline utilities',
  author: 'NEXUS',
  main: 'index.js',
  permissions: []
};

let api;
const pipelines = new Map();

export async function init(context) {
  api = context;
  api.log('Pipeline plugin initialized');
}

export async function activate(context) {
  api.log('Pipeline plugin activated');
}

export function deactivate() {
  api.log('Pipeline plugin deactivated');
}

class Pipeline {
  constructor(name) {
    this.name = name;
    this.stages = [];
    this.errorHandler = null;
    this.stats = { processed: 0, failed: 0, skipped: 0 };
  }

  pipe(stage, options = {}) {
    this.stages.push({ name: stage.name || stage.constructor.name, fn: stage, options });
    return this;
  }

  error(handler) {
    this.errorHandler = handler;
    return this;
  }

  async process(data, context = {}) {
    let current = data;
    let currentContext = { ...context };

    for (const { fn, options } of this.stages) {
      try {
        const result = await fn(current, currentContext, options);
        if (result === null || result === undefined) {
          this.stats.skipped++;
          return null;
        }
        if (Array.isArray(result)) {
          const results = [];
          for (const item of result) {
            results.push(await this.processItem(item, currentContext));
          }
          return results;
        }
        current = result;
        currentContext = { ...currentContext, ...result._context };
      } catch (e) {
        this.stats.failed++;
        if (this.errorHandler) {
          const handled = await this.errorHandler(e, current, currentContext);
          if (handled !== undefined) current = handled;
        } else {
          throw e;
        }
      }
    }

    this.stats.processed++;
    return current;
  }

  async processItem(item, context) {
    let current = item;
    for (const { fn, options } of this.stages) {
      try {
        current = await fn(current, context, options);
      } catch (e) {
        this.stats.failed++;
        if (this.errorHandler) {
          const handled = await this.errorHandler(e, current, context);
          if (handled !== undefined) current = handled;
        } else {
          throw e;
        }
      }
    }
    return current;
  }

  async processBatch(data, context = {}) {
    const results = [];
    for (const item of data) {
      try {
        results.push(await this.process(item, context));
      } catch (e) {
        results.push({ error: e.message });
      }
    }
    return results;
  }

  clone() {
    const cloned = new Pipeline(this.name + '_clone');
    cloned.stages = [...this.stages];
    return cloned;
  }
}

const builtInStages = {
  map: (fn) => async (data) => Array.isArray(data) ? data.map(fn) : fn(data),
  filter: (fn) => async (data) => Array.isArray(data) ? data.filter(fn) : (fn(data) ? data : null),
  flatten: () => async (data) => Array.isArray(data) ? data.flat() : data,
  chunk: (size) => async (data) => Array.isArray(data) ? 
    Array.from({ length: Math.ceil(data.length / size) }, (_, i) => data.slice(i * size, i * size + size)) : data,
  take: (n) => async (data) => Array.isArray(data) ? data.slice(0, n) : data,
  skip: (n) => async (data) => Array.isArray(data) ? data.slice(n) : data,
  unique: (keyFn) => async (data) => {
    if (!Array.isArray(data)) return data;
    const seen = new Set();
    return data.filter(item => {
      const key = keyFn ? keyFn(item) : item;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  },
  sort: (compareFn) => async (data) => Array.isArray(data) ? data.sort(compareFn) : data,
  groupBy: (keyFn) => async (data) => {
    if (!Array.isArray(data)) return data;
    return data.reduce((groups, item) => {
      const key = keyFn(item);
      (groups[key] = groups[key] || []).push(item);
      return groups;
    }, {});
  },
  tap: (fn) => async (data) => { await fn(data); return data; },
  debatch: () => async (data) => Array.isArray(data) ? data : [data],
  batch: (size) => async (data) => Array.isArray(data) ? 
    Array.from({ length: Math.ceil(data.length / size) }, (_, i) => data.slice(i * size, i * size + size)) : [[data]],
  enrich: async (data, ctx, options) => {
    const { merge } = options;
    return merge ? { ...data, ...merge } : data;
  },
  validate: (schema) => async (data) => data,
  defaultTo: (defaultValue) => async (data) => data ?? defaultValue,
  pluck: (...keys) => async (data) => Array.isArray(data) ? 
    data.map(item => keys.reduce((obj, k) => ({ ...obj, [k]: item[k] }), {})) : keys.reduce((obj, k) => ({ ...obj, [k]: data[k] }), {})
};

export const functions = {
  create: (name) => {
    const pipeline = new Pipeline(name);
    pipelines.set(name, pipeline);
    return pipeline;
  },

  get: (name) => pipelines.get(name) || null,

  delete: (name) => pipelines.delete(name),

  process: async (name, data, context) => {
    const pipeline = pipelines.get(name);
    if (!pipeline) return null;
    return pipeline.process(data, context);
  },

  processBatch: async (name, data, context) => {
    const pipeline = pipelines.get(name);
    if (!pipeline) return [];
    return pipeline.processBatch(data, context);
  },

  stages: builtInStages,

  createStage: (name, fn) => {
    builtInStages[name] = fn;
    return true;
  }
};

export default { manifest, init, activate, deactivate, functions };
