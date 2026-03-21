export const manifest = {
  name: 'compression-plugin',
  id: 'compression-plugin',
  version: '1.0.0',
  description: 'Data compression utilities',
  author: 'NEXUS',
  main: 'index.js',
  permissions: []
};

let api;
import zlib from 'zlib';

export async function init(context) {
  api = context;
  api.log('Compression plugin initialized');
}

export async function activate(context) {
  api.log('Compression plugin activated');
}

export function deactivate() {
  api.log('Compression plugin deactivated');
}

export const functions = {
  gzip: async (data, options = {}) => {
    const { level = 6 } = options;
    const buffer = Buffer.isBuffer(data) ? data : Buffer.from(data);
    return zlib.gzipSync(buffer, { level });
  },

  gunzip: async (data) => {
    const buffer = Buffer.isBuffer(data) ? data : Buffer.from(data, 'base64');
    return zlib.gunzipSync(buffer);
  },

  deflate: async (data, options = {}) => {
    const { level = 6 } = options;
    const buffer = Buffer.isBuffer(data) ? data : Buffer.from(data);
    return zlib.deflateSync(buffer, { level });
  },

  inflate: async (data) => {
    const buffer = Buffer.isBuffer(data) ? data : Buffer.from(data, 'base64');
    return zlib.inflateSync(buffer);
  },

  brotli: async (data, options = {}) => {
    const { level = 6, mode = 0 } = options;
    const buffer = Buffer.isBuffer(data) ? data : Buffer.from(data);
    return zlib.brotliCompressSync(buffer, { params: { [zlib.constants.BROTLI_PARAM_MODE]: mode, [zlib.constants.BROTLI_PARAM_QUALITY]: level } });
  },

  debrotli: async (data) => {
    const buffer = Buffer.isBuffer(data) ? data : Buffer.from(data, 'base64');
    return zlib.brotliDecompressSync(buffer);
  },

  toBase64: (buffer) => Buffer.isBuffer(buffer) ? buffer.toString('base64') : buffer,

  fromBase64: (base64) => Buffer.from(base64, 'base64'),

  compressRatio: (original, compressed) => {
    const origSize = Buffer.isBuffer(original) ? original.length : Buffer.from(original).length;
    const compSize = Buffer.isBuffer(compressed) ? compressed.length : compressed.length;
    return {
      original: origSize,
      compressed: compSize,
      ratio: ((1 - compSize / origSize) * 100).toFixed(2) + '%',
      savings: origSize - compSize
    };
  },

  encodeHex: (buffer) => Buffer.isBuffer(buffer) ? buffer.toString('hex') : buffer,

  decodeHex: (hex) => Buffer.from(hex, 'hex'),

  encodeBase32: (buffer) => {
    const buf = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
    let result = '';
    for (let i = 0; i < buf.length; i += 5) {
      const group = buf.slice(i, i + 5);
      let bits = 0, padding = 0;
      const bytes = [];
      for (const byte of group) {
        bits = (bits << 8) | byte;
        bytes.push((bits >> (40 - bytes.length * 8)) & 0xff);
      }
      for (let j = 0; j < 8; j++) {
        if (i + j >= buf.length) { padding++; result += '='; }
        else result += alphabet[(bytes[Math.floor(j * 5 / 8)] >> (8 - (j * 5) % 8 - 5)) & 0x1f];
      }
    }
    return result;
  },

  encodeBase58: (buffer) => {
    const buf = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);
    const alphabet = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
    const digits = [0];
    for (const byte of buf) {
      let carry = byte;
      for (let i = 0; i < digits.length; i++) {
        carry += digits[i] * 256;
        digits[i] = carry % 58;
        carry = Math.floor(carry / 58);
      }
      while (carry > 0) { digits.unshift(carry % 58); carry = Math.floor(carry / 58); }
    }
    let result = '';
    let i = 0;
    while (i < buf.length && buf[i] === 0) { result += alphabet[0]; i++; }
    for (const d of digits) result += alphabet[d];
    return result;
  },

  minify: (data, type = 'json') => {
    if (type === 'json') return JSON.stringify(JSON.parse(data));
    if (type === 'js') return data.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/g, '').replace(/\s+/g, ' ').replace(/\s*([{};,:])\s*/g, '$1').trim();
    if (type === 'css') return data.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\s+/g, ' ').replace(/\s*([{};,:])\s*/g, '$1').trim();
    return data;
  },

  compressString: async (str, algorithm = 'gzip') => {
    const buffer = Buffer.from(str);
    switch (algorithm) {
      case 'gzip': return functions.gzip(buffer);
      case 'deflate': return functions.deflate(buffer);
      case 'brotli': return functions.brotli(buffer);
      default: return functions.gzip(buffer);
    }
  },

  decompressString: async (buffer, algorithm = 'gzip') => {
    switch (algorithm) {
      case 'gzip': return (await functions.gunzip(buffer)).toString('utf8');
      case 'deflate': return (await functions.inflate(buffer)).toString('utf8');
      case 'brotli': return (await functions.debrotli(buffer)).toString('utf8');
      default: return (await functions.gunzip(buffer)).toString('utf8');
    }
  }
};

export default { manifest, init, activate, deactivate, functions };
