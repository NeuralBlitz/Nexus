export const manifest = {
  name: 'format-plugin',
  id: 'format-plugin',
  version: '1.0.0',
  description: 'Data formatting utilities',
  author: 'NEXUS',
  main: 'index.js',
  permissions: []
};

let api;

export async function init(context) {
  api = context;
  api.log('Format plugin initialized');
}

export async function activate(context) {
  api.log('Format plugin activated');
}

export function deactivate() {
  api.log('Format plugin deactivated');
}

export const functions = {
  bytes: (bytes, decimals = 2) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(decimals)) + ' ' + sizes[i];
  },

  number: (num, options = {}) => {
    const { decimals = 0, decPoint = '.', thousandsSep = ',' } = options;
    const n = !isFinite(+num) ? 0 : +num;
    const s = (decimals ? n.toFixed(decimals) : Math.round(n).toString()).split('.');
    if (s[0].length > 3) {
      s[0] = s[0].replace(/\B(?=(?:\d{3})+(?!\d))/g, thousandsSep);
    }
    return s.join(decPoint);
  },

  currency: (amount, currency = 'USD', locale = 'en-US') => {
    return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(amount);
  },

  percent: (value, decimals = 2) => `${(value * 100).toFixed(decimals)}%`,

  phone: (num, country = 'US') => {
    const cleaned = ('' + num).replace(/\D/g, '');
    if (country === 'US') return cleaned.replace(/(\d{3})(\d{3})(\d{4})/, '($1) $2-$3');
    return cleaned;
  },

  creditCard: (num) => {
    const cleaned = ('' + num).replace(/\D/g, '');
    return cleaned.replace(/(\d{4})(?=\d)/g, '$1 ');
  },

  ssn: (num) => ('' + num).replace(/(\d{3})(?=\d)/g, '$1-'),

  date: (date, format = 'short') => {
    const d = new Date(date);
    const formats = {
      short: `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}`,
      long: d.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }),
      iso: d.toISOString().split('T')[0],
      time: d.toLocaleTimeString()
    };
    return formats[format] || formats.short;
  },

  time: (seconds, format = 'hm') => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (format === 'hm') return `${h}h ${m}m`;
    if (format === 'hms') return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    return `${m}m ${s}s`;
  },

  relative: (date) => {
    const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
    const diff = Date.now() - new Date(date).getTime();
    const diffSec = diff / 1000;
    if (Math.abs(diffSec) < 60) return rtf.format(Math.round(diffSec), 'second');
    if (Math.abs(diffSec) < 3600) return rtf.format(Math.round(diffSec / 60), 'minute');
    if (Math.abs(diffSec) < 86400) return rtf.format(Math.round(diffSec / 3600), 'hour');
    if (Math.abs(diffSec) < 2592000) return rtf.format(Math.round(diffSec / 86400), 'day');
    if (Math.abs(diffSec) < 31536000) return rtf.format(Math.round(diffSec / 2592000), 'month');
    return rtf.format(Math.round(diffSec / 31536000), 'year');
  },

  pluralize: (count, singular, plural) => count === 1 ? singular : plural,
  truncate: (str, length, suffix = '...') => str.length > length ? str.slice(0, length - suffix.length) + suffix : str,
  initials: (name) => name.split(' ').map(n => n[0]).join('').toUpperCase(),
  title: (str) => str.replace(/\w\S*/g, txt => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase()),
  camel: (str) => str.replace(/[-_\s]+(.)?/g, (_, c) => c ? c.toUpperCase() : ''),
  snake: (str) => str.replace(/([a-z])([A-Z])/g, '$1_$2').toLowerCase(),
  kebab: (str) => str.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase()
};

export default { manifest, init, activate, deactivate, functions };
