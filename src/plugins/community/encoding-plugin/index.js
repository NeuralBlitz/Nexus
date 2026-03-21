export const manifest = {
  name: 'encoding-plugin',
  id: 'encoding-plugin',
  version: '1.0.0',
  description: 'Text encoding and decoding utilities',
  author: 'NEXUS',
  main: 'index.js',
  permissions: []
};

let api;

export async function init(context) {
  api = context;
  api.log('Encoding plugin initialized');
}

export async function activate(context) {
  api.log('Encoding plugin activated');
}

export function deactivate() {
  api.log('Encoding plugin deactivated');
}

export const functions = {
  base64Encode: (str) => Buffer.from(str).toString('base64'),
  base64Decode: (str) => Buffer.from(str, 'base64').toString('utf8'),

  urlEncode: (str) => encodeURIComponent(str),
  urlDecode: (str) => decodeURIComponent(str),

  htmlEncode: (str) => str.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]),
  htmlDecode: (str) => str.replace(/&(amp|lt|gt|quot|#39|#x[0-9a-f]+);/gi, (_, m) => {
    const entities = { amp: '&', lt: '<', gt: '>', quot: '"', '#39': "'" };
    if (m.startsWith('#x')) return String.fromCharCode(parseInt(m.slice(2), 16));
    return entities[m] || m;
  }),

  hexEncode: (str) => Buffer.from(str).toString('hex'),
  hexDecode: (str) => Buffer.from(str, 'hex').toString('utf8'),

  binaryEncode: (str) => str.split('').map(c => c.charCodeAt(0).toString(2).padStart(8, '0')).join(' '),
  binaryDecode: (str) => str.split(/\s+/).map(b => String.fromCharCode(parseInt(b, 2))).join(''),

  octalEncode: (str) => str.split('').map(c => c.charCodeAt(0).toString(8).padStart(3, '0')).join(' '),
  octalDecode: (str) => str.split(/\s+/).map(o => String.fromCharCode(parseInt(o, 8))).join(''),

  asciiEncode: (str) => str.split('').map(c => c.charCodeAt(0)),
  asciiDecode: (arr) => arr.map(c => String.fromCharCode(c)).join(''),

  unicodeEncode: (str) => str.split('').map(c => '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0')).join(''),
  unicodeDecode: (str) => str.replace(/\\u([0-9a-f]{4})/gi, (_, m) => String.fromCharCode(parseInt(m, 16))),

  rot13: (str) => str.replace(/[a-zA-Z]/g, c => {
    const base = c <= 'Z' ? 65 : 97;
    return String.fromCharCode((c.charCodeAt(0) - base + 13) % 26 + base);
  }),

  caesar: (str, shift) => str.replace(/[a-zA-Z]/g, c => {
    const base = c <= 'Z' ? 65 : 97;
    return String.fromCharCode((c.charCodeAt(0) - base + shift + 26) % 26 + base);
  }),

  vigenereEncode: (str, key) => {
    let result = '', kIdx = 0;
    for (const char of str) {
      if (/[a-zA-Z]/.test(char)) {
        const base = char <= 'Z' ? 65 : 97;
        const shift = key.charCodeAt(kIdx % key.length) - 65;
        result += String.fromCharCode((char.charCodeAt(0) - base + shift) % 26 + base);
        kIdx++;
      } else result += char;
    }
    return result;
  },

  vigenereDecode: (str, key) => {
    let result = '', kIdx = 0;
    for (const char of str) {
      if (/[a-zA-Z]/.test(char)) {
        const base = char <= 'Z' ? 65 : 97;
        const shift = key.charCodeAt(kIdx % key.length) - 65;
        result += String.fromCharCode((char.charCodeAt(0) - base - shift + 26) % 26 + base);
        kIdx++;
      } else result += char;
    }
    return result;
  },

  baconEncode: (str) => {
    const table = { A: 'AAAAA', B: 'AAAAB', C: 'AAABA', D: 'AAABB', E: 'AABAA', F: 'AABAB', G: 'AABBA', H: 'AABBB', I: 'ABAAA', J: 'ABAAB', K: 'ABABA', L: 'ABABB', M: 'ABBA A', N: 'ABBAB', O: 'ABBBA', P: 'ABBBB', Q: 'BAAAA', R: 'BAAAB', S: 'BAABA', T: 'BAABB', U: 'BABAA', V: 'BABAB', W: 'BABBA', X: 'BABBB', Y: 'BBAAA', Z: 'BBAAB' };
    return str.toUpperCase().replace(/[A-Z]/g, c => table[c] || c).replace(/\s/g, '');
  },

  morseEncode: (str) => {
    const morse = { A: '.-', B: '-...', C: '-.-.', D: '-..', E: '.', F: '..-.', G: '--.', H: '....', I: '..', J: '.---', K: '-.-', L: '.-..', M: '--', N: '-.', O: '---', P: '.--.', Q: '--.-', R: '.-.', S: '...', T: '-', U: '..-', V: '...-', W: '.--', X: '-..-', Y: '-.--', Z: '--..', '0': '-----', '1': '.----', '2': '..---', '3': '...--', '4': '....-', '5': '.....', '6': '-....', '7': '--...', '8': '---..', '9': '----.' };
    return str.toUpperCase().replace(/[A-Z0-9]/g, c => morse[c] || c).split('  ').map(w => w.replace(/ /g, '')).join(' / ');
  },

  ascii85Encode: (str) => {
    const b85 = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz!#$%&()*+-;<=>?@^_`{|}~';
    const bytes = Buffer.from(str);
    let result = '';
    for (let i = 0; i < bytes.length; i += 4) {
      let n = (bytes[i] << 24) | (bytes[i+1] << 16) | (bytes[i+2] << 8) | bytes[i+3];
      for (let j = 4; j >= 0; j--) result += b85[Math.floor(n / Math.pow(85, j)) % 85];
    }
    return result;
  },

  quotedPrintableEncode: (str) => {
    return str.replace(/[^!\x21-\x3C\x3E-\x7E]/g, c => '=' + c.charCodeAt(0).toString(16).toUpperCase().padStart(2, '0'));
  },

  quotedPrintableDecode: (str) => {
    return str.replace(/=([0-9A-F]{2})/gi, (_, m) => String.fromCharCode(parseInt(m, 16)));
  },

  detectEncoding: (str) => {
    if (/^[\x00-\x7F]+$/.test(str)) return 'ascii';
    if (/^[\x00-\xFF]+$/.test(str)) return 'latin1';
    if (/^[\u0000-\uFFFF]+$/.test(str)) return 'unicode';
    return 'utf8';
  }
};

export default { manifest, init, activate, deactivate, functions };
