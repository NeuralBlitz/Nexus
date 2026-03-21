export const manifest = {
  name: 'xml-plugin',
  id: 'xml-plugin',
  version: '1.0.0',
  description: 'XML parsing and generation',
  author: 'NEXUS',
  main: 'index.js',
  permissions: []
};

let api;

export async function init(context) {
  api = context;
  api.log('XML plugin initialized');
}

export async function activate(context) {
  api.log('XML plugin activated');
}

export function deactivate() {
  api.log('XML plugin deactivated');
}

function parseAttributes(attrString) {
  const attrs = {};
  const regex = /(\w[\w-]*)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|(\S+)))?/g;
  let match;
  while ((match = regex.exec(attrString)) !== null) {
    attrs[match[1]] = match[2] || match[3] || match[4] || '';
  }
  return attrs;
}

function tokenize(xml) {
  const tokens = [];
  const regex = /<\?[^?]*\?>|<(\w[\w:-]*)([^>]*)(\/?)>|([^<]+)/g;
  let match;
  while ((match = regex.exec(xml)) !== null) {
    if (match[0].startsWith('<?')) tokens.push({ type: 'declaration', value: match[0] });
    else if (match[1]) {
      const attrs = match[2] ? parseAttributes(match[2]) : {};
      tokens.push({ type: match[3] === '/' ? 'close' : match[2] && !match[3] ? 'self-close' : 'open', tag: match[1], attrs, selfClose: match[3] === '/' });
    }
    else if (match[4]) tokens.push({ type: 'text', value: match[4].trim() });
  }
  return tokens;
}

function parseTokens(tokens) {
  const root = { tag: 'root', children: [] };
  const stack = [root];
  
  for (const token of tokens) {
    if (token.type === 'open') {
      const node = { tag: token.tag, attrs: token.attrs, children: [] };
      stack[stack.length - 1].children.push(node);
      stack.push(node);
    } else if (token.type === 'self-close') {
      const node = { tag: token.tag, attrs: token.attrs, children: [] };
      stack[stack.length - 1].children.push(node);
    } else if (token.type === 'close') {
      stack.pop();
    } else if (token.type === 'text') {
      if (token.value) stack[stack.length - 1].children.push(token.value);
    }
  }
  return root.children[0];
}

export const functions = {
  parse: (xml) => {
    try {
      const tokens = tokenize(xml);
      const result = parseTokens(tokens);
      return { success: true, data: result };
    } catch (e) {
      return { success: false, error: e.message };
    }
  },

  toXML: (obj, options = {}) => {
    const { indent = '  ', declaration = true } = options;
    let xml = '';
    
    if (declaration) xml += '<?xml version="1.0" encoding="UTF-8"?>\n';
    
    const build = (node, level = 0) => {
      const spaces = indent.repeat(level);
      const attrs = Object.entries(node.attrs || {}).map(([k, v]) => `${k}="${v}"`).join(' ');
      if (typeof node === 'string') {
        xml += spaces + node + '\n';
      } else if (node.children && node.children.length === 0) {
        xml += `${spaces}<${node.tag}${attrs ? ' ' + attrs : ''}/>\n`;
      } else {
        xml += `${spaces}<${node.tag}${attrs ? ' ' + attrs : ''}>\n`;
        for (const child of node.children) build(child, level + 1);
        xml += `${spaces}</${node.tag}>\n`;
      }
    };
    
    build(obj);
    return xml;
  },

  query: (xml, path) => {
    const { data } = functions.parse(xml);
    if (!data) return null;
    const parts = path.replace(/^\//, '').split('/');
    let current = [data];
    for (const part of parts) {
      if (!part) continue;
      const [tag, attr] = part.includes('@') ? part.split('@') : [part, null];
      const results = [];
      for (const node of current) {
        if (node.tag === tag) {
          if (attr) results.push(node.attrs[attr]);
          else results.push(node);
        }
        if (node.children) {
          for (const child of node.children) {
            if (typeof child !== 'string' && child.tag === tag) {
              results.push(attr ? child.attrs[attr] : child);
            }
          }
        }
      }
      current = results;
      if (current.length === 0) return null;
    }
    return current.length === 1 ? current[0] : current;
  },

  get: (xml, path) => functions.query(xml, path),

  set: (xml, path, value) => xml,

  remove: (xml, path) => xml,

  prettify: (xml, indent = '  ') => {
    let formatted = '';
    let level = 0;
    xml = xml.replace(/>\s*</g, '><');
    const tokens = xml.split(/(<\?[^?]*\?>|<\/\w+>|<[\w:-]+[^>]*>)/).filter(Boolean);
    
    for (const token of tokens) {
      if (token.startsWith('<?') || token.startsWith('</')) {
        level = Math.max(0, level - 1);
        formatted += indent.repeat(level) + token + '\n';
      } else if (token.startsWith('<')) {
        const isSelfClose = token.endsWith('/>');
        formatted += indent.repeat(level) + token + '\n';
        if (!isSelfClose) level++;
      } else if (token.trim()) {
        formatted += indent.repeat(level) + token.trim() + '\n';
      }
    }
    return formatted.trim();
  },

  minify: (xml) => xml.replace(/>\s+</g, '><').replace(/\s+/g, ' ').trim(),

  validate: (xml) => {
    const openTags = [], selfClose = [];
    const regex = /<(\/?)([\w:-]+)([^>]*)(\/?)>/g;
    let match;
    while ((match = regex.exec(xml)) !== null) {
      const [, slash, tag, attrs, selfSlash] = match;
      if (selfSlash === '/') selfClose.push(tag);
      else if (slash) {
        if (openTags[openTags.length - 1] !== tag) return { valid: false, error: `Mismatched tag: </${tag}>` };
        openTags.pop();
      } else openTags.push(tag);
    }
    if (openTags.length) return { valid: false, error: `Unclosed tags: ${openTags.join(', ')}` };
    return { valid: true };
  },

  toJSON: (xml) => {
    const { data } = functions.parse(xml);
    if (!data) return null;
    const convert = (node) => {
      if (typeof node === 'string') return node;
      const obj = { ...node.attrs };
      if (node.children.length === 1 && typeof node.children[0] === 'string') {
        obj._text = node.children[0];
      } else if (node.children.length > 0) {
        obj._children = node.children.map(convert);
      }
      return obj;
    };
    return JSON.stringify(convert(data), null, 2);
  },

  fromJSON: (json) => {
    const obj = typeof json === 'string' ? JSON.parse(json) : json;
    return functions.toXML(obj);
  }
};

export default { manifest, init, activate, deactivate, functions };
