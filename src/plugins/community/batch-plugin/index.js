export const manifest = {
  name: 'batch-plugin',
  id: 'batch-plugin',
  version: '1.0.0',
  description: 'Batch processing utilities',
  author: 'NEXUS',
  main: 'index.js',
  permissions: []
};

let api;
const batches = new Map();

export async function init(context) {
  api = context;
  api.log('Batch plugin initialized');
}

export async function activate(context) {
  api.log('Batch plugin activated');
}

export function deactivate() {
  api.log('Batch plugin deactivated');
}

class BatchProcessor {
  constructor(options = {}) {
    this.options = {
      size: options.size || 10,
      interval: options.interval || 1000,
      maxSize: options.maxSize || 100,
      maxWait: options.maxWait || 5000,
      mode: options.mode || 'size'
    };
    this.buffer = [];
    this.processing = false;
    this.processor = null;
    this.timer = null;
    this.stats = { processed: 0, failed: 0, batches: 0 };
  }

  add(item) {
    this.buffer.push(item);
    if (this.buffer.length >= this.options.size) {
      return this.process();
    }
    if (!this.timer) {
      this.timer = setTimeout(() => this.process(), this.options.maxWait);
    }
    return { queued: true, size: this.buffer.length };
  }

  async process() {
    if (this.processing || this.buffer.length === 0) return;
    
    clearTimeout(this.timer);
    this.processing = true;

    const items = this.buffer.splice(0, this.options.size);
    this.stats.batches++;

    if (this.processor) {
      try {
        await this.processor(items);
        this.stats.processed += items.length;
      } catch (e) {
        this.stats.failed += items.length;
      }
    }

    this.processing = false;

    if (this.buffer.length >= this.options.size) {
      return this.process();
    }
  }

  onProcess(fn) {
    this.processor = fn;
    return this;
  }

  flush() {
    return this.process();
  }

  getStats() {
    return { ...this.stats, bufferSize: this.buffer.length, processing: this.processing };
  }

  clear() {
    this.buffer = [];
    clearTimeout(this.timer);
  }
}

export const functions = {
  create: (name, options = {}) => {
    const batch = new BatchProcessor(options);
    batches.set(name, batch);
    return batch;
  },

  get: (name) => batches.get(name) || null,

  delete: (name) => {
    const batch = batches.get(name);
    if (batch) batch.clear();
    return batches.delete(name);
  },

  add: (name, item) => {
    const batch = batches.get(name);
    if (!batch) return null;
    return batch.add(item);
  },

  process: (name) => {
    const batch = batches.get(name);
    if (!batch) return null;
    return batch.process();
  },

  flush: (name) => {
    const batch = batches.get(name);
    if (!batch) return null;
    return batch.flush();
  },

  onProcess: (name, fn) => {
    const batch = batches.get(name);
    if (!batch) return null;
    return batch.onProcess(fn);
  },

  stats: (name) => {
    const batch = batches.get(name);
    return batch ? batch.getStats() : null;
  },

  clear: (name) => {
    const batch = batches.get(name);
    if (!batch) return false;
    batch.clear();
    return true;
  },

  batchItems: (items, size = 10) => {
    const result = [];
    for (let i = 0; i < items.length; i += size) {
      result.push(items.slice(i, i + size));
    }
    return result;
  },

  processBatch: async (items, fn, options = {}) => {
    const { concurrency = 1, onProgress } = options;
    const batches = functions.batchItems(items, options.batchSize || 10);
    const results = [];
    let completed = 0;

    for (let i = 0; i < batches.length; i += concurrency) {
      const chunk = batches.slice(i, i + concurrency);
      const chunkResults = await Promise.all(chunk.map(batch => fn(batch)));
      results.push(...chunkResults);
      completed += chunk.length;
      if (onProgress) onProgress({ completed, total: batches.length, progress: completed / batches.length });
    }

    return results;
  }
};

export default { manifest, init, activate, deactivate, functions };
