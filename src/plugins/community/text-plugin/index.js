export const manifest = {
  name: 'text-plugin',
  id: 'text-plugin',
  version: '1.0.0',
  description: 'Text processing and manipulation utilities',
  author: 'NEXUS',
  main: 'index.js',
  permissions: []
};

let api;

export async function init(context) {
  api = context;
  api.log('Text plugin initialized');
}

export async function activate(context) {
  api.log('Text plugin activated');
}

export function deactivate() {
  api.log('Text plugin deactivated');
}

export const functions = {
  slugify: (text) => text.toLowerCase().replace(/[^\w\s-]/g, '').replace(/[\s_-]+/g, '-').replace(/^-+|-+$/g, ''),

  camelCase: (text) => text.replace(/[-_\s]+(.)?/g, (_, c) => c ? c.toUpperCase() : ''),

  snakeCase: (text) => text.replace(/([a-z])([A-Z])/g, '$1_$2').replace(/[\s-]+/g, '_').toLowerCase(),

  kebabCase: (text) => text.replace(/([a-z])([A-Z])/g, '$1-$2').replace(/[\s_]+/g, '-').toLowerCase(),

  titleCase: (text) => text.replace(/\w\S*/g, (txt) => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase()),

  capitalize: (text) => text.charAt(0).toUpperCase() + text.slice(1).toLowerCase(),

  upperCase: (text) => text.toUpperCase(),
  lowerCase: (text) => text.toLowerCase(),

  reverse: (text) => text.split('').reverse().join(''),

  truncate: (text, length, suffix = '...') => text.length > length ? text.slice(0, length - suffix.length) + suffix : text,

  trim: (text) => text.trim(),
  trimStart: (text) => text.trimStart(),
  trimEnd: (text) => text.trimEnd(),

  pad: (text, length, char = ' ', position = 'both') => {
    const padding = char.repeat(Math.max(0, length - text.length));
    if (position === 'left') return padding + text;
    if (position === 'right') return text + padding;
    return padding.slice(0, Math.floor(padding.length / 2)) + text + padding.slice(Math.floor(padding.length / 2));
  },

  repeat: (text, count) => text.repeat(count),

  wordCount: (text) => text.split(/\s+/).filter(w => w).length,
  charCount: (text) => text.length,

  extract: (text, pattern) => {
    const regex = new RegExp(pattern, 'g');
    const matches = [];
    let match;
    while ((match = regex.exec(text)) !== null) matches.push(match[0]);
    return matches;
  },

  replaceAll: (text, search, replace) => text.split(search).join(replace),

  contains: (text, search, caseSensitive = true) => caseSensitive ? text.includes(search) : text.toLowerCase().includes(search.toLowerCase()),

  startsWith: (text, search, caseSensitive = true) => {
    if (!caseSensitive) { text = text.toLowerCase(); search = search.toLowerCase(); }
    return text.startsWith(search);
  },

  endsWith: (text, search, caseSensitive = true) => {
    if (!caseSensitive) { text = text.toLowerCase(); search = search.toLowerCase(); }
    return text.endsWith(search);
  },

  unique: (text) => [...new Set(text.split('')].join('')),

  escapeHtml: (text) => text.replace(/[&<>"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m])),

  unescapeHtml: (text) => text.replace(/&(amp|lt|gt|quot|#39);/g, (m) => ({ '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'" }[m])),

  escapeRegex: (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),

  levenshtein: (a, b) => {
    const matrix = [];
    for (let i = 0; i <= b.length; i++) matrix[i] = [i];
    for (let j = 0; j <= a.length; j++) matrix[0][j] = j;
    for (let i = 1; i <= b.length; i++) {
      for (let j = 1; j <= a.length; j++) {
        if (b[i-1] === a[j-1]) matrix[i][j] = matrix[i-1][j-1];
        else matrix[i][j] = Math.min(matrix[i-1][j-1], matrix[i][j-1], matrix[i-1][j]) + 1;
      }
    }
    return matrix[b.length][a.length];
  },

  similarity: (a, b) => {
    const dist = functions.levenshtein(a, b);
    const maxLen = Math.max(a.length, b.length);
    return maxLen === 0 ? 1 : (1 - dist / maxLen);
  },

  extractUrls: (text) => {
    const regex = /https?:\/\/[^\s]+/g;
    return text.match(regex) || [];
  },

  extractEmails: (text) => {
    const regex = /[\w.-]+@[\w.-]+\.\w+/g;
    return text.match(regex) || [];
  },

  extractHashtags: (text) => {
    const regex = /#\w+/g;
    return text.match(regex) || [];
  },

  extractMentions: (text) => {
    const regex = /@\w+/g;
    return text.match(regex) || [];
  },

  anonymize: (text) => {
    return text.replace(/\d{3}[-.\s]?\d{3}[-.\s]?\d{4}/g, '(XXX) XXX-XXXX')
               .replace(/\d{3}[-.\s]?\d{2}[-.\s]?\d{4}/g, 'XX-XXXX-XXXX')
               .replace(/[\w.-]+@[\w.-]+\.\w+/g, '[EMAIL REDACTED]');
  }
};

export default { manifest, init, activate, deactivate, functions };
