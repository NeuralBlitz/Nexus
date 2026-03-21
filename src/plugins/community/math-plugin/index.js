export const manifest = {
  name: 'math-plugin',
  id: 'math-plugin',
  version: '1.0.0',
  description: 'Advanced mathematical operations and calculations',
  author: 'NEXUS',
  main: 'index.js',
  permissions: []
};

let api;

export async function init(context) {
  api = context;
  api.log('Math plugin initialized');
}

export async function activate(context) {
  api.log('Math plugin activated');
}

export function deactivate() {
  api.log('Math plugin deactivated');
}

export const hooks = {
  'agent:task:execute': async (task, context) => {
    if (task.type === 'math') {
      return calculate(task.expression, task.options);
    }
  }
};

function calculate(expression, options = {}) {
  const allowedFunctions = ['sin', 'cos', 'tan', 'sqrt', 'log', 'exp', 'abs', 'floor', 'ceil', 'round', 'pow', 'min', 'max'];
  
  try {
    const safeEval = new Function('Math', `
      const { sin, cos, tan, sqrt, log, exp, abs, floor, ceil, round, pow, min, max } = Math;
      return ${expression};
    `);
    
    const result = safeEval(Math);
    return {
      expression,
      result: typeof result === 'number' && !isNaN(result) ? result : null,
      valid: typeof result === 'number' && !isNaN(result)
    };
  } catch (e) {
    return { expression, error: e.message, valid: false };
  }
}

export const functions = {
  calculate,
  solveEquation: (a, b, c) => {
    const discriminant = b * b - 4 * a * c;
    if (discriminant < 0) return { roots: [], real: false };
    if (discriminant === 0) return { roots: [-b / (2 * a)], real: true };
    const sqrtD = Math.sqrt(discriminant);
    return {
      roots: [(-b + sqrtD) / (2 * a), (-b - sqrtD) / (2 * a)],
      real: true
    };
  },
  fibonacci: (n) => {
    if (n <= 1) return n;
    let a = 0, b = 1;
    for (let i = 2; i <= n; i++) {
      [a, b] = [b, a + b];
    }
    return b;
  },
  primeCheck: (n) => {
    if (n <= 1) return false;
    if (n <= 3) return true;
    if (n % 2 === 0 || n % 3 === 0) return false;
    for (let i = 5; i * i <= n; i += 6) {
      if (n % i === 0 || n % (i + 2) === 0) return false;
    }
    return true;
  },
  factorial: (n) => {
    if (n < 0) return null;
    if (n <= 1) return 1;
    return n * functions.factorial(n - 1);
  },
  matrixMultiply: (a, b) => {
    const rowsA = a.length, colsA = a[0].length;
    const colsB = b[0].length;
    const result = Array(rowsA).fill().map(() => Array(colsB).fill(0));
    for (let i = 0; i < rowsA; i++) {
      for (let j = 0; j < colsB; j++) {
        for (let k = 0; k < colsA; k++) {
          result[i][j] += a[i][k] * b[k][j];
        }
      }
    }
    return result;
  }
};

export default { manifest, init, activate, deactivate, hooks, functions };
