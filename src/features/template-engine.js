import { EventEmitter } from 'events';
import crypto from 'crypto';
import { Readable, Transform, pipeline } from 'stream';
import { createGzip, createGunzip } from 'zlib';

export class Template {
  constructor(content, variables = {}) {
    this.content = content;
    this.variables = variables;
  }

  render(data = {}) {
    const merged = { ...this.variables, ...data };
    let result = this.content;

    for (const [key, value] of Object.entries(merged)) {
      const regex = new RegExp(`{{\\s*${key}\\s*}}`, 'g');
      result = result.replace(regex, String(value));
    }

    result = result.replace(/\{\{[^}]+\}\}/g, '');

    return result;
  }
}

export class TemplateEngine extends EventEmitter {
  constructor(options = {}) {
    super();

    this.templates = new Map();
    this.helpers = new Map();
    this.filters = new Map();

    this.defaultDelimiter = options.delimiter || '{{';
    this.endDelimiter = options.endDelimiter || '}}';
    this.autoEscape = options.autoEscape !== false;

    this.registerDefaultHelpers();
    this.registerDefaultFilters();
  }

  registerDefaultHelpers() {
    this.registerHelper('if', (condition, options) => {
      return condition ? options.fn(this) : options.inverse(this);
    });

    this.registerHelper('unless', (condition, options) => {
      return condition ? options.inverse(this) : options.fn(this);
    });

    this.registerHelper('each', (items, options) => {
      let result = '';
      for (const item of items) {
        result += options.fn(item);
      }
      return result;
    });

    this.registerHelper('with', (context, options) => {
      return options.fn(context);
    });

    this.registerHelper('partial', (name, data) => {
      const partial = this.templates.get(name);
      if (!partial) return '';
      return partial.render(data);
    });
  }

  registerDefaultFilters() {
    this.registerFilter('uppercase', (str) => String(str).toUpperCase());
    this.registerFilter('lowercase', (str) => String(str).toLowerCase());
    this.registerFilter('capitalize', (str) => String(str).charAt(0).toUpperCase() + String(str).slice(1));
    this.registerFilter('trim', (str) => String(str).trim());
    this.registerFilter('json', (obj) => JSON.stringify(obj));
    this.registerFilter('length', (arr) => Array.isArray(arr) ? arr.length : String(arr).length);
    this.registerFilter('default', (value, defaultValue) => value || defaultValue);
    this.registerFilter('truncate', (str, length = 50) => {
      str = String(str);
      return str.length > length ? str.slice(0, length) + '...' : str;
    });
  }

  registerHelper(name, fn) {
    this.helpers.set(name, fn);
  }

  registerFilter(name, fn) {
    this.filters.set(name, fn);
  }

  createTemplate(content) {
    return new Template(content, {});
  }

  addTemplate(name, content) {
    const template = this.createTemplate(content);
    this.templates.set(name, template);
    this.emit('template:added', { name });
    return template;
  }

  getTemplate(name) {
    return this.templates.get(name);
  }

  render(templateName, data = {}) {
    const template = this.templates.get(templateName);
    if (!template) {
      throw new Error(`Template not found: ${templateName}`);
    }
    return template.render(data);
  }

  renderString(content, data = {}) {
    const template = this.createTemplate(content);
    return template.render(data);
  }

  compile(content) {
    const template = this.createTemplate(content);
    return (data) => template.render(data);
  }

  listTemplates() {
    return Array.from(this.templates.keys());
  }

  removeTemplate(name) {
    const deleted = this.templates.delete(name);
    if (deleted) {
      this.emit('template:removed', { name });
    }
    return deleted;
  }
}

export class DataExporter extends EventEmitter {
  constructor(options = {}) {
    super();
    this.formats = new Map();
    this.registerDefaultFormats();
  }

  registerFormat(name, exporter) {
    this.formats.set(name, exporter);
  }

  registerDefaultFormats() {
    this.registerFormat('json', {
      export: (data) => JSON.stringify(data, null, 2),
      contentType: 'application/json'
    });

    this.registerFormat('csv', {
      export: (data) => {
        if (!Array.isArray(data)) data = [data];
        if (data.length === 0) return '';

        const headers = Object.keys(data[0]);
        const rows = data.map(row =>
          headers.map(h => {
            const val = row[h];
            const str = val === null || val === undefined ? '' : String(val);
            return str.includes(',') || str.includes('"') || str.includes('\n')
              ? `"${str.replace(/"/g, '""')}"`
              : str;
          }).join(',')
        );

        return [headers.join(','), ...rows].join('\n');
      },
      contentType: 'text/csv'
    });

    this.registerFormat('xml', {
      export: (data) => {
        const toXml = (obj, root = 'data') => {
          if (Array.isArray(obj)) {
            return obj.map(item => toXml(item, root)).join('\n');
          }
          let xml = `<${root}>`;
          for (const [key, value] of Object.entries(obj)) {
            if (Array.isArray(value)) {
              xml += value.map(v => toXml(v, key)).join('');
            } else if (typeof value === 'object' && value !== null) {
              xml += toXml(value, key);
            } else {
              xml += `<${key}>${value ?? ''}</${key}>`;
            }
          }
          xml += `</${root}>`;
          return xml;
        };
        return `<?xml version="1.0" encoding="UTF-8"?>\n${toXml(data)}`;
      },
      contentType: 'application/xml'
    });

    this.registerFormat('yaml', {
      export: (data) => {
        const toYaml = (obj, indent = 0) => {
          const spaces = '  '.repeat(indent);
          let yaml = '';
          for (const [key, value] of Object.entries(obj)) {
            if (Array.isArray(value)) {
              yaml += `${spaces}${key}:\n`;
              value.forEach(item => {
                yaml += `${spaces}  - ${typeof item === 'object' ? '\n' + toYaml(item, indent + 2) : item}\n`;
              });
            } else if (typeof value === 'object' && value !== null) {
              yaml += `${spaces}${key}:\n${toYaml(value, indent + 1)}`;
            } else {
              yaml += `${spaces}${key}: ${value}\n`;
            }
          }
          return yaml;
        };
        return toYaml(data);
      },
      contentType: 'application/x-yaml'
    });
  }

  export(data, format = 'json', options = {}) {
    const exporter = this.formats.get(format);
    if (!exporter) {
      throw new Error(`Unsupported format: ${format}`);
    }

    const result = exporter.export(data, options);
    this.emit('exported', { format, size: result.length });

    return {
      content: result,
      contentType: exporter.contentType,
      format
    };
  }

  getSupportedFormats() {
    return Array.from(this.formats.keys());
  }
}

export class DataImporter extends EventEmitter {
  constructor(options = {}) {
    super();
    this.parsers = new Map();
    this.validators = new Map();
    this.registerDefaultParsers();
  }

  registerParser(name, parser) {
    this.parsers.set(name, parser);
  }

  registerDefaultParsers() {
    this.registerParser('json', {
      parse: (content) => JSON.parse(content),
      contentTypes: ['application/json']
    });

    this.registerParser('csv', {
      parse: (content) => {
        const lines = content.trim().split('\n');
        const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
        return lines.slice(1).map(line => {
          const values = line.split(',').map(v => v.trim().replace(/^"|"$/g, '').replace(/""/g, '"'));
          return headers.reduce((obj, h, i) => ({ ...obj, [h]: values[i] }), {});
        });
      },
      contentTypes: ['text/csv']
    });
  }

  parse(content, format) {
    const parser = this.parsers.get(format);
    if (!parser) {
      throw new Error(`Unsupported format: ${format}`);
    }

    const data = parser.parse(content);
    this.emit('parsed', { format, count: Array.isArray(data) ? data.length : 1 });
    return data;
  }

  getSupportedFormats() {
    return Array.from(this.parsers.keys());
  }
}

export class BatchProcessor extends EventEmitter {
  constructor(options = {}) {
    super();
    this.batchSize = options.batchSize || 100;
    this.batchDelay = options.batchDelay || 1000;
    this.queue = [];
    this.processing = false;
    this.timeoutId = null;
  }

  add(item) {
    this.queue.push(item);
    this.emit('item:added', { queueSize: this.queue.length });

    if (this.queue.length >= this.batchSize) {
      this.processBatch();
    } else if (!this.timeoutId) {
      this.timeoutId = setTimeout(() => this.processBatch(), this.batchDelay);
    }
  }

  async processBatch() {
    if (this.processing || this.queue.length === 0) return;

    this.processing = true;
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }

    const batch = this.queue.splice(0, this.batchSize);

    try {
      this.emit('batch:start', { size: batch.length });
      await this.processHandler(batch);
      this.emit('batch:complete', { size: batch.length });
    } catch (error) {
      this.emit('batch:error', { error: error.message, items: batch });
    } finally {
      this.processing = false;

      if (this.queue.length >= this.batchSize) {
        this.processBatch();
      }
    }
  }

  async processHandler(batch) {
    throw new Error('processHandler must be implemented');
  }

  flush() {
    if (this.queue.length > 0) {
      this.processBatch();
    }
  }

  getStats() {
    return {
      queueSize: this.queue.length,
      processing: this.processing
    };
  }
}

let templateEngine = null;

export function getTemplateEngine(options = {}) {
  if (!templateEngine) {
    templateEngine = new TemplateEngine(options);
  }
  return templateEngine;
}

export default { TemplateEngine, Template, DataExporter, DataImporter, BatchProcessor, getTemplateEngine };
