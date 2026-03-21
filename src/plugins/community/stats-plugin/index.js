export const manifest = {
  name: 'stats-plugin',
  id: 'stats-plugin',
  version: '1.0.0',
  description: 'Statistical analysis utilities',
  author: 'NEXUS',
  main: 'index.js',
  permissions: []
};

let api;

export async function init(context) {
  api = context;
  api.log('Stats plugin initialized');
}

export async function activate(context) {
  api.log('Stats plugin activated');
}

export function deactivate() {
  api.log('Stats plugin deactivated');
}

function mean(arr) {
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function median(arr) {
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function variance(arr) {
  const m = mean(arr);
  return mean(arr.map(x => Math.pow(x - m, 2)));
}

function stdDev(arr) {
  return Math.sqrt(variance(arr));
}

function percentile(arr, p) {
  const sorted = [...arr].sort((a, b) => a - b);
  const index = (p / 100) * (sorted.length - 1);
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) return sorted[lower];
  return sorted[lower] * (upper - index) + sorted[upper] * (index - lower);
}

function covariance(arr1, arr2) {
  if (arr1.length !== arr2.length) return null;
  const m1 = mean(arr1), m2 = mean(arr2);
  return mean(arr1.map((x, i) => (x - m1) * (arr2[i] - m2)));
}

function correlation(arr1, arr2) {
  const cov = covariance(arr1, arr2);
  return cov / (stdDev(arr1) * stdDev(arr2));
}

function linearRegression(arr) {
  const n = arr.length;
  const xs = arr.map(p => p[0]), ys = arr.map(p => p[1]);
  const sumX = xs.reduce((a, b) => a + b, 0);
  const sumY = ys.reduce((a, b) => a + b, 0);
  const sumXY = xs.reduce((s, x, i) => s + x * ys[i], 0);
  const sumX2 = xs.reduce((s, x) => s + x * x, 0);
  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
  const intercept = (sumY - slope * sumX) / n;
  return { slope, intercept, r2: Math.pow(correlation(xs, ys), 2) };
}

export const functions = {
  mean: (arr) => mean(arr),
  median: (arr) => median(arr),
  mode: (arr) => {
    const freq = {};
    arr.forEach(v => freq[v] = (freq[v] || 0) + 1);
    const max = Math.max(...Object.values(freq));
    return Object.keys(freq).filter(k => freq[k] === max).map(Number);
  },
  sum: (arr) => arr.reduce((a, b) => a + b, 0),
  product: (arr) => arr.reduce((a, b) => a * b, 1),
  min: (arr) => Math.min(...arr),
  max: (arr) => Math.max(...arr),
  range: (arr) => Math.max(...arr) - Math.min(...arr),
  variance: (arr) => variance(arr),
  stdDev: (arr) => stdDev(arr),
  coefVariation: (arr) => stdDev(arr) / mean(arr) * 100,

  percentile: (arr, p) => percentile(arr, p),
  quartiles: (arr) => ({ q1: percentile(arr, 25), q2: percentile(arr, 50), q3: percentile(arr, 75) }),
  iqr: (arr) => percentile(arr, 75) - percentile(arr, 25),

  skewness: (arr) => {
    const m = mean(arr), s = stdDev(arr);
    const n = arr.length;
    return n / ((n - 1) * (n - 2)) * arr.reduce((sum, x) => sum + Math.pow((x - m) / s, 3), 0);
  },

  kurtosis: (arr) => {
    const m = mean(arr), s = stdDev(arr);
    const n = arr.length;
    return (n * (n + 1) / ((n - 1) * (n - 2) * (n - 3))) * arr.reduce((sum, x) => sum + Math.pow((x - m) / s, 4), 0)) - (3 * Math.pow(n - 1, 2)) / ((n - 2) * (n - 3));
  },

  describe: (arr) => ({
    count: arr.length,
    mean: mean(arr),
    median: median(arr),
    mode: functions.mode(arr),
    min: Math.min(...arr),
    max: Math.max(...arr),
    range: functions.range(arr),
    variance: variance(arr),
    stdDev: stdDev(arr),
    coefVariation: functions.coefVariation(arr),
    skewness: functions.skewness(arr),
    kurtosis: functions.kurtosis(arr),
    q1: percentile(arr, 25),
    q2: percentile(arr, 50),
    q3: percentile(arr, 75),
    iqr: functions.iqr(arr)
  }),

  covariance: (arr1, arr2) => covariance(arr1, arr2),
  correlation: (arr1, arr2) => correlation(arr1, arr2),
  linearRegression: (arr) => linearRegression(arr),

  normalize: (arr, method = 'minmax') => {
    if (method === 'minmax') {
      const min = Math.min(...arr), max = Math.max(...arr);
      return arr.map(x => (x - min) / (max - min));
    }
    if (method === 'zscore') {
      const m = mean(arr), s = stdDev(arr);
      return arr.map(x => (x - m) / s);
    }
    if (method === 'robust') {
      const q1 = percentile(arr, 25), q3 = percentile(arr, 75);
      const iqr = q3 - q1;
      return arr.map(x => (x - median(arr)) / iqr);
    }
    return arr;
  },

  histogram: (arr, bins = 10) => {
    const min = Math.min(...arr), max = Math.max(...arr);
    const width = (max - min) / bins;
    const hist = Array(bins).fill(0);
    arr.forEach(x => {
      const i = Math.min(Math.floor((x - min) / width), bins - 1);
      hist[i]++;
    });
    return hist.map((count, i) => ({ range: [min + i * width, min + (i + 1) * width], count }));
  },

  movingAverage: (arr, window) => {
    return arr.map((_, i, a) => {
      const start = Math.max(0, i - window + 1);
      return mean(a.slice(start, i + 1));
    });
  },

  exponentialMovingAverage: (arr, alpha = 0.3) => {
    const result = [arr[0]];
    for (let i = 1; i < arr.length; i++) {
      result.push(alpha * arr[i] + (1 - alpha) * result[i - 1]);
    }
    return result;
  },

  randomNormal: (count, mean = 0, stdDev = 1) => {
    const arr = [];
    for (let i = 0; i < count; i++) {
      const u1 = Math.random(), u2 = Math.random();
      const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
      arr.push(z * stdDev + mean);
    }
    return arr;
  },

  randomUniform: (count, min = 0, max = 1) => {
    return Array(count).fill(0).map(() => min + Math.random() * (max - min));
  }
};

export default { manifest, init, activate, deactivate, functions };
