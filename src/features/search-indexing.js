import { EventEmitter } from 'events';

export class DataIndex {
  constructor(name, options = {}) {
    this.name = name;
    this.fields = options.fields || [];
    this.unique = options.unique || false;
    this.sparse = options.sparse || false;
    this.documents = new Map();
  }

  add(id, data) {
    const values = this.extractValues(data);

    if (this.unique) {
      for (const [existingId, existingValues] of this.documents) {
        if (existingId !== id && this.valuesMatch(values, existingValues)) {
          throw new Error(`Duplicate key for unique index: ${this.name}`);
        }
      }
    }

    this.documents.set(id, values);
  }

  remove(id) {
    return this.documents.delete(id);
  }

  extractValues(data) {
    return this.fields.map(field => this.getNestedValue(data, field));
  }

  getNestedValue(obj, path) {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }

  valuesMatch(a, b) {
    return a.every((val, i) => val === b[i]);
  }

  search(query) {
    const results = [];

    for (const [id, values] of this.documents) {
      let match = true;

      for (const [fieldIndex, searchValue] of Object.entries(query)) {
        const index = parseInt(fieldIndex);
        if (values[index] !== searchValue) {
          match = false;
          break;
        }
      }

      if (match) results.push(id);
    }

    return results;
  }

  range(fieldIndex, min, max, inclusive = true) {
    const results = [];

    for (const [id, values] of this.documents) {
      const value = values[fieldIndex];
      if (value === undefined || value === null) continue;

      const aboveMin = inclusive ? value >= min : value > min;
      const belowMax = inclusive ? value <= max : value < max;

      if (aboveMin && belowMax) results.push(id);
    }

    return results;
  }
}

export class SearchEngine extends EventEmitter {
  constructor(options = {}) {
    super();

    this.indexes = new Map();
    this.documents = new Map();
    this.analyzers = new Map();
    this.config = {
      maxResults: options.maxResults || 100,
      fuzzyThreshold: options.fuzzyThreshold || 0.8,
      minScore: options.minScore || 0.1
    };

    this.registerDefaultAnalyzers();
  }

  registerDefaultAnalyzers() {
    this.registerAnalyzer('standard', (text) => {
      if (typeof text !== 'string') return [];
      return text
        .toLowerCase()
        .split(/[\s,.!?;:'"()\[\]{}]+/)
        .filter(token => token.length > 1);
    });

    this.registerAnalyzer('lowercase', (text) => {
      if (typeof text !== 'string') return [];
      return text.toLowerCase().split(/\s+/);
    });

    this.registerAnalyzer('whitespace', (text) => {
      if (typeof text !== 'string') return [];
      return text.split(/\s+/);
    });
  }

  registerAnalyzer(name, analyzer) {
    this.analyzers.set(name, analyzer);
  }

  createIndex(name, fields, options = {}) {
    const index = new DataIndex(name, { fields, ...options });
    this.indexes.set(name, index);
    return index;
  }

  addDocument(id, data, indexName = 'default') {
    this.documents.set(id, data);

    let index = this.indexes.get(indexName);
    if (!index) {
      index = this.createIndex(indexName, Object.keys(data));
    }

    index.add(id, data);
    this.emit('document:added', { id, indexName });
  }

  removeDocument(id) {
    this.documents.delete(id);

    for (const index of this.indexes.values()) {
      index.remove(id);
    }

    this.emit('document:removed', { id });
  }

  updateDocument(id, data) {
    this.removeDocument(id);
    this.addDocument(id, data);
  }

  search(query, options = {}) {
    const {
      indexName = 'default',
      analyzer = 'standard',
      fields = null,
      limit = this.config.maxResults
    } = options;

    const tokens = this.analyze(query, analyzer);
    if (tokens.length === 0) return [];

    const scores = new Map();

    for (const [docId, doc] of this.documents) {
      let score = 0;

      const searchFields = fields || Object.keys(doc);

      for ( const field of searchFields) {
        const fieldTokens = this.analyze(String(doc[field] || ''), analyzer);

        for (const queryToken of tokens) {
          for (const fieldToken of fieldTokens) {
            const similarity = this.calculateSimilarity(queryToken, fieldToken);

            if (similarity >= this.config.fuzzyThreshold) {
              score += similarity * (fieldToken === queryToken ? 1 : 0.5);
            }
          }
        }
      }

      if (score > 0) {
        scores.set(docId, { doc, score });
      }
    }

    return Array.from(scores.entries())
      .filter(([, { score }]) => score >= this.config.minScore)
      .sort((a, b) => b[1].score - a[1].score)
      .slice(0, limit)
      .map(([id, { doc, score }]) => ({ id, ...doc, score }));
  }

  analyze(text, analyzerName = 'standard') {
    const analyzer = this.analyzers.get(analyzerName);
    return analyzer ? analyzer(text) : [text.toLowerCase()];
  }

  calculateSimilarity(a, b) {
    if (a === b) return 1;
    if (a.length === 0 || b.length === 0) return 0;

    const matrix = [];

    for (let i = 0; i <= a.length; i++) {
      matrix[i] = [i];
    }
    for (let j = 0; j <= b.length; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= a.length; i++) {
      for (let j = 1; j <= b.length; j++) {
        const cost = a[i - 1] === b[j - 1] ? 0 : 1;
        matrix[i][j] = Math.min(
          matrix[i - 1][j] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j - 1] + cost
        );
      }
    }

    const distance = matrix[a.length][b.length];
    const maxLen = Math.max(a.length, b.length);
    return 1 - distance / maxLen;
  }

  query(filters = {}) {
    let results = Array.from(this.documents.entries());

    if (filters.conditions) {
      results = results.filter(([, doc]) => {
        return filters.conditions.every(({ field, operator, value }) => {
          const docValue = this.getNestedValue(doc, field);

          switch (operator) {
            case '=': return docValue === value;
            case '!=': return docValue !== value;
            case '>': return docValue > value;
            case '>=': return docValue >= value;
            case '<': return docValue < value;
            case '<=': return docValue <= value;
            case 'contains': return String(docValue).includes(value);
            case 'startsWith': return String(docValue).startsWith(value);
            case 'endsWith': return String(docValue).endsWith(value);
            case 'in': return Array.isArray(value) && value.includes(docValue);
            default: return true;
          }
        });
      });
    }

    if (filters.sort) {
      results.sort((a, b) => {
        const aVal = this.getNestedValue(a[1], filters.sort.field);
        const bVal = this.getNestedValue(b[1], filters.sort.field);
        const order = filters.sort.order === 'desc' ? -1 : 1;
        return (aVal > bVal ? 1 : -1) * order;
      });
    }

    if (filters.limit) {
      results = results.slice(0, filters.limit);
    }

    return results.map(([id, doc]) => ({ id, ...doc }));
  }

  getNestedValue(obj, path) {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }

  getStats() {
    return {
      documents: this.documents.size,
      indexes: this.indexes.size,
      analyzers: this.analyzers.size
    };
  }

  clear() {
    this.documents.clear();
    for (const index of this.indexes.values()) {
      index.documents.clear();
    }
  }
}

let searchEngine = null;

export function getSearchEngine(options = {}) {
  if (!searchEngine) {
    searchEngine = new SearchEngine(options);
  }
  return searchEngine;
}

export default { SearchEngine, DataIndex, getSearchEngine };
