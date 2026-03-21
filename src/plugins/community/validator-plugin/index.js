export const manifest = {
  name: 'validator-plugin',
  id: 'validator-plugin',
  version: '1.0.0',
  description: 'Data validation utilities',
  author: 'NEXUS',
  main: 'index.js',
  permissions: []
};

let api;

export async function init(context) {
  api = context;
  api.log('Validator plugin initialized');
}

export async function activate(context) {
  api.log('Validator plugin activated');
}

export function deactivate() {
  api.log('Validator plugin deactivated');
}

export const functions = {
  isEmail: (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email),

  isUrl: (url) => {
    try { new URL(url); return true; } catch { return false; }
  },

  isIp: (ip, version = 4) => {
    if (version === 4) return /^(\d{1,3}\.){3}\d{1,3}$/.test(ip) && ip.split('.').every(n => parseInt(n) <= 255);
    if (version === 6) return /^([0-9a-fA-F]{0,4}:){2,7}[0-9a-fA-F]{0,4}$/.test(ip);
    return false;
  },

  isPhone: (phone, country = 'US') => {
    const patterns = {
      US: /^\+?1?\s*\(?[2-9]\d{2}\)?[\s.-]?\d{3}[\s.-]?\d{4}$/,
      UK: /^\+?44\s?\d{4}\s?\d{6}$/,
      INT: /^\+?\d{1,3}[\s.-]?\d{4,14}$/
    };
    return (patterns[country] || patterns.INT).test(phone);
  },

  isPostalCode: (code, country = 'US') => {
    const patterns = {
      US: /^\d{5}(-\d{4})?$/,
      UK: /^[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}$/i,
      CA: /^[A-Z]\d[A-Z]\s*\d[A-Z]\d$/i
    };
    return (patterns[country] || /^\d+$/).test(code);
  },

  isCreditCard: (number) => {
    const digits = number.replace(/\D/g, '');
    if (!/^\d{13,19}$/.test(digits)) return false;
    let sum = 0, isEven = false;
    for (let i = digits.length - 1; i >= 0; i--) {
      let digit = parseInt(digits[i]);
      if (isEven) { digit *= 2; if (digit > 9) digit -= 9; }
      sum += digit;
      isEven = !isEven;
    }
    return sum % 10 === 0;
  },

  isHexColor: (color) => /^#?([0-9A-F]{3}|[0-9A-F]{6})$/i.test(color),

  isDate: (date) => !isNaN(Date.parse(date)),

  isJSON: (str) => {
    try { JSON.parse(str); return true; } catch { return false; }
  },

  isUUID: (uuid) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(uuid),

  isEmpty: (value) => value === null || value === undefined || value === '' || (Array.isArray(value) && value.length === 0),

  isAlpha: (str) => /^[a-zA-Z]+$/.test(str),
  isNumeric: (str) => /^\d+$/.test(str),
  isAlphaNumeric: (str) => /^[a-zA-Z0-9]+$/.test(str),

  isLength: (str, min, max) => {
    const len = str.length;
    return (!min || len >= min) && (!max || len <= max);
  },

  isIn: (value, array) => array.includes(value),

  isMatch: (str, pattern, flags = '') => new RegExp(pattern, flags).test(str),

  isStrongPassword: (password) => {
    const errors = [];
    if (password.length < 8) errors.push('min length 8');
    if (!/[A-Z]/.test(password)) errors.push('uppercase');
    if (!/[a-z]/.test(password)) errors.push('lowercase');
    if (!/\d/.test(password)) errors.push('number');
    if (!/[!@#$%^&*]/.test(password)) errors.push('special char');
    return { valid: errors.length === 0, errors };
  },

  validate: (data, rules) => {
    const errors = [];
    for (const [field, rule] of Object.entries(rules)) {
      const value = data[field];
      if (rule.required && functions.isEmpty(value)) errors.push(`${field} is required`);
      if (!functions.isEmpty(value)) {
        if (rule.type === 'email' && !functions.isEmail(value)) errors.push(`${field} must be email`);
        if (rule.type === 'url' && !functions.isUrl(value)) errors.push(`${field} must be URL`);
        if (rule.minLength && !functions.isLength(value, rule.minLength)) errors.push(`${field} min length ${rule.minLength}`);
        if (rule.maxLength && !functions.isLength(value, null, rule.maxLength)) errors.push(`${field} max length ${rule.maxLength}`);
        if (rule.enum && !functions.isIn(value, rule.enum)) errors.push(`${field} must be one of ${rule.enum.join(', ')}`);
        if (rule.pattern && !functions.isMatch(value, rule.pattern)) errors.push(`${field} invalid format`);
      }
    }
    return { valid: errors.length === 0, errors };
  }
};

export default { manifest, init, activate, deactivate, functions };
