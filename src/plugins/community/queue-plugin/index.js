export const manifest = {
  name: 'queue-plugin',
  id: 'queue-plugin',
  version: '1.0.0',
  description: 'Message queue utilities',
  author: 'NEXUS',
  main: 'index.js',
  permissions: []
};

let api;
const queues = new Map();

export async function init(context) {
  api = context;
  api.log('Queue plugin initialized');
}

export async function activate(context) {
  api.log('Queue plugin activated');
}

export function deactivate() {
  api.log('Queue plugin deactivated');
}

class MessageQueue {
  constructor(name, options = {}) {
    this.name = name;
    this.messages = [];
    this.options = { ...{ maxSize: 1000, persistent: false }, ...options };
    this.subscribers = [];
    this.stats = { enqueued: 0, dequeued: 0, acknowledged: 0, rejected: 0 };
  }

  enqueue(message, options = {}) {
    if (this.messages.length >= this.options.maxSize) {
      if (options.dropOldest) this.messages.shift();
      else return { success: false, error: 'Queue full' };
    }
    const msg = {
      id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      data: message,
      priority: options.priority || 0,
      delay: options.delay || 0,
      attempts: 0,
      maxAttempts: options.maxAttempts || 3,
      createdAt: Date.now(),
      scheduledAt: Date.now() + (options.delay || 0)
    };
    this.messages.push(msg);
    this.messages.sort((a, b) => b.priority - a.priority || a.scheduledAt - b.scheduledAt);
    this.stats.enqueued++;
    return { success: true, id: msg.id };
  }

  dequeue() {
    const now = Date.now();
    const index = this.messages.findIndex(m => m.scheduledAt <= now);
    if (index === -1) return null;
    const [msg] = this.messages.splice(index, 1);
    return msg;
  }

  ack(messageId) {
    this.stats.acknowledged++;
    return true;
  }

  reject(messageId, requeue = false) {
    const msg = this.messages.find(m => m.id === messageId);
    if (msg) {
      msg.attempts++;
      if (msg.attempts < msg.maxAttempts && requeue) {
        msg.scheduledAt = Date.now() + 1000 * Math.pow(2, msg.attempts);
      } else {
        this.messages = this.messages.filter(m => m.id !== messageId);
      }
    }
    this.stats.rejected++;
    return true;
  }

  peek() {
    const now = Date.now();
    return this.messages.find(m => m.scheduledAt <= now) || null;
  }

  size() {
    const now = Date.now();
    return this.messages.filter(m => m.scheduledAt <= now).length;
  }

  purge() {
    const count = this.messages.length;
    this.messages = [];
    return count;
  }
}

export const functions = {
  createQueue: (name, options = {}) => {
    if (queues.has(name)) return queues.get(name);
    const queue = new MessageQueue(name, options);
    queues.set(name, queue);
    return queue;
  },

  getQueue: (name) => queues.get(name) || null,

  deleteQueue: (name) => queues.delete(name),

  listQueues: () => Array.from(queues.keys()),

  enqueue: (queueName, message, options = {}) => {
    const queue = queues.get(queueName);
    if (!queue) return { success: false, error: 'Queue not found' };
    return queue.enqueue(message, options);
  },

  dequeue: (queueName) => {
    const queue = queues.get(queueName);
    if (!queue) return null;
    return queue.dequeue();
  },

  ack: (queueName, messageId) => {
    const queue = queues.get(queueName);
    return queue ? queue.ack(messageId) : false;
  },

  reject: (queueName, messageId, requeue = false) => {
    const queue = queues.get(queueName);
    return queue ? queue.reject(messageId, requeue) : false;
  },

  size: (queueName) => {
    const queue = queues.get(queueName);
    return queue ? queue.size() : 0;
  },

  stats: (queueName) => {
    const queue = queues.get(queueName);
    return queue ? { ...queue.stats, pending: queue.messages.length } : null;
  },

  subscribe: (queueName, handler) => {
    const queue = queues.get(queueName);
    if (!queue) return false;
    queue.subscribers.push(handler);
    return true;
  },

  drain: async (queueName, handler, batchSize = 10) => {
    const queue = queues.get(queueName);
    if (!queue) return 0;
    let count = 0;
    for (let i = 0; i < batchSize; i++) {
      const msg = queue.dequeue();
      if (!msg) break;
      await handler(msg);
      queue.ack(msg.id);
      count++;
    }
    return count;
  },

  process: (queueName, handler, concurrency = 1) => {
    const queue = queues.get(queueName);
    if (!queue) return false;
    
    const processNext = async () => {
      while (true) {
        const msg = queue.dequeue();
        if (!msg) break;
        try {
          await handler(msg);
          queue.ack(msg.id);
        } catch (e) {
          queue.reject(msg.id, true);
        }
      }
    };

    for (let i = 0; i < concurrency; i++) processNext();
    return true;
  }
};

export default { manifest, init, activate, deactivate, functions };
