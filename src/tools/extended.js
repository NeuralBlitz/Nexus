import { EventEmitter } from 'events';

// ═══════════════════════════════════════════════════════════════════════════
// HTTP TOOL - Make HTTP requests with retry and caching
// ═══════════════════════════════════════════════════════════════════════════

export class HTTPTool extends EventEmitter {
  constructor(options = {}) {
    super();
    this.timeout = options.timeout || 30000;
    this.maxRetries = options.maxRetries || 2;
    this.defaultHeaders = options.headers || {};
  }

  async request(url, options = {}) {
    const method = options.method || 'GET';
    const headers = { ...this.defaultHeaders, ...options.headers };
    const body = options.body ? (typeof options.body === 'string' ? options.body : JSON.stringify(options.body)) : undefined;

    let lastError;
    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        const response = await fetch(url, {
          method,
          headers,
          body,
          signal: AbortSignal.timeout(this.timeout)
        });

        const contentType = response.headers.get('content-type') || '';
        const data = contentType.includes('application/json') ? await response.json() : await response.text();

        this.emit('request:complete', { url, method, status: response.status, attempt });
        return {
          status: response.status,
          ok: response.ok,
          headers: Object.fromEntries(response.headers.entries()),
          data
        };
      } catch (error) {
        lastError = error;
        if (attempt < this.maxRetries) await new Promise(r => setTimeout(r, 1000 * attempt));
      }
    }
    throw lastError;
  }

  async get(url, options = {}) { return this.request(url, { ...options, method: 'GET' }); }
  async post(url, body, options = {}) { return this.request(url, { ...options, method: 'POST', body }); }
  async put(url, body, options = {}) { return this.request(url, { ...options, method: 'PUT', body }); }
  async patch(url, body, options = {}) { return this.request(url, { ...options, method: 'PATCH', body }); }
  async delete(url, options = {}) { return this.request(url, { ...options, method: 'DELETE' }); }
}

// ═══════════════════════════════════════════════════════════════════════════
// DATA CONVERSION TOOL - Convert between formats
// ═══════════════════════════════════════════════════════════════════════════

export class DataConverter {
  static toJSON(data, pretty = false) {
    return JSON.stringify(data, null, pretty ? 2 : 0);
  }

  static fromJSON(str) {
    return JSON.parse(str);
  }

  static toCSV(data, headers = null) {
    if (!Array.isArray(data) || data.length === 0) return '';
    const cols = headers || Object.keys(data[0]);
    const rows = data.map(row => cols.map(col => {
      const val = row[col] ?? '';
      const str = String(val);
      return str.includes(',') || str.includes('"') || str.includes('\n')
        ? `"${str.replace(/"/g, '""')}"`
        : str;
    }).join(','));
    return [cols.join(','), ...rows].join('\n');
  }

  static fromCSV(csv) {
    const lines = csv.trim().split('\n');
    if (lines.length < 2) return [];
    const headers = lines[0].split(',').map(h => h.trim());
    return lines.slice(1).map(line => {
      const values = line.match(/(".*?"|[^,]+)/g) || [];
      const obj = {};
      headers.forEach((h, i) => {
        let val = (values[i] || '').trim();
        if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1).replace(/""/g, '"');
        obj[h] = val;
      });
      return obj;
    });
  }

  static toYAML(data, indent = 0) {
    if (data === null || data === undefined) return 'null';
    if (typeof data !== 'object') return String(data);
    if (Array.isArray(data)) {
      return data.map(item => `${'  '.repeat(indent)}- ${this.toYAML(item, indent + 1).trimStart()}`).join('\n');
    }
    return Object.entries(data).map(([k, v]) => {
      if (typeof v === 'object' && v !== null) {
        return `${'  '.repeat(indent)}${k}:\n${this.toYAML(v, indent + 1)}`;
      }
      return `${'  '.repeat(indent)}${k}: ${this.toYAML(v, indent)}`;
    }).join('\n');
  }

  static toXML(data, rootName = 'root') {
    const convert = (obj, name) => {
      if (obj === null || obj === undefined) return `<${name}/>`;
      if (typeof obj !== 'object') return `<${name}>${obj}</${name}>`;
      if (Array.isArray(obj)) return obj.map(item => convert(item, name)).join('\n');
      const inner = Object.entries(obj).map(([k, v]) => convert(v, k)).join('\n');
      return `<${name}>\n${inner}\n</${name}>`;
    };
    return `<?xml version="1.0" encoding="UTF-8"?>\n${convert(data, rootName)}`;
  }

  static flattenObject(obj, prefix = '') {
    const result = {};
    for (const [key, value] of Object.entries(obj)) {
      const fullKey = prefix ? `${prefix}.${key}` : key;
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        Object.assign(result, this.flattenObject(value, fullKey));
      } else {
        result[fullKey] = value;
      }
    }
    return result;
  }

  static unflattenObject(obj) {
    const result = {};
    for (const [key, value] of Object.entries(obj)) {
      const parts = key.split('.');
      let current = result;
      for (let i = 0; i < parts.length - 1; i++) {
        if (!current[parts[i]]) current[parts[i]] = {};
        current = current[parts[i]];
      }
      current[parts[parts.length - 1]] = value;
    }
    return result;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// TEMPLATE TOOL - String templating
// ═══════════════════════════════════════════════════════════════════════════

export class TemplateTool {
  static render(template, variables) {
    return template.replace(/\{\{(\w+(?:\.\w+)*)\}\}/g, (match, path) => {
      const value = path.split('.').reduce((obj, key) => obj?.[key], variables);
      return value !== undefined ? String(value) : match;
    });
  }

  static renderConditional(template, variables) {
    let result = template;
    // Handle {{#if var}}...{{/if}}
    result = result.replace(/\{\{#if (\w+)\}\}([\s\S]*?)\{\{\/if\}\}/g, (_, varName, content) => {
      return variables[varName] ? content : '';
    });
    // Handle {{#each var}}...{{/each}}
    result = result.replace(/\{\{#each (\w+)\}\}([\s\S]*?)\{\{\/each\}\}/g, (_, varName, content) => {
      const arr = variables[varName];
      if (!Array.isArray(arr)) return '';
      return arr.map((item, i) => {
        return content.replace(/\{\{this\}\}/g, item).replace(/\{\{@index\}\}/g, i);
      }).join('');
    });
    return this.render(result, variables);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// SEARCH TOOL - Full-text search
// ═══════════════════════════════════════════════════════════════════════════

export class SearchTool {
  constructor() {
    this.indexes = new Map();
  }

  createIndex(name, options = {}) {
    const index = {
      name,
      documents: [],
      invertedIndex: new Map(),
      textField: options.textField || 'text',
      idField: options.idField || 'id'
    };
    this.indexes.set(name, index);
    return index;
  }

  addDocument(indexName, doc) {
    const index = this.indexes.get(indexName);
    if (!index) throw new Error(`Index not found: ${indexName}`);

    const id = doc[index.idField];
    const text = (doc[index.textField] || '').toLowerCase();
    const words = text.replace(/[^\w\s]/g, '').split(/\s+/).filter(w => w.length > 2);

    index.documents.push(doc);
    for (const word of words) {
      if (!index.invertedIndex.has(word)) index.invertedIndex.set(word, new Set());
      index.invertedIndex.get(word).add(id);
    }
  }

  search(indexName, query, options = {}) {
    const index = this.indexes.get(indexName);
    if (!index) throw new Error(`Index not found: ${indexName}`);

    const queryWords = query.toLowerCase().replace(/[^\w\s]/g, '').split(/\s+/).filter(w => w.length > 2);
    const scores = new Map();

    for (const word of queryWords) {
      const matches = index.invertedIndex.get(word);
      if (matches) {
        for (const id of matches) {
          scores.set(id, (scores.get(id) || 0) + 1);
        }
      }
    }

    return Array.from(scores.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, options.limit || 10)
      .map(([id, score]) => ({ id, score, document: index.documents.find(d => d[index.idField] === id) }));
  }
}

let httpTool = null;

export function getHTTPTool(options) {
  if (!httpTool) httpTool = new HTTPTool(options);
  return httpTool;
}

export default {
  HTTPTool,
  DataConverter,
  TemplateTool,
  SearchTool,
  getHTTPTool
};
