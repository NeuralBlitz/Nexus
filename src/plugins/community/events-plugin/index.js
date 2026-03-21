export const manifest = {
  name: 'events-plugin',
  id: 'events-plugin',
  version: '1.0.0',
  description: 'Event emitter and pub/sub system',
  author: 'NEXUS',
  main: 'index.js',
  permissions: []
};

let api;
const emitters = new Map();

export async function init(context) {
  api = context;
  api.log('Events plugin initialized');
}

export async function activate(context) {
  api.log('Events plugin activated');
}

export function deactivate() {
  api.log('Events plugin deactivated');
}

class EventEmitter {
  constructor() {
    this.events = new Map();
    this.eventHistory = [];
    this.maxHistory = 1000;
  }

  on(event, handler, options = {}) {
    if (!this.events.has(event)) this.events.set(event, []);
    const wrapper = { handler, once: options.once, priority: options.priority || 0 };
    this.events.get(event).push(wrapper);
    this.events.get(event).sort((a, b) => b.priority - a.priority);
    return () => this.off(event, handler);
  }

  once(event, handler) {
    return this.on(event, handler, { once: true });
  }

  off(event, handler) {
    const handlers = this.events.get(event);
    if (!handlers) return false;
    const index = handlers.findIndex(h => h.handler === handler);
    if (index > -1) { handlers.splice(index, 1); return true; }
    return false;
  }

  emit(event, data) {
    const handlers = this.events.get(event) || [];
    const wildcardHandlers = this.events.get('*') || [];
    const all = [...handlers, ...wildcardHandlers];
    const results = [];

    this.eventHistory.unshift({ event, data, timestamp: Date.now() });
    if (this.eventHistory.length > this.maxHistory) this.eventHistory.pop();

    const toRemove = [];
    for (const { handler, once } of all) {
      try {
        results.push(handler(data));
        if (once) toRemove.push(handler);
      } catch (e) {
        results.push({ error: e.message });
      }
    }

    for (const handler of toRemove) this.off(event, handler);
    return results;
  }

  async emitAsync(event, data) {
    const results = await Promise.all(this.emit(event, data));
    return results;
  }

  onAny(handler) {
    return this.on('*', handler);
  }

  offAny(handler) {
    return this.off('*', handler);
  }

  removeAllListeners(event) {
    if (event) this.events.delete(event);
    else this.events.clear();
  }

  listenerCount(event) {
    return this.events.get(event)?.length || 0;
  }

  eventNames() {
    return Array.from(this.events.keys());
  }

  getHistory() {
    return [...this.eventHistory];
  }

  clearHistory() {
    this.eventHistory = [];
  }
}

export const functions = {
  createEmitter: (id) => {
    if (emitters.has(id)) return emitters.get(id);
    const emitter = new EventEmitter();
    emitters.set(id, emitter);
    return emitter;
  },

  getEmitter: (id) => emitters.get(id) || null,

  deleteEmitter: (id) => emitters.delete(id),

  emit: (emitterId, event, data) => {
    const emitter = emitters.get(emitterId);
    if (!emitter) return [];
    return emitter.emit(event, data);
  },

  on: (emitterId, event, handler, options) => {
    const emitter = emitters.get(emitterId);
    if (!emitter) return null;
    return emitter.on(event, handler, options);
  },

  once: (emitterId, event, handler) => {
    const emitter = emitters.get(emitterId);
    if (!emitter) return null;
    return emitter.once(event, handler);
  },

  off: (emitterId, event, handler) => {
    const emitter = emitters.get(emitterId);
    return emitter ? emitter.off(event, handler) : false;
  },

  removeAllListeners: (emitterId, event) => {
    const emitter = emitters.get(emitterId);
    if (!emitter) return false;
    emitter.removeAllListeners(event);
    return true;
  },

  listenerCount: (emitterId, event) => {
    const emitter = emitters.get(emitterId);
    return emitter ? emitter.listenerCount(event) : 0;
  },

  eventNames: (emitterId) => {
    const emitter = emitters.get(emitterId);
    return emitter ? emitter.eventNames() : [];
  },

  history: (emitterId) => {
    const emitter = emitters.get(emitterId);
    return emitter ? emitter.getHistory() : [];
  },

  clearHistory: (emitterId) => {
    const emitter = emitters.get(emitterId);
    if (!emitter) return false;
    emitter.clearHistory();
    return true;
  }
};

export default { manifest, init, activate, deactivate, functions };
