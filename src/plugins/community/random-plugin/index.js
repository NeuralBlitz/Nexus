export const manifest = {
  name: 'random-plugin',
  id: 'random-plugin',
  version: '1.0.0',
  description: 'Random number and data generation',
  author: 'NEXUS',
  main: 'index.js',
  permissions: []
};

let api;
import crypto from 'crypto';

export async function init(context) {
  api = context;
  api.log('Random plugin initialized');
}

export async function activate(context) {
  api.log('Random plugin activated');
}

export function deactivate() {
  api.log('Random plugin deactivated');
}

export const functions = {
  number: (min = 0, max = 100) => Math.floor(Math.random() * (max - min + 1)) + min,
  
  float: (min = 0, max = 1) => Math.random() * (max - min) + min,

  boolean: () => Math.random() < 0.5,

  choice: (array) => array[Math.floor(Math.random() * array.length)],

  sample: (array, count) => {
    const shuffled = [...array].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, count);
  },

  shuffle: (array) => [...array].sort(() => Math.random() - 0.5),

  uuid: () => crypto.randomUUID(),

  string: (length = 16, charset = 'alphanumeric') => {
    const charsets = {
      alphanumeric: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789',
      alpha: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz',
      numeric: '0123456789',
      hex: '0123456789abcdef',
      ascii: '!"#$%&\'()*+,-./:;<=>?@[\\]^_`{|}~'
    };
    const chars = charsets[charset] || charsets.alphanumeric;
    return Array.from({ length }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  },

  password: (length = 16) => {
    const lower = 'abcdefghijklmnopqrstuvwxyz';
    const upper = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const numbers = '0123456789';
    const symbols = '!@#$%^&*()_+-=[]{}|;:,.<>?';
    const all = lower + upper + numbers + symbols;
    return lower[Math.floor(Math.random() * lower.length)] +
           upper[Math.floor(Math.random() * upper.length)] +
           numbers[Math.floor(Math.random() * numbers.length)] +
           symbols[Math.floor(Math.random() * symbols.length)] +
           Array.from({ length: length - 4 }, () => all[Math.floor(Math.random() * all.length)]).join('');
  },

  color: (format = 'hex') => {
    const r = Math.floor(Math.random() * 256);
    const g = Math.floor(Math.random() * 256);
    const b = Math.floor(Math.random() * 256);
    if (format === 'hex') return '#' + [r, g, b].map(x => x.toString(16).padStart(2, '0')).join('');
    if (format === 'rgb') return `rgb(${r}, ${g}, ${b})`;
    if (format === 'hsl') {
      const max = Math.max(r, g, b) / 255, min = Math.min(r, g, b) / 255;
      const l = (max + min) / 2;
      let h, s;
      if (max === min) { h = s = 0; }
      else {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        switch (max) {
          case r / 255: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
          case g / 255: h = ((b - r) / d + 2) / 6; break;
          case b / 255: h = ((r - g) / d + 4) / 6; break;
        }
      }
      return `hsl(${Math.round(h * 360)}, ${Math.round(s * 100)}%, ${Math.round(l * 100)}%)`;
    }
    return { r, g, b };
  },

  date: (start = '1970-01-01', end = new Date().toISOString()) => {
    const s = new Date(start).getTime();
    const e = new Date(end).getTime();
    return new Date(s + Math.random() * (e - s)).toISOString();
  },

  ip: (type = 'ipv4') => {
    if (type === 'ipv4') return Array.from({ length: 4 }, () => Math.floor(Math.random() * 256)).join('.');
    if (type === 'ipv6') return Array.from({ length: 8 }, () => Math.floor(Math.random() * 65536).toString(16)).join(':');
    return null;
  },

  mac: () => Array.from({ length: 6 }, () => Math.floor(Math.random() * 256).toString(16).padStart(2, '0')).join(':'),

  phone: (format = 'us') => {
    if (format === 'us') return `+1 (${Math.floor(200 + Math.random() * 800)}) ${Math.floor(200 + Math.random() * 800)}-${Math.floor(1000 + Math.random() * 9000)}`;
    if (format === 'intl') return `+${Math.floor(1 + Math.random() * 99)} ${Math.floor(100 + Math.random() * 900)} ${Math.floor(100 + Math.random() * 900)} ${Math.floor(1000 + Math.random() * 9000)}`;
    return null;
  },

  latLng: () => ({ lat: (Math.random() * 180 - 90).toFixed(6), lng: (Math.random() * 360 - 180).toFixed(6) }),

  lorem: (paragraphs = 1, sentencesPerParagraph = 4) => {
    const words = 'lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod tempor incididunt ut labore et dolore magna aliqua'.split(' ');
    const generateSentence = () => {
      const count = 5 + Math.floor(Math.random() * 10);
      return Array.from({ length: count }, () => words[Math.floor(Math.random() * words.length)]).join(' ').replace(/^\w/, c => c.toUpperCase()) + '.';
    };
    return Array.from({ length: paragraphs }, () => Array.from({ length: sentencesPerParagraph }, generateSentence).join(' ')).join('\n\n');
  }
};

export default { manifest, init, activate, deactivate, functions };
