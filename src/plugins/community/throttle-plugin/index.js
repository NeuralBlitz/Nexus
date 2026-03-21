export const manifest = {
  name: 'throttle-plugin',
  id: 'throttle-plugin',
  version: '1.0.0',
  description: 'Throttling and debouncing utilities',
  author: 'NEXUS',
  main: 'index.js',
  permissions: []
};

let api;
const timers = new Map();

export async function init(context) {
  api = context;
  api.log('Throttle plugin initialized');
}

export async function activate(context) {
  api.log('Throttle plugin activated');
}

export function deactivate() {
  api.log('Throttle plugin deactivated');
}

export const functions = {
  throttle: (fn, delay) => {
    let lastCall = 0;
    return (...args) => {
      const now = Date.now();
      if (now - lastCall >= delay) {
        lastCall = now;
        return fn(...args);
      }
      return { throttled: true, lastCall };
    };
  },

  debounce: (fn, delay, immediate = false) => {
    let timeout;
    return (...args) => {
      clearTimeout(timeout);
      if (immediate && !timeout) fn(...args);
      timeout = setTimeout(() => fn(...args), delay);
    };
  },

  once: (fn) => {
    let called = false, result;
    return (...args) => {
      if (!called) { called = true; result = fn(...args); }
      return result;
    };
  },

  after: (times, fn) => {
    let count = 0;
    return (...args) => {
      count++;
      if (count >= times) return fn(...args);
      return { pending: true, count, remaining: times - count };
    };
  },

  before: (times, fn) => {
    let count = 0;
    return (...args) => {
      if (count < times) { count++; return fn(...args); }
      return { exhausted: true, times };
    };
  },

  limit: (fn, maxCalls) => {
    let calls = 0;
    return (...args) => {
      if (calls < maxCalls) { calls++; return fn(...args); }
      return { limited: true, calls, maxCalls };
    };
  },

  memoize: (fn, resolver) => {
    const cache = new Map();
    return (...args) => {
      const key = resolver ? resolver(...args) : JSON.stringify(args);
      if (cache.has(key)) return cache.get(key);
      const result = fn(...args);
      cache.set(key, result);
      return result;
    };
  },

  sleep: (ms) => new Promise(resolve => setTimeout(resolve, ms)),

  timeout: (fn, ms, fallback) => {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        if (fallback) resolve(fallback());
        else reject(new Error('Timeout'));
      }, ms);
      Promise.resolve(fn()).then(result => {
        clearTimeout(timer);
        resolve(result);
      }).catch(err => {
        clearTimeout(timer);
        reject(err);
      });
    });
  },

  retry: async (fn, options = {}) => {
    const { attempts = 3, delay = 1000, backoff = 2, onRetry } = options;
    let lastError;
    for (let i = 0; i < attempts; i++) {
      try {
        return await fn();
      } catch (e) {
        lastError = e;
        if (onRetry) onRetry(i + 1, e);
        if (i < attempts - 1) await functions.sleep(delay * Math.pow(backoff, i));
      }
    }
    throw lastError;
  },

  queue: (fn, concurrency = 1) => {
    let queue = [], running = 0;
    const process = () => {
      while (running < concurrency && queue.length) {
        running++;
        const { fn, resolve, reject } = queue.shift();
        fn().then(resolve).catch(reject).finally(() => {
          running--;
          process();
        });
      }
    };
    return (task) => new Promise((resolve, reject) => {
      queue.push({ fn: () => task(), resolve, reject });
      process();
    });
  },

  raf: (fn) => {
    let frame;
    return (...args) => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => fn(...args));
    };
  },

  leading: (fn, delay) => {
    let lastCall = 0, timeout;
    return (...args) => {
      const now = Date.now();
      if (now - lastCall >= delay) {
        lastCall = now;
        return fn(...args);
      }
      clearTimeout(timeout);
      timeout = setTimeout(() => lastCall = 0, delay);
      return { debounced: true };
    };
  },

  trailing: (fn, delay) => {
    let timeout;
    return (...args) => {
      clearTimeout(timeout);
      timeout = setTimeout(() => fn(...args), delay);
    };
  }
};

export default { manifest, init, activate, deactivate, functions };
