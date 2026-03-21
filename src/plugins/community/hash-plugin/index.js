export const manifest = {
  name: 'hash-plugin',
  id: 'hash-plugin',
  version: '1.0.0',
  description: 'Cryptographic hashing and encoding utilities',
  author: 'NEXUS',
  main: 'index.js',
  permissions: []
};

import crypto from 'crypto';

let api;

export async function init(context) {
  api = context;
  api.log('Hash plugin initialized');
}

export async function activate(context) {
  api.log('Hash plugin activated');
}

export function deactivate() {
  api.log('Hash plugin deactivated');
}

export const functions = {
  md5: (text) => crypto.createHash('md5').update(text).digest('hex'),
  sha1: (text) => crypto.createHash('sha1').update(text).digest('hex'),
  sha256: (text) => crypto.createHash('sha256').update(text).digest('hex'),
  sha512: (text) => crypto.createHash('sha512').update(text).digest('hex'),

  bcrypt: async (text, rounds = 10) => {
    try {
      const bcrypt = await import('bcryptjs');
      return bcrypt.hashSync(text, rounds);
    } catch { throw new Error('bcryptjs not installed'); }
  },

  verifyBcrypt: async (text, hash) => {
    try {
      const bcrypt = await import('bcryptjs');
      return bcrypt.compareSync(text, hash);
    } catch { throw new Error('bcryptjs not installed'); }
  },

  hmac: (text, secret, algorithm = 'sha256') => {
    return crypto.createHmac(algorithm, secret).update(text).digest('hex');
  },

  base64Encode: (text) => Buffer.from(text).toString('base64'),
  base64Decode: (text) => Buffer.from(text, 'base64').toString('utf8'),
  base64UrlEncode: (text) => Buffer.from(text).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, ''),
  base64UrlDecode: (text) => Buffer.from(text.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'),

  hexToBase64: (hex) => Buffer.from(hex, 'hex').toString('base64'),
  base64ToHex: (base64) => Buffer.from(base64, 'base64').toString('hex'),

  uuid: () => crypto.randomUUID(),
  uuidv1: async () => { const { v1 } = await import('uuid'); return v1(); },
  uuidv4: async () => { const { v4 } = await import('uuid'); return v4(); },

  crc32: (text) => {
    let crc = 0xFFFFFFFF;
    const table = [];
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
      table[n] = c;
    }
    for (let i = 0; i < text.length; i++) {
      crc = table[(crc ^ text.charCodeAt(i)) & 0xFF] ^ (crc >>> 8);
    }
    return (crc ^ 0xFFFFFFFF) >>> 0;
  },

  randomBytes: (length) => crypto.randomBytes(length).toString('hex'),
  randomString: (length, charset = 'alphanumeric') => {
    const charsets = {
      alphanumeric: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789',
      alpha: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz',
      numeric: '0123456789',
      hex: '0123456789abcdef'
    };
    const chars = charsets[charset] || charsets.alphanumeric;
    let result = '';
    const bytes = crypto.randomBytes(length);
    for (let i = 0; i < length; i++) {
      result += chars[bytes[i] % chars.length];
    }
    return result;
  },

  verifyHash: (text, hash, algorithm = 'sha256') => {
    const computed = functions[algorithm]?.(text);
    return computed === hash;
  }
};

export default { manifest, init, activate, deactivate, functions };
