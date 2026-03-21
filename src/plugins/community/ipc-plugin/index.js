export const manifest = {
  name: 'ipc-plugin',
  id: 'ipc-plugin',
  version: '1.0.0',
  description: 'Inter-process communication utilities',
  author: 'NEXUS',
  main: 'index.js',
  permissions: []
};

let api;
const listeners = new Map();
const messageQueue = new Map();

export async function init(context) {
  api = context;
  api.log('IPC plugin initialized');
}

export async function activate(context) {
  api.log('IPC plugin activated');
}

export function deactivate() {
  api.log('IPC plugin deactivated');
}

export const functions = {
  send: (channel, message) => {
    const id = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const payload = { id, channel, message, timestamp: Date.now() };
    
    const handlers = listeners.get(channel) || [];
    handlers.forEach(fn => fn(payload));
    
    if (!messageQueue.has(channel)) messageQueue.set(channel, []);
    messageQueue.get(channel).push(payload);
    
    return { sent: true, id, channel };
  },

  on: (channel, handler) => {
    if (!listeners.has(channel)) listeners.set(channel, []);
    listeners.get(channel).push(handler);
    return { subscribed: true, channel };
  },

  off: (channel, handler) => {
    const handlers = listeners.get(channel) || [];
    const index = handlers.indexOf(handler);
    if (index > -1) handlers.splice(index, 1);
    return { unsubscribed: index > -1 };
  },

  once: (channel, handler) => {
    const wrapped = (msg) => {
      functions.off(channel, wrapped);
      handler(msg);
    };
    return functions.on(channel, wrapped);
  },

  emit: (channel, event, data) => {
    return functions.send(channel, { type: 'event', event, data, source: 'plugin' });
  },

  broadcast: (message) => {
    const results = [];
    for (const channel of listeners.keys()) {
      results.push(functions.send(channel, message));
    }
    return { broadcast: true, recipients: results.length };
  },

  getQueue: (channel) => messageQueue.get(channel) || [],
  clearQueue: (channel) => {
    if (channel) messageQueue.delete(channel);
    else messageQueue.clear();
    return { cleared: true };
  },

  ping: () => ({ pong: true, timestamp: Date.now() }),
  version: () => '1.0.0'
};

export default { manifest, init, activate, deactivate, functions };
