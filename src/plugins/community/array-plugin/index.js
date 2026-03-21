export const manifest = {
  name: 'array-plugin',
  id: 'array-plugin',
  version: '1.0.0',
  description: 'Array manipulation and utilities',
  author: 'NEXUS',
  main: 'index.js',
  permissions: []
};

let api;

export async function init(context) {
  api = context;
  api.log('Array plugin initialized');
}

export async function activate(context) {
  api.log('Array plugin activated');
}

export function deactivate() {
  api.log('Array plugin deactivated');
}

export const functions = {
  chunk: (array, size) => {
    const result = [];
    for (let i = 0; i < array.length; i += size) result.push(array.slice(i, i + size));
    return result;
  },

  compact: (array) => array.filter(Boolean),

  difference: (a, b) => a.filter(x => !b.includes(x)),

  intersection: (a, b) => a.filter(x => b.includes(x)),

  union: (...arrays) => [...new Set(arrays.flat())],

  unique: (array) => [...new Set(array)],

  flatten: (array, depth = 1) => {
    if (depth === Infinity) return array.flat(Infinity);
    return depth > 0 ? array.reduce((acc, val) => acc.concat(Array.isArray(val) ? functions.flatten(val, depth - 1) : val), []) : array;
  },

  groupBy: (array, key) => {
    const result = {};
    for (const item of array) {
      const group = typeof key === 'function' ? key(item) : item[key];
      if (!result[group]) result[group] = [];
      result[group].push(item);
    }
    return result;
  },

  keyBy: (array, key) => Object.fromEntries(array.map(item => [item[key], item])),

  sortBy: (array, key) => [...array].sort((a, b) => {
    const aVal = typeof key === 'function' ? key(a) : a[key];
    const bVal = typeof key === 'function' ? key(b) : b[key];
    return aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
  }),

  countBy: (array, key) => {
    const result = {};
    for (const item of array) {
      const group = typeof key === 'function' ? key(item) : item[key];
      result[group] = (result[group] || 0) + 1;
    }
    return result;
  },

  pluck: (array, key) => array.map(item => item[key]),

  shuffle: (array) => [...array].sort(() => Math.random() - 0.5),

  sample: (array, count = 1) => {
    const shuffled = functions.shuffle(array);
    return count === 1 ? shuffled[0] : shuffled.slice(0, count);
  },

  zip: (...arrays) => {
    const maxLen = Math.max(...arrays.map(a => a.length));
    return Array.from({ length: maxLen }, (_, i) => arrays.map(a => a[i]));
  },

  unzip: (zipped) => {
    return zipped[0].map((_, i) => zipped.map(row => row[i]));
  },

  range: (start, end, step = 1) => {
    const result = [];
    for (let i = start; step > 0 ? i < end : i > end; i += step) result.push(i);
    return result;
  },

  repeat: (value, count) => Array(count).fill(value),

  chunkEvery: (array, size, step = size, fillValue = null) => {
    const result = [];
    for (let i = 0; i < array.length; i += step) {
      const chunk = array.slice(i, i + size);
      while (chunk.length < size) chunk.push(fillValue);
      result.push(chunk);
    }
    return result;
  },

  transpose: (matrix) => matrix[0].map((_, i) => matrix.map(row => row[i])),

  rotate: (array, times) => {
    const n = ((times % array.length) + array.length) % array.length;
    return [...array.slice(n), ...array.slice(0, n)];
  },

  first: (array, n = 1) => n === 1 ? array[0] : array.slice(0, n),
  last: (array, n = 1) => n === 1 ? array[array.length - 1] : array.slice(-n),

  remove: (array, predicate) => {
    const removed = [], kept = [];
    for (const item of array) {
      (typeof predicate === 'function' ? predicate(item) : item === predicate ? item[predicate] : item?.[predicate]) ? removed.push(item) : kept.push(item);
    }
    return { removed, kept };
  },

  deduplicate: (array, key) => {
    const seen = new Set();
    return array.filter(item => {
      const val = key ? item[key] : item;
      return seen.has(val) ? false : (seen.add(val), true);
    });
  }
};

export default { manifest, init, activate, deactivate, functions };
