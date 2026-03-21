export const manifest = {
  name: 'retry-plugin',
  id: 'retry-plugin',
  version: '1.0.0',
  description: 'Retry and backoff utilities',
  author: 'NEXUS',
  main: 'index.js',
  permissions: []
};

let api;

export async function init(context) {
  api = context;
  api.log('Retry plugin initialized');
}

export async function activate(context) {
  api.log('Retry plugin activated');
}

export function deactivate() {
  api.log('Retry plugin deactivated');
}

export const functions = {
  retry: async (fn, options = {}) => {
    const { attempts = 3, delay = 1000, backoff = 2, jitter = 0, onRetry, onFail } = options;
    let lastError;
    
    for (let i = 0; i < attempts; i++) {
      try {
        return await fn({ attempt: i + 1, maxAttempts: attempts });
      } catch (e) {
        lastError = e;
        if (onRetry) onRetry(i + 1, e);
        if (i < attempts - 1) {
          const wait = delay * Math.pow(backoff, i) + (jitter ? Math.random() * jitter * delay : 0);
          await new Promise(r => setTimeout(r, wait));
        }
      }
    }
    
    if (onFail) onFail(lastError);
    throw lastError;
  },

  retrySync: (fn, options = {}) => {
    const { attempts = 3, delay = 1000, backoff = 2, jitter = 0, onRetry, onFail } = options;
    let lastError;
    
    for (let i = 0; i < attempts; i++) {
      try {
        return fn({ attempt: i + 1, maxAttempts: attempts });
      } catch (e) {
        lastError = e;
        if (onRetry) onRetry(i + 1, e);
        if (i < attempts - 1) {
          const wait = delay * Math.pow(backoff, i) + (jitter ? Math.random() * jitter * delay : 0);
          const start = Date.now();
          while (Date.now() - start < wait) { }
        }
      }
    }
    
    if (onFail) onFail(lastError);
    throw lastError;
  },

  retryUntil: async (fn, condition, options = {}) => {
    const { maxAttempts = 10, delay = 1000, onRetry, onFail } = options;
    
    for (let i = 0; i < maxAttempts; i++) {
      const result = await fn({ attempt: i + 1, maxAttempts });
      if (condition(result)) return result;
      if (onRetry) onRetry(i + 1, result);
      if (i < maxAttempts - 1) await new Promise(r => setTimeout(r, delay));
    }
    
    if (onFail) onFail(new Error('Condition not met'));
    return null;
  },

  retryWithFallback: async (fn, fallback, options = {}) => {
    const { attempts = 3, delay = 1000, backoff = 2 } = options;
    
    try {
      return await functions.retry(fn, { attempts, delay, backoff });
    } catch {
      return fallback();
    }
  },

  exponential: async (fn, options = {}) => {
    const { maxDelay = 30000, factor = 2, ...rest } = options;
    return functions.retry(fn, {
      ...rest,
      delay: options.delay || 1000,
      backoff: async (attempt) => Math.min(maxDelay, options.delay * Math.pow(factor, attempt))
    });
  },

  linear: async (fn, options = {}) => {
    const { delay = 1000, ...rest } = options;
    return functions.retry(fn, { ...rest, delay, backoff: 1 });
  },

  fibonacci: async (fn, options = {}) => {
    const fib = (n) => n <= 1 ? n : fib(n - 1) + fib(n - 2);
    return functions.retry(fn, {
      ...options,
      delay: 1000,
      backoff: (attempt) => fib(attempt) * 1000
    });
  },

  forever: async (fn, options = {}) => {
    const { delay = 1000, onRetry } = options;
    let attempt = 0;
    while (true) {
      try {
        return await fn({ attempt: ++attempt });
      } catch (e) {
        if (onRetry) onRetry(attempt, e);
        await new Promise(r => setTimeout(r, delay));
      }
    }
  },

  race: async (fns, options = {}) => {
    const { timeout = 5000 } = options;
    const promises = fns.map((fn, i) => fn().catch(e => { throw new Error(`Function ${i} failed: ${e.message}`); }));
    const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), timeout));
    return Promise.race([...promises, timeoutPromise]);
  },

  allSettled: async (fns, options = {}) => {
    const { concurrency = Infinity, delay = 0 } = options;
    const results = [];
    for (let i = 0; i < fns.length; i += concurrency) {
      const batch = fns.slice(i, i + concurrency);
      results.push(...await Promise.allSettled(batch.map(fn => fn())));
      if (delay && i + concurrency < fns.length) await new Promise(r => setTimeout(r, delay));
    }
    return results;
  },

  timeout: async (fn, ms, fallback) => {
    return Promise.race([
      fn(),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), ms))
    ]).catch(e => {
      if (e.message === 'Timeout' && fallback) return fallback();
      throw e;
    });
  },

  backoff: {
    exponential: (attempt, base = 1000, max = 30000) => Math.min(max, base * Math.pow(2, attempt)),
    linear: (attempt, base = 1000) => base * attempt,
    fibonacci: (attempt, base = 1000) => (attempt <= 1 ? base : (attempt - 1 + attempt - 2) * base)
  }
};

export default { manifest, init, activate, deactivate, functions };
