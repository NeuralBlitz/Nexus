export const manifest = {
  name: 'stream-plugin',
  id: 'stream-plugin',
  version: '1.0.0',
  description: 'Stream processing utilities',
  author: 'NEXUS',
  main: 'index.js',
  permissions: []
};

let api;
const streams = new Map();

export async function init(context) {
  api = context;
  api.log('Stream plugin initialized');
}

export async function activate(context) {
  api.log('Stream plugin activated');
}

export function deactivate() {
  api.log('Stream plugin deactivated');
}

class DataStream {
  constructor(options = {}) {
    this.id = options.id || `stream_${Date.now()}`;
    this.buffer = [];
    this.maxBuffer = options.maxBuffer || 1000;
    this.transforms = [];
    this.subscribers = [];
    this.paused = false;
    this.stats = { emitted: 0, processed: 0, dropped: 0 };
  }

  write(data) {
    if (this.paused) { this.stats.dropped++; return false; }
    
    let value = data;
    for (const transform of this.transforms) {
      value = transform.fn(value);
    }
    
    this.buffer.push(value);
    if (this.buffer.length > this.maxBuffer) this.buffer.shift();
    
    this.stats.emitted++;
    for (const sub of this.subscribers) {
      try { sub.handler(value); } catch (e) { }
    }
    return true;
  }

  pipe(stream) {
    this.subscribers.push({ handler: (data) => stream.write(data), id: stream.id });
    return stream;
  }

  map(fn) {
    this.transforms.push({ fn, type: 'map' });
    return this;
  }

  filter(fn) {
    this.transforms.push({ fn, type: 'filter' });
    return this;
  }

  flatMap(fn) {
    this.transforms.push({ fn, type: 'flatMap' });
    return this;
  }

  take(n) {
    let count = 0;
    this.transforms.push({
      fn: (v) => { count++; return count <= n ? v : null; },
      type: 'take'
    });
    return this;
  }

  skip(n) {
    let count = 0;
    this.transforms.push({
      fn: (v) => { count++; return count > n ? v : null; },
      type: 'skip'
    });
    return this;
  }

  takeWhile(fn) {
    this.transforms.push({ fn, type: 'takeWhile', takeWhile: true });
    return this;
  }

  distinct(fn) {
    const seen = new Set();
    this.transforms.push({
      fn: (v) => {
        const key = fn ? fn(v) : v;
        if (seen.has(key)) return null;
        seen.add(key);
        return v;
      },
      type: 'distinct'
    });
    return this;
  }

  window(size, step = size) {
    let window = [];
    this.transforms.push({
      fn: (v) => {
        window.push(v);
        if (window.length === size) {
          const w = [...window];
          window = window.slice(step);
          return w;
        }
        return null;
      },
      type: 'window'
    });
    return this;
  }

  throttle(delay) {
    let last = 0;
    this.transforms.push({
      fn: (v) => {
        const now = Date.now();
        if (now - last >= delay) { last = now; return v; }
        return null;
      },
      type: 'throttle'
    });
    return this;
  }

  debounce(delay) {
    let timeout;
    this.transforms.push({
      fn: (v) => {
        clearTimeout(timeout);
        return new Promise(resolve => {
          timeout = setTimeout(() => { resolve(v); }, delay);
        });
      },
      type: 'debounce'
    });
    return this;
  }

  subscribe(handler) {
    this.subscribers.push({ handler, id: `sub_${Date.now()}` });
    return () => { this.subscribers = this.subscribers.filter(s => s.handler !== handler); };
  }

  pause() { this.paused = true; }
  resume() { this.paused = false; }

  toArray() {
    return [...this.buffer];
  }

  clear() {
    this.buffer = [];
  }

  getStats() {
    return { ...this.stats, bufferSize: this.buffer.length };
  }
}

export const functions = {
  create: (options = {}) => {
    const stream = new DataStream(options);
    streams.set(stream.id, stream);
    return stream;
  },

  get: (id) => streams.get(id) || null,

  delete: (id) => streams.delete(id),

  write: (id, data) => {
    const stream = streams.get(id);
    return stream ? stream.write(data) : false;
  },

  map: (id, fn) => {
    const stream = streams.get(id);
    if (stream) stream.map(fn);
    return stream || null;
  },

  filter: (id, fn) => {
    const stream = streams.get(id);
    if (stream) stream.filter(fn);
    return stream || null;
  },

  subscribe: (id, handler) => {
    const stream = streams.get(id);
    return stream ? stream.subscribe(handler) : null;
  },

  fromArray: (arr, options = {}) => {
    const stream = functions.create(options);
    for (const item of arr) stream.write(item);
    return stream;
  },

  merge: (streamIds, options = {}) => {
    const merged = functions.create(options);
    for (const id of streamIds) {
      const stream = streams.get(id);
      if (stream) stream.pipe(merged);
    }
    return merged;
  },

  zip: (streamIds, options = {}) => {
    const buffers = streamIds.map(id => streams.get(id)?.buffer || []);
    const zipped = functions.create(options);
    
    const minLen = Math.min(...buffers.map(b => b.length));
    for (let i = 0; i < minLen; i++) {
      zipped.write(buffers.map(b => b[i]));
    }
    return zipped;
  },

  concat: (streamIds, options = {}) => {
    const concatenated = functions.create(options);
    for (const id of streamIds) {
      const stream = streams.get(id);
      if (stream) {
        for (const item of stream.buffer) concatenated.write(item);
      }
    }
    return concatenated;
  }
};

export default { manifest, init, activate, deactivate, functions };
