export const manifest = {
  name: 'url-plugin',
  id: 'url-plugin',
  version: '1.0.0',
  description: 'URL parsing and manipulation',
  author: 'NEXUS',
  main: 'index.js',
  permissions: []
};

let api;

export async function init(context) {
  api = context;
  api.log('URL plugin initialized');
}

export async function activate(context) {
  api.log('URL plugin activated');
}

export function deactivate() {
  api.log('URL plugin deactivated');
}

export const functions = {
  parse: (url) => {
    try {
      const parsed = new URL(url);
      return {
        href: parsed.href,
        protocol: parsed.protocol,
        host: parsed.host,
        hostname: parsed.hostname,
        port: parsed.port,
        pathname: parsed.pathname,
        search: parsed.search,
        hash: parsed.hash,
        username: parsed.username,
        password: parsed.password,
        origin: parsed.origin,
        params: Object.fromEntries(parsed.searchParams)
      };
    } catch (e) {
      return { error: e.message };
    }
  },

  build: (parts) => {
    const url = new URL(parts.origin || 'http://localhost');
    if (parts.pathname) url.pathname = parts.pathname;
    if (parts.host) url.host = parts.host;
    if (parts.protocol) url.protocol = parts.protocol;
    if (parts.hash) url.hash = parts.hash;
    Object.entries(parts.params || {}).forEach(([k, v]) => url.searchParams.set(k, v));
    return url.toString();
  },

  addParam: (url, key, value) => {
    const parsed = new URL(url);
    parsed.searchParams.set(key, value);
    return parsed.toString();
  },

  removeParam: (url, key) => {
    const parsed = new URL(url);
    parsed.searchParams.delete(key);
    return parsed.toString();
  },

  getParam: (url, key) => {
    const parsed = new URL(url);
    return parsed.searchParams.get(key);
  },

  encode: (text) => encodeURIComponent(text),
  decode: (text) => decodeURIComponent(text),
  encodeAll: (text) => encodeURI(text),
  decodeAll: (text) => decodeURI(text),

  shortify: (url) => {
    return { short: `https://nexus.link/${Math.random().toString(36).substr(2, 6)}`, original: url };
  },

  isValid: (url) => {
    try { new URL(url); return true; } catch { return false; }
  },

  getDomain: (url) => {
    try {
      const parsed = new URL(url);
      return parsed.hostname;
    } catch { return null; }
  },

  getTLD: (url) => {
    try {
      const parsed = new URL(url);
      const parts = parsed.hostname.split('.');
      return parts.length > 1 ? '.' + parts.slice(-1)[0] : parts[0];
    } catch { return null; }
  },

  isSecure: (url) => {
    try {
      const parsed = new URL(url);
      return parsed.protocol === 'https:';
    } catch { return false; }
  },

  slugify: (text) => {
    return text.toLowerCase()
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_-]+/g, '-')
      .replace(/^-+|-+$/g, '');
  },

  fingerprint: (url) => {
    const parsed = functions.parse(url);
    if (parsed.error) return null;
    const str = parsed.hostname + parsed.pathname;
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash) + str.charCodeAt(i);
      hash |= 0;
    }
    return Math.abs(hash).toString(36);
  }
};

export default { manifest, init, activate, deactivate, functions };
