export const manifest = {
  name: 'logger-plugin',
  id: 'logger-plugin',
  version: '1.0.0',
  description: 'Structured logging utilities',
  author: 'NEXUS',
  main: 'index.js',
  permissions: []
};

let api;
const logs = [];
const maxLogs = 10000;

export async function init(context) {
  api = context;
  api.log('Logger plugin initialized');
}

export async function activate(context) {
  api.log('Logger plugin activated');
}

export function deactivate() {
  api.log('Logger plugin deactivated');
}

const levels = { debug: 0, info: 1, warn: 2, error: 3, fatal: 4 };
const levelNames = Object.fromEntries(Object.entries(levels).map(([k, v]) => [v, k.toUpperCase()]));

function createLogEntry(level, message, meta = {}) {
  const entry = {
    id: `log_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    timestamp: new Date().toISOString(),
    level,
    levelName: levelNames[level],
    message,
    meta,
    source: 'plugin'
  };
  
  logs.unshift(entry);
  if (logs.length > maxLogs) logs.pop();
  
  return entry;
}

export const functions = {
  debug: (message, meta) => createLogEntry(levels.debug, message, meta),
  info: (message, meta) => createLogEntry(levels.info, message, meta),
  warn: (message, meta) => createLogEntry(levels.warn, message, meta),
  error: (message, meta) => createLogEntry(levels.error, message, meta),
  fatal: (message, meta) => createLogEntry(levels.fatal, message, meta),

  log: (level, message, meta) => {
    const lvl = levels[level] !== undefined ? levels[level] : levels.info;
    return createLogEntry(lvl, message, meta);
  },

  child: (meta) => ({ meta }),

  query: (filters = {}) => {
    let results = [...logs];
    
    if (filters.level) {
      const lvl = levels[filters.level];
      results = results.filter(l => l.level >= lvl);
    }
    if (filters.minLevel) {
      const lvl = levels[filters.minLevel];
      results = results.filter(l => l.level >= lvl);
    }
    if (filters.source) {
      results = results.filter(l => l.source === filters.source);
    }
    if (filters.startTime) {
      results = results.filter(l => new Date(l.timestamp) >= new Date(filters.startTime));
    }
    if (filters.endTime) {
      results = results.filter(l => new Date(l.timestamp) <= new Date(filters.endTime));
    }
    if (filters.search) {
      results = results.filter(l => l.message.includes(filters.search));
    }
    
    if (filters.limit) results = results.slice(0, filters.limit);
    return results;
  },

  stats: () => {
    const byLevel = {};
    for (const log of logs) {
      byLevel[log.levelName] = (byLevel[log.levelName] || 0) + 1;
    }
    return { total: logs.length, byLevel, oldest: logs[logs.length - 1]?.timestamp };
  },

  clear: () => { logs.length = 0; return { cleared: true }; },
  
  export: (format = 'json') => {
    if (format === 'json') return JSON.stringify(logs, null, 2);
    if (format === 'csv') {
      const headers = ['id', 'timestamp', 'level', 'message'];
      return [headers.join(','), ...logs.map(l => headers.map(h => l[h]).join(','))].join('\n');
    }
    return logs;
  },

  stream: (handler) => {
    const wrapped = (entry) => handler(entry);
    logs.forEach(wrapped);
    return { streaming: true, count: logs.length };
  }
};

export default { manifest, init, activate, deactivate, functions };
