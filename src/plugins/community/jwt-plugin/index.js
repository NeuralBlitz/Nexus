export const manifest = {
  name: 'jwt-plugin',
  id: 'jwt-plugin',
  version: '1.0.0',
  description: 'JWT token generation and verification',
  author: 'NEXUS',
  main: 'index.js',
  permissions: []
};

let api;
import crypto from 'crypto';

export async function init(context) {
  api = context;
  api.log('JWT plugin initialized');
}

export async function activate(context) {
  api.log('JWT plugin activated');
}

export function deactivate() {
  api.log('JWT plugin deactivated');
}

function base64UrlEncode(str) {
  return Buffer.from(str).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

function base64UrlDecode(str) {
  str = str.replace(/-/g, '+').replace(/_/g, '/');
  while (str.length % 4) str += '=';
  return Buffer.from(str, 'base64').toString('utf8');
}

function createSignature(header, payload, secret, algorithm = 'HS256') {
  const alg = algorithm.toLowerCase();
  let key = secret;
  
  if (alg.startsWith('hs')) key = secret;
  else if (alg.startsWith('rs')) key = secret;
  
  const data = `${header}.${payload}`;
  const hmac = crypto.createHmac(alg.includes('512') ? 'sha512' : alg.includes('384') ? 'sha384' : 'sha256', key);
  hmac.update(data);
  return hmac.digest('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

export const functions = {
  encode: (payload, secret, options = {}) => {
    const { algorithm = 'HS256', expiresIn = '1h', issuer, subject } = options;
    
    const header = { alg: algorithm, typ: 'JWT' };
    const now = Math.floor(Date.now() / 1000);
    
    const fullPayload = {
      ...payload,
      iat: now,
      ...(exp => exp ? { exp: now + parseDuration(exp) } : {})(expiresIn),
      ...(issuer ? { iss: issuer } : {}),
      ...(subject ? { sub: subject } : {})
    };

    const encodedHeader = base64UrlEncode(JSON.stringify(header));
    const encodedPayload = base64UrlEncode(JSON.stringify(fullPayload));
    const signature = createSignature(encodedHeader, encodedPayload, secret, algorithm);

    return `${encodedHeader}.${encodedPayload}.${signature}`;
  },

  decode: (token) => {
    try {
      const [header, payload, signature] = token.split('.');
      return {
        header: JSON.parse(base64UrlDecode(header)),
        payload: JSON.parse(base64UrlDecode(payload)),
        signature
      };
    } catch (e) {
      return { error: e.message };
    }
  },

  verify: (token, secret, options = {}) => {
    const { algorithms = ['HS256'], issuer, subject, clockTolerance = 0 } = options;
    const decoded = functions.decode(token);
    
    if (decoded.error) return { valid: false, error: decoded.error };
    
    const { header, payload } = decoded;
    if (!algorithms.includes(header.alg)) return { valid: false, error: 'Unsupported algorithm' };
    if (issuer && payload.iss !== issuer) return { valid: false, error: 'Invalid issuer' };
    if (subject && payload.sub !== subject) return { valid: false, error: 'Invalid subject' };
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000) - clockTolerance) {
      return { valid: false, error: 'Token expired' };
    }
    
    return { valid: true, payload };
  },

  refresh: (token, secret, options = {}) => {
    const decoded = functions.decode(token);
    if (decoded.error) return { error: decoded.error };
    const { payload } = decoded;
    delete payload.exp;
    delete payload.iat;
    return functions.encode(payload, secret, options);
  },

  isExpired: (token) => {
    const decoded = functions.decode(token);
    if (decoded.error || !decoded.payload.exp) return null;
    return decoded.payload.exp < Math.floor(Date.now() / 1000);
  },

  getExpiry: (token) => {
    const decoded = functions.decode(token);
    if (decoded.error || !decoded.payload.exp) return null;
    return new Date(decoded.payload.exp * 1000).toISOString();
  },

  getIssuedAt: (token) => {
    const decoded = functions.decode(token);
    if (decoded.error || !decoded.payload.iat) return null;
    return new Date(decoded.payload.iat * 1000).toISOString();
  },

  sign: (payload, secret, algorithm = 'HS256') => {
    return functions.encode(payload, secret, { algorithm, expiresIn: null });
  }
};

function parseDuration(str) {
  const match = str.match(/^(\d+)([smhd])$/);
  if (!match) return 3600;
  const [, num, unit] = match;
  const multipliers = { s: 1, m: 60, h: 3600, d: 86400 };
  return parseInt(num) * (multipliers[unit] || 3600);
}

export default { manifest, init, activate, deactivate, functions };
