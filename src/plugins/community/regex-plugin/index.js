export const manifest = {
  name: 'regex-plugin',
  id: 'regex-plugin',
  version: '1.0.0',
  description: 'Regex pattern matching and extraction',
  author: 'NEXUS',
  main: 'index.js',
  permissions: []
};

let api;

export async function init(context) {
  api = context;
  api.log('Regex plugin initialized');
}

export async function activate(context) {
  api.log('Regex plugin activated');
}

export function deactivate() {
  api.log('Regex plugin deactivated');
}

const patterns = {
  email: /[\w.-]+@[\w.-]+\.\w+/g,
  url: /https?:\/\/[^\s]+/g,
  phone: /\+?\d{1,3}[-.\s]?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g,
  ip: /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g,
  ipv6: /\b([0-9a-fA-F]{1,4}:){2,7}[0-9a-fA-F]{1,4}\b/g,
  date: /\d{4}[-/]\d{2}[-/]\d{2}/g,
  time: /\d{2}:\d{2}(:\d{2})?(\s*(AM|PM))?/gi,
  datetime: /\d{4}[-/]\d{2}[-/]\d{2}[T\s]\d{2}:\d{2}:\d{2}/g,
  hex: /#?([0-9a-fA-F]{3}|[0-9a-fA-F]{6})\b/g,
  rgb: /rgb\s*\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*\)/g,
  hashtag: /#\w+/g,
  mention: /@\w+/g,
  uuid: /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi,
  creditCard: /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g,
  zipCode: /\b\d{5}(-\d{4})?\b/g,
  ssn: /\b\d{3}-\d{2}-\d{4}\b/g,
  macAddress: /\b([0-9A-Fa-f]{2}[:-]){5}[0-9A-Fa-f]{2}\b/g,
  slug: /\b[a-z0-9]+(?:-[a-z0-9]+)*\b/g,
  htmlTag: /<\/?[\w\s="/.:'-]+>/g,
  htmlComment: /<!--[\s\S]*?-->/g,
  cssSelector: /[.#]?[\w-]+(?:\[[\w-]+(?:="[^"]*")?\])?(?::[\w-]+(?:\([^)]*\))?)*/g
};

export const functions = {
  match: (text, pattern, flags = 'g') => {
    try {
      const regex = pattern instanceof RegExp ? pattern : new RegExp(pattern, flags);
      return text.match(regex);
    } catch { return null; }
  },

  test: (text, pattern, flags = '') => {
    try {
      const regex = pattern instanceof RegExp ? pattern : new RegExp(pattern, flags);
      return regex.test(text);
    } catch { return false; }
  },

  extract: (text, pattern, flags = 'g') => {
    return functions.match(text, pattern, flags) || [];
  },

  replace: (text, pattern, replacement, flags = 'g') => {
    try {
      const regex = pattern instanceof RegExp ? pattern : new RegExp(pattern, flags);
      return text.replace(regex, replacement);
    } catch { return text; }
  },

  split: (text, pattern, flags = '') => {
    try {
      const regex = pattern instanceof RegExp ? pattern : new RegExp(pattern, flags);
      return text.split(regex);
    } catch { return [text]; }
  },

  findNamedGroups: (text, pattern) => {
    try {
      const regex = pattern instanceof RegExp ? pattern : new RegExp(pattern);
      const match = text.match(regex);
      if (match?.groups) return match.groups;
      return null;
    } catch { return null; }
  },

  extractEmails: (text) => text.match(patterns.email) || [],
  extractUrls: (text) => text.match(patterns.url) || [],
  extractPhones: (text) => text.match(patterns.phone) || [],
  extractIPs: (text) => text.match(patterns.ip) || [],
  extractDates: (text) => text.match(patterns.date) || [],
  extractTimes: (text) => text.match(patterns.time) || [],
  extractHashtags: (text) => text.match(patterns.hashtag) || [],
  extractMentions: (text) => text.match(patterns.mention) || [],
  extractUUIDs: (text) => text.match(patterns.uuid) || [],
  extractHexColors: (text) => text.match(patterns.hex) || [],
  extractCreditCards: (text) => text.match(patterns.creditCard) || [],
  extractHtmlTags: (text) => text.match(patterns.htmlTag) || [],

  removeHtmlTags: (text) => text.replace(patterns.htmlTag, ''),
  removeExtraSpaces: (text) => text.replace(/\s+/g, ' ').trim(),
  removeSpecialChars: (text, keep = '') => text.replace(new RegExp(`[^a-zA-Z0-9${keep}]`, 'g'), ''),

  validateEmail: (email) => patterns.email.test(email),
  validateUrl: (url) => {
    try { new URL(url); return true; } catch { return false; }
  },
  validatePhone: (phone) => patterns.phone.test(phone),
  validateIP: (ip) => patterns.ip.test(ip),

  escape: (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
  unescape: (text) => text.replace(/\\([.*+?^${}()|[\]\\])/g, '$1'),

  isMatch: (text, pattern, flags = '') => functions.test(text, pattern, flags),

  getPatterns: () => Object.keys(patterns),
  getPattern: (name) => patterns[name]?.source || null,

  template: (template, data) => {
    return template.replace(/\{\{(\w+)\}\}/g, (_, key) => data[key] ?? '');
  },

  wildcardToRegex: (pattern) => {
    const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&');
    return new RegExp('^' + escaped.replace(/\*/g, '.*').replace(/\?/g, '.') + '$');
  }
};

export default { manifest, init, activate, deactivate, functions };
