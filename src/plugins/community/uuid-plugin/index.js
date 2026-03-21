export const manifest = {
  name: 'uuid-plugin',
  id: 'uuid-plugin',
  version: '1.0.0',
  description: 'UUID generation and utilities',
  author: 'NEXUS',
  main: 'index.js',
  permissions: []
};

let api;
import crypto from 'crypto';

export async function init(context) {
  api = context;
  api.log('UUID plugin initialized');
}

export async function activate(context) {
  api.log('UUID plugin activated');
}

export function deactivate() {
  api.log('UUID plugin deactivated');
}

export const functions = {
  v1: () => crypto.randomUUID(),
  v4: () => crypto.randomUUID(),
  
  v3: (namespace, name) => {
    const hash = crypto.createHash('md5').update(namespace + name).digest();
    hash[6] = (hash[6] & 0x0f) | 0x30;
    hash[8] = (hash[8] & 0x3f) | 0x80;
    return formatUUID(hash);
  },
  
  v5: (namespace, name) => {
    const hash = crypto.createHash('sha1').update(namespace + name).digest();
    hash[6] = (hash[6] & 0x0f) | 0x50;
    hash[8] = (hash[8] & 0x3f) | 0x80;
    return formatUUID(hash);
  },

  validate: (uuid) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(uuid),

  version: (uuid) => parseInt(uuid[14], 16),

  parse: (uuid) => {
    if (!functions.validate(uuid)) return null;
    return {
      timeLow: uuid.slice(0, 8),
      timeMid: uuid.slice(9, 13),
      timeHiAndVersion: uuid.slice(14, 18),
      clockSeqHiAndReserved: uuid.slice(19, 21),
      clockSeqLo: uuid.slice(21, 23),
      node: uuid.slice(24, 36)
    };
  },

  extractTimestamp: (uuid) => {
    if (functions.version(uuid) !== 1) return null;
    const parsed = functions.parse(uuid);
    const time = parseInt(parsed.timeLow + parsed.timeMid + parsed.timeHiAndVersion.slice(0, 4), 16);
    return new Date((time - 122192928000000000) / 10000);
  },

  nil: () => '00000000-0000-0000-0000-000000000000',

  max: () => 'ffffffff-ffff-ffff-ffff-ffffffffffff',

  generateBatch: (count) => Array.from({ length: count }, () => functions.v4()),

  isValid: (uuid) => functions.validate(uuid),

  compare: (a, b) => a.localeCompare(b),

  sort: (uuids) => [...uuids].sort((a, b) => a.localeCompare(b)),

  dedupe: (uuids) => [...new Set(uuids)],

  fromString: (str) => {
    const hash = crypto.createHash('md5').update(str).digest();
    hash[6] = (hash[6] & 0x0f) | 0x30;
    hash[8] = (hash[8] & 0x3f) | 0x80;
    return formatUUID(hash);
  },

  toBuffer: (uuid) => {
    return Buffer.from(uuid.replace(/-/g, ''), 'hex');
  },

  fromBuffer: (buffer) => {
    const hex = buffer.toString('hex');
    return formatUUID(Buffer.from(hex));
  }
};

function formatUUID(buffer) {
  const hex = buffer.toString('hex');
  return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;
}

export default { manifest, init, activate, deactivate, functions };
