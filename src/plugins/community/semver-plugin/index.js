export const manifest = {
  name: 'semver-plugin',
  id: 'semver-plugin',
  version: '1.0.0',
  description: 'Semantic versioning utilities',
  author: 'NEXUS',
  main: 'index.js',
  permissions: []
};

let api;

export async function init(context) {
  api = context;
  api.log('Semver plugin initialized');
}

export async function activate(context) {
  api.log('Semver plugin activated');
}

export function deactivate() {
  api.log('Semver plugin deactivated');
}

function parseVersion(str) {
  const match = str.match(/^(\d+)\.(\d+)\.(\d+)(?:-([a-zA-Z0-9.-]+))?(?:\+([a-zA-Z0-9.-]+))?$/);
  if (!match) return null;
  return {
    major: parseInt(match[1]),
    minor: parseInt(match[2]),
    patch: parseInt(match[3]),
    prerelease: match[4] || null,
    build: match[5] || null,
    raw: str
  };
}

function compare(a, b) {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

function comparePrerelease(a, b) {
  const aParts = a.split('.').map(v => isNaN(v) ? v : parseInt(v));
  const bParts = b.split('.').map(v => isNaN(v) ? v : parseInt(v));
  
  for (let i = 0; i < Math.max(aParts.length, bParts.length); i++) {
    const aPart = aParts[i], bPart = bParts[i];
    if (aPart === undefined) return 1;
    if (bPart === undefined) return -1;
    if (typeof aPart === 'number' && typeof bPart === 'number') {
      if (aPart < bPart) return -1;
      if (aPart > bPart) return 1;
    } else {
      const cmp = String(aPart).localeCompare(String(bPart));
      if (cmp !== 0) return cmp;
    }
  }
  return 0;
}

export const functions = {
  parse: (version) => parseVersion(version),

  valid: (version) => parseVersion(version) !== null,

  clean: (version) => {
    const parsed = parseVersion(version);
    if (!parsed) return null;
    return `${parsed.major}.${parsed.minor}.${parsed.patch}`;
  },

  compare: (v1, v2) => {
    const a = parseVersion(v1), b = parseVersion(v2);
    if (!a || !b) return null;
    
    if (a.major !== b.major) return compare(a.major, b.major);
    if (a.minor !== b.minor) return compare(a.minor, b.minor);
    if (a.patch !== b.patch) return compare(a.patch, b.patch);
    
    if (a.prerelease && !b.prerelease) return -1;
    if (!a.prerelease && b.prerelease) return 1;
    if (a.prerelease && b.prerelease) return comparePrerelease(a.prerelease, b.prerelease);
    
    return 0;
  },

  lt: (v1, v2) => functions.compare(v1, v2) === -1,
  lte: (v1, v2) => functions.compare(v1, v2) <= 0,
  gt: (v1, v2) => functions.compare(v1, v2) === 1,
  gte: (v1, v2) => functions.compare(v1, v2) >= 0,
  eq: (v1, v2) => functions.compare(v1, v2) === 0,
  neq: (v1, v2) => functions.compare(v1, v2) !== 0,

  inc: (version, release = 'patch', options = {}) => {
    const v = parseVersion(version);
    if (!v) return null;
    
    const { prerelease, build } = options;
    
    if (release === 'major') {
      v.major++; v.minor = 0; v.patch = 0;
    } else if (release === 'minor') {
      v.minor++; v.patch = 0;
    } else {
      v.patch++;
    }
    
    if (prerelease) v.prerelease = prerelease;
    if (build) v.build = build;
    
    let result = `${v.major}.${v.minor}.${v.patch}`;
    if (v.prerelease) result += `-${v.prerelease}`;
    if (v.build) result += `+${v.build}`;
    
    return result;
  },

  major: (version) => parseVersion(version)?.major ?? null,
  minor: (version) => parseVersion(version)?.minor ?? null,
  patch: (version) => parseVersion(version)?.patch ?? null,
  prerelease: (version) => parseVersion(version)?.prerelease ?? null,
  build: (version) => parseVersion(version)?.build ?? null,

  sort: (versions) => [...versions].sort((a, b) => functions.compare(a, b)),

  maxSatisfying: (versions, range) => {
    const sorted = functions.sort(versions);
    return sorted.find(v => functions.satisfies(v, range));
  },

  minSatisfying: (versions, range) => {
    const sorted = functions.sort(versions).reverse();
    return sorted.find(v => functions.satisfies(v, range));
  },

  satisfies: (version, range) => {
    const v = parseVersion(version);
    if (!v) return false;
    
    const ranges = range.split('||').map(r => r.trim());
    return ranges.some(range => {
      const match = range.match(/^(\d+)\.(\d+)\.(\d+)(?:-(.+))?$/);
      if (!match) return false;
      
      const [op, maj, min, pat, pre] = range.match(/([<>=~^]*)/).slice(-1).concat([maj, min, pat, pre]);
      const opMatch = range.match(/([<>=~^]+)/);
      const operator = opMatch ? opMatch[1] : '=';
      
      const vMaj = v.major, vMin = v.minor, vPat = v.patch;
      const rMaj = parseInt(maj), rMin = parseInt(min), rPat = parseInt(pat);
      
      if (operator === '^') {
        return vMaj === rMaj && (vMin > rMin || (vMin === rMin && vPat >= rPat));
      }
      if (operator === '~') {
        return vMaj === rMaj && vMin === rMin && vPat >= rPat;
      }
      if (operator === '>=') return vMaj > rMaj || (vMaj === rMaj && vMin > rMin) || (vMaj === rMaj && vMin === rMin && vPat >= rPat);
      if (operator === '>') return vMaj > rMaj || (vMaj === rMaj && vMin > rMin) || (vMaj === rMaj && vMin === rMin && vPat > rPat);
      if (operator === '<=') return vMaj < rMaj || (vMaj === rMaj && vMin < rMin) || (vMaj === rMaj && vMin === rMin && vPat <= rPat);
      if (operator === '<') return vMaj < rMaj || (vMaj === rMaj && vMin < rMin) || (vMaj === rMaj && vMin === rMin && vPat < rPat);
      return vMaj === rMaj && vMin === rMin && vPat === rPat;
    });
  },

  diff: (v1, v2) => {
    const a = parseVersion(v1), b = parseVersion(v2);
    if (!a || !b) return null;
    if (a.major !== b.major) return 'major';
    if (a.minor !== b.minor) return 'minor';
    if (a.patch !== b.patch) return 'patch';
    if (a.prerelease !== b.prerelease) return 'prerelease';
    return 'build';
  }
};

export default { manifest, init, activate, deactivate, functions };
