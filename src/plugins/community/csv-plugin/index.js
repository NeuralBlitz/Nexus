export const manifest = {
  name: 'csv-plugin',
  id: 'csv-plugin',
  version: '1.0.0',
  description: 'CSV parsing and generation',
  author: 'NEXUS',
  main: 'index.js',
  permissions: []
};

let api;

export async function init(context) {
  api = context;
  api.log('CSV plugin initialized');
}

export async function activate(context) {
  api.log('CSV plugin activated');
}

export function deactivate() {
  api.log('CSV plugin deactivated');
}

export const functions = {
  parse: (csv, options = {}) => {
    const { delimiter = ',', headers = true, skipEmpty = true } = options;
    const lines = csv.split(/\r?\n/).filter(l => !skipEmpty || l.trim());
    if (lines.length === 0) return [];
    
    const result = [];
    const headerLine = headers ? lines[0] : null;
    const dataLines = headers ? lines.slice(1) : lines;
    
    for (const line of dataLines) {
      const values = functions.parseRow(line, delimiter);
      if (headers && headerLine) {
        const headersArr = functions.parseRow(headerLine, delimiter);
        result.push(Object.fromEntries(headersArr.map((h, i) => [h, values[i]])));
      } else {
        result.push(values);
      }
    }
    return result;
  },

  parseRow: (row, delimiter = ',') => {
    const result = [];
    let current = '', inQuotes = false;
    for (let i = 0; i < row.length; i++) {
      const char = row[i];
      if (char === '"') {
        if (inQuotes && row[i + 1] === '"') { current += '"'; i++; }
        else inQuotes = !inQuotes;
      } else if (char === delimiter && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current.trim());
    return result;
  },

  stringify: (data, options = {}) => {
    const { delimiter = ',', headers = true, quote = '"' } = options;
    if (data.length === 0) return '';
    
    const keys = headers ? Object.keys(data[0]) : null;
    const rows = [];
    
    if (headers) rows.push(keys.map(k => functions.escape(k, delimiter, quote)).join(delimiter));
    
    for (const row of data) {
      const values = keys ? keys.map(k => functions.escape(row[k], delimiter, quote)) : Object.values(row).map(v => functions.escape(v, delimiter, quote));
      rows.push(values.join(delimiter));
    }
    return rows.join('\n');
  },

  escape: (value, delimiter = ',', quote = '"') => {
    const str = value === null || value === undefined ? '' : String(value);
    if (str.includes(quote) || str.includes(delimiter) || str.includes('\n')) {
      return quote + str.replace(new RegExp(quote, 'g'), quote + quote) + quote;
    }
    return str;
  },

  toJSON: (csv, options) => functions.parse(csv, options),

  toObjects: (csv, options) => functions.parse(csv, { ...options, headers: true }),

  fromJSON: (json, options) => {
    const data = typeof json === 'string' ? JSON.parse(json) : json;
    return functions.stringify(data, options);
  },

  transform: (csv, fn, options = {}) => {
    const data = functions.parse(csv, options);
    const transformed = data.map(fn);
    return functions.stringify(transformed, options);
  },

  filter: (csv, predicate, options = {}) => {
    const data = functions.parse(csv, options);
    const filtered = typeof predicate === 'string' ? functions.parseWhere(data, predicate) : data.filter(predicate);
    return functions.stringify(filtered, options);
  },

  parseWhere: (data, where) => {
    const [key, op, value] = where.match(/(\w+)\s*(=|!=|>|<|>=|<=|LIKE)\s*(.+)/)?.slice(1) || [];
    if (!key) return data;
    return data.filter(row => {
      const val = row[key];
      switch (op) {
        case '=': return String(val) === value;
        case '!=': return String(val) !== value;
        case '>': return Number(val) > Number(value);
        case '<': return Number(val) < Number(value);
        case '>=': return Number(val) >= Number(value);
        case '<=': return Number(val) <= Number(value);
        case 'LIKE': return String(val).toLowerCase().includes(value.replace(/%/g, '').toLowerCase());
        default: return true;
      }
    });
  },

  aggregate: (csv, groupBy, aggregations, options = {}) => {
    const data = functions.parse(csv, options);
    const groups = {};
    
    for (const row of data) {
      const key = row[groupBy];
      if (!groups[key]) groups[key] = [];
      groups[key].push(row);
    }
    
    return Object.entries(groups).map(([key, rows]) => {
      const result = { [groupBy]: key };
      for (const [aggField, aggFn] of Object.entries(aggregations)) {
        const values = rows.map(r => parseFloat(r[aggField])).filter(v => !isNaN(v));
        switch (aggFn) {
          case 'sum': result[aggField] = values.reduce((a, b) => a + b, 0); break;
          case 'avg': result[aggField] = values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0; break;
          case 'min': result[aggField] = Math.min(...values); break;
          case 'max': result[aggField] = Math.max(...values); break;
          case 'count': result[aggField] = values.length; break;
        }
      }
      return result;
    });
  },

  join: (csv1, csv2, on, type = 'inner', options = {}) => {
    const data1 = functions.parse(csv1, options);
    const data2 = functions.parse(csv2, options);
    const result = [];
    
    for (const row1 of data1) {
      const match = data2.find(row2 => String(row1[on]) === String(row2[on]));
      if (match) {
        result.push({ ...row1, ...match });
      } else if (type === 'left') {
        result.push({ ...row1 });
      }
    }
    return functions.stringify(result, options);
  },

  stats: (csv, column, options = {}) => {
    const data = functions.parse(csv, options);
    const values = data.map(row => parseFloat(row[column])).filter(v => !isNaN(v));
    const sorted = [...values].sort((a, b) => a - b);
    const sum = values.reduce((a, b) => a + b, 0);
    return {
      count: values.length,
      sum, min: sorted[0], max: sorted[sorted.length - 1],
      avg: sum / values.length,
      median: sorted[Math.floor(sorted.length / 2)],
      p25: sorted[Math.floor(sorted.length * 0.25)],
      p75: sorted[Math.floor(sorted.length * 0.75)]
    };
  }
};

export default { manifest, init, activate, deactivate, functions };
