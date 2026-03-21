export const manifest = {
  name: 'currency-plugin',
  id: 'currency-plugin',
  version: '1.0.0',
  description: 'Currency conversion and financial calculations',
  author: 'NEXUS',
  main: 'index.js',
  permissions: []
};

let api;
const rates = {
  USD: 1, EUR: 0.85, GBP: 0.73, JPY: 110.0, CAD: 1.25, AUD: 1.35,
  CHF: 0.92, CNY: 6.45, INR: 74.5, MXN: 20.0, BRL: 5.25, KRW: 1180
};

export async function init(context) {
  api = context;
  api.log('Currency plugin initialized');
}

export async function activate(context) {
  api.log('Currency plugin activated');
}

export function deactivate() {
  api.log('Currency plugin deactivated');
}

export const functions = {
  convert: (amount, from, to) => {
    const fromRate = rates[from.toUpperCase()] || 1;
    const toRate = rates[to.toUpperCase()] || 1;
    const result = amount * (toRate / fromRate);
    return {
      amount,
      from: from.toUpperCase(),
      to: to.toUpperCase(),
      result: Math.round(result * 100) / 100,
      rate: toRate / fromRate,
      timestamp: Date.now()
    };
  },

  getRate: (from, to) => {
    const fromRate = rates[from.toUpperCase()] || 1;
    const toRate = rates[to.toUpperCase()] || 1;
    return { from: from.toUpperCase(), to: to.toUpperCase(), rate: toRate / fromRate };
  },

  listCurrencies: () => Object.keys(rates),

  updateRate: (currency, rate) => {
    rates[currency.toUpperCase()] = rate;
    return { currency: currency.toUpperCase(), rate };
  },

  format: (amount, currency, options = {}) => {
    const locale = options.locale || 'en-US';
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: currency
    }).format(amount);
  },

  parse: (str) => {
    const match = str.match(/([\d,.]+)\s*([A-Z]{3})/);
    if (match) {
      return { amount: parseFloat(match[1].replace(/,/g, '')), currency: match[2] };
    }
    return null;
  }
};

export default { manifest, init, activate, deactivate, functions };
