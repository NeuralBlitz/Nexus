export const manifest = {
  name: 'calculator-plugin',
  id: 'calculator-plugin',
  version: '1.0.0',
  description: 'General purpose calculator',
  author: 'NEXUS',
  main: 'index.js',
  permissions: []
};

let api;
const history = [];

export async function init(context) {
  api = context;
  api.log('Calculator plugin initialized');
}

export async function activate(context) {
  api.log('Calculator plugin activated');
}

export function deactivate() {
  api.log('Calculator plugin deactivated');
}

export const functions = {
  calculate: (expression) => {
    try {
      const sanitized = expression.replace(/[^0-9+\-*/().%\s]/g, '');
      const result = Function(`return (${sanitized})`)();
      
      const record = {
        expression,
        result,
        timestamp: Date.now()
      };
      
      history.unshift(record);
      if (history.length > 100) history.pop();
      
      return { expression, result, success: true };
    } catch (e) {
      return { expression, error: e.message, success: false };
    }
  },

  add: (a, b) => ({ operation: 'add', operands: [a, b], result: a + b }),
  subtract: (a, b) => ({ operation: 'subtract', operands: [a, b], result: a - b }),
  multiply: (a, b) => ({ operation: 'multiply', operands: [a, b], result: a * b }),
  divide: (a, b) => {
    if (b === 0) return { error: 'Division by zero' };
    return { operation: 'divide', operands: [a, b], result: a / b };
  },
  modulo: (a, b) => ({ operation: 'modulo', operands: [a, b], result: a % b }),
  power: (base, exp) => ({ operation: 'power', operands: [base, exp], result: Math.pow(base, exp) }),
  sqrt: (n) => ({ operation: 'sqrt', operand: n, result: Math.sqrt(n) }),
  log: (n, base = Math.E) => ({ operation: 'log', operand: n, base, result: Math.log(n) / Math.log(base) }),
  sin: (angle) => ({ operation: 'sin', operand: angle, result: Math.sin(angle * Math.PI / 180) }),
  cos: (angle) => ({ operation: 'cos', operand: angle, result: Math.cos(angle * Math.PI / 180) }),
  tan: (angle) => ({ operation: 'tan', operand: angle, result: Math.tan(angle * Math.PI / 180) }),
  percentage: (value, percent) => ({ operation: 'percentage', value, percent, result: (value * percent) / 100 }),

  getHistory: () => [...history],
  clearHistory: () => { history.length = 0; return { cleared: true }; },

  tip: (amount, percent = 15) => {
    const tipAmount = (amount * percent) / 100;
    return {
      amount,
      percent,
      tipAmount,
      total: amount + tipAmount
    };
  },

  compoundInterest: (principal, rate, timesCompounded, years) => {
    const result = principal * Math.pow(1 + rate / 100 / timesCompounded, timesCompounded * years);
    return {
      principal,
      rate,
      timesCompounded,
      years,
      finalAmount: result,
      interest: result - principal
    };
  },

  loanPayment: (principal, annualRate, years) => {
    const monthlyRate = annualRate / 100 / 12;
    const payments = years * 12;
    if (monthlyRate === 0) return { monthlyPayment: principal / payments, total: principal };
    const payment = principal * (monthlyRate * Math.pow(1 + monthlyRate, payments)) / (Math.pow(1 + monthlyRate, payments) - 1);
    return {
      principal,
      annualRate,
      years,
      monthlyPayment: payment,
      total: payment * payments
    };
  },

  discount: (originalPrice, discountPercent) => {
    const discountAmount = (originalPrice * discountPercent) / 100;
    return {
      originalPrice,
      discountPercent,
      discountAmount,
      finalPrice: originalPrice - discountAmount
    };
  },

  tipAndSplit: (amount, percent, people) => {
    const tipAmount = (amount * percent) / 100;
    const totalPerPerson = (amount + tipAmount) / people;
    return {
      amount,
      percent,
      people,
      tipAmount,
      totalPerPerson,
      total: amount + tipAmount
    };
  }
};

export default { manifest, init, activate, deactivate, functions };
