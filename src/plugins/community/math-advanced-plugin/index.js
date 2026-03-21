export const manifest = {
  name: 'math-advanced-plugin',
  id: 'math-advanced-plugin',
  version: '1.0.0',
  description: 'Advanced mathematical functions',
  author: 'NEXUS',
  main: 'index.js',
  permissions: []
};

let api;

export async function init(context) {
  api = context;
  api.log('Advanced Math plugin initialized');
}

export async function activate(context) {
  api.log('Advanced Math plugin activated');
}

export function deactivate() {
  api.log('Advanced Math plugin deactivated');
}

export const functions = {
  gcd: (a, b) => {
    a = Math.abs(a); b = Math.abs(b);
    while (b) { [a, b] = [b, a % b]; }
    return a;
  },

  lcm: (a, b) => Math.abs(a * b) / functions.gcd(a, b),

  factorial: (n) => {
    if (n < 0) return null;
    if (n <= 1) return 1;
    if (n > 170) return Infinity;
    let result = 1n;
    for (let i = 2; i <= n; i++) result *= BigInt(i);
    return result;
  },

  binomial: (n, k) => {
    if (k < 0 || k > n) return 0;
    if (k === 0 || k === n) return 1;
    let result = 1;
    for (let i = 0; i < k; i++) result = result * (n - i) / (i + 1);
    return Math.round(result);
  },

  permutations: (n, r) => {
    if (r > n) return 0;
    let result = 1;
    for (let i = 0; i < r; i++) result *= (n - i);
    return Math.round(result);
  },

  combinations: (n, r) => functions.binomial(n, r),

  isPrime: (n) => {
    if (n <= 1) return false;
    if (n <= 3) return true;
    if (n % 2 === 0 || n % 3 === 0) return false;
    for (let i = 5; i * i <= n; i += 6) {
      if (n % i === 0 || n % (i + 2) === 0) return false;
    }
    return true;
  },

  primes: (limit) => {
    const result = [];
    for (let i = 2; i <= limit; i++) {
      if (functions.isPrime(i)) result.push(i);
    }
    return result;
  },

  primeFactors: (n) => {
    const factors = [];
    let d = 2;
    while (n > 1) {
      while (n % d === 0) { factors.push(d); n /= d; }
      d++;
    }
    return factors;
  },

  fibonacci: (n) => {
    if (n <= 1) return n;
    let a = 0, b = 1;
    for (let i = 2; i <= n; i++) { [a, b] = [b, a + b]; }
    return b;
  },

  fibonacciSequence: (count) => {
    const seq = [0, 1];
    while (seq.length < count) seq.push(seq[seq.length - 1] + seq[seq.length - 2]);
    return seq;
  },

  isPerfectSquare: (n) => {
    const s = Math.sqrt(n);
    return s === Math.floor(s);
  },

  isPerfectNumber: (n) => {
    let sum = 1;
    for (let i = 2; i * i <= n; i++) {
      if (n % i === 0) sum += i + (i !== n / i ? n / i : 0);
    }
    return sum === n && n > 1;
  },

  collatz: (n) => {
    const seq = [n];
    while (n !== 1) {
      n = n % 2 === 0 ? n / 2 : 3 * n + 1;
      seq.push(n);
    }
    return seq;
  },

  euclideanDistance: (p1, p2) => Math.sqrt(p1.reduce((sum, v, i) => sum + Math.pow(v - p2[i], 2), 0)),
  manhattanDistance: (p1, p2) => p1.reduce((sum, v, i) => sum + Math.abs(v - p2[i]), 0),

  clamp: (value, min, max) => Math.min(Math.max(value, min), max),
  lerp: (a, b, t) => a + (b - a) * t,
  inverseLerp: (a, b, value) => (value - a) / (b - a),
  remap: (value, inMin, inMax, outMin, outMax) => outMin + (value - inMin) * (outMax - outMin) / (inMax - inMin),

  average: (...nums) => nums.reduce((a, b) => a + b, 0) / nums.length,
  median: (...nums) => {
    const sorted = [...nums].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  },
  mode: (...nums) => {
    const freq = {};
    nums.forEach(n => freq[n] = (freq[n] || 0) + 1);
    const max = Math.max(...Object.values(freq));
    return Object.keys(freq).filter(k => freq[k] === max).map(Number);
  },
  variance: (...nums) => {
    const avg = functions.average(...nums);
    return functions.average(...nums.map(n => Math.pow(n - avg, 2)));
  },
  stdDev: (...nums) => Math.sqrt(functions.variance(...nums)),

  solveQuadratic: (a, b, c) => {
    const discriminant = b * b - 4 * a * c;
    if (discriminant < 0) return { real: false };
    if (discriminant === 0) return { real: true, x: -b / (2 * a) };
    const sqrtD = Math.sqrt(discriminant);
    return { real: true, x1: (-b + sqrtD) / (2 * a), x2: (-b - sqrtD) / (2 * a) };
  },

  degToRad: (deg) => deg * Math.PI / 180,
  radToDeg: (rad) => rad * 180 / Math.PI,

  circleArea: (r) => Math.PI * r * r,
  circleCircumference: (r) => 2 * Math.PI * r,
  sphereVolume: (r) => (4 / 3) * Math.PI * r ** 3,
  sphereSurfaceArea: (r) => 4 * Math.PI * r ** 2,

  trapezoidArea: (a, b, h) => ((a + b) / 2) * h,
  triangleArea: (b, h) => (b * h) / 2,
  pythagorean: (a, b) => Math.sqrt(a * a + b * b)
};

export default { manifest, init, activate, deactivate, functions };
