export const manifest = {
  name: 'token-plugin',
  id: 'token-plugin',
  version: '1.0.0',
  description: 'Token generation and management',
  author: 'NEXUS',
  main: 'index.js',
  permissions: []
};

let api;
import crypto from 'crypto';
const tokens = new Map();

export async function init(context) {
  api = context;
  api.log('Token plugin initialized');
}

export async function activate(context) {
  api.log('Token plugin activated');
}

export function deactivate() {
  api.log('Token plugin deactivated');
}

export const functions = {
  generate: (length = 32, type = 'alphanumeric') => {
    const charsets = {
      alphanumeric: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789',
      alpha: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz',
      numeric: '0123456789',
      hex: '0123456789abcdef',
      ascii: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*'
    };
    const chars = charsets[type] || charsets.alphanumeric;
    const bytes = crypto.randomBytes(length);
    let result = '';
    for (let i = 0; i < length; i++) result += chars[bytes[i] % chars.length];
    return result;
  },

  generateNumeric: (length = 6) => {
    let result = '';
    for (let i = 0; i < length; i++) result += crypto.randomInt(0, 10);
    return result;
  },

  generateAlphabetic: (length = 16) => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
    const bytes = crypto.randomBytes(length);
    return Array.from(bytes).map(b => chars[b % chars.length]).join('');
  },

  generateHex: (length = 32) => {
    return crypto.randomBytes(Math.ceil(length / 2)).toString('hex').slice(0, length);
  },

  generateUUID: () => crypto.randomUUID(),

  create: (data, options = {}) => {
    const { type = 'bearer', expiresIn = 3600, length = 64 } = options;
    const token = functions.generate(length);
    const tokenData = {
      token,
      type,
      data,
      createdAt: Date.now(),
      expiresAt: Date.now() + expiresIn * 1000,
      uses: 0,
      maxUses: options.maxUses || null
    };
    tokens.set(token, tokenData);
    return { token, expiresAt: new Date(tokenData.expiresAt).toISOString() };
  },

  verify: (token) => {
    const data = tokens.get(token);
    if (!data) return { valid: false, error: 'Token not found' };
    if (Date.now() > data.expiresAt) return { valid: false, error: 'Token expired' };
    if (data.maxUses && data.uses >= data.maxUses) return { valid: false, error: 'Token exhausted' };
    return { valid: true, data: data.data };
  },

  consume: (token) => {
    const data = tokens.get(token);
    if (!data) return { valid: false, error: 'Token not found' };
    if (Date.now() > data.expiresAt) return { valid: false, error: 'Token expired' };
    if (data.maxUses && data.uses >= data.maxUses) return { valid: false, error: 'Token exhausted' };
    data.uses++;
    return { valid: true, data: data.data, uses: data.uses };
  },

  revoke: (token) => {
    return tokens.delete(token);
  },

  revokeAll: () => {
    const count = tokens.size;
    tokens.clear();
    return { revoked: count };
  },

  cleanup: () => {
    let cleaned = 0;
    for (const [token, data] of tokens) {
      if (Date.now() > data.expiresAt) { tokens.delete(token); cleaned++; }
    }
    return { cleaned };
  },

  list: () => Array.from(tokens.entries()).map(([token, data]) => ({
    type: data.type,
    createdAt: data.createdAt,
    expiresAt: data.expiresAt,
    uses: data.uses,
    maxUses: data.maxUses
  })),

  expiry: (token) => {
    const data = tokens.get(token);
    return data ? new Date(data.expiresAt).toISOString() : null;
  },

  refresh: (token, newExpiry) => {
    const data = tokens.get(token);
    if (!data) return { valid: false };
    data.expiresAt = Date.now() + (newExpiry || 3600) * 1000;
    return { valid: true, expiresAt: new Date(data.expiresAt).toISOString() };
  }
};

export default { manifest, init, activate, deactivate, functions };
