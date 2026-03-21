export const manifest = {
  name: 'password-plugin',
  id: 'password-plugin',
  version: '1.0.0',
  description: 'Password generation and strength checking',
  author: 'NEXUS',
  main: 'index.js',
  permissions: []
};

let api;
import crypto from 'crypto';

export async function init(context) {
  api = context;
  api.log('Password plugin initialized');
}

export async function activate(context) {
  api.log('Password plugin activated');
}

export function deactivate() {
  api.log('Password plugin deactivated');
}

export const functions = {
  generate: (length = 16, options = {}) => {
    const { lowercase = true, uppercase = true, numbers = true, symbols = true, exclude = '', excludeAmbiguous = false } = options;
    
    let chars = '';
    if (lowercase) chars += 'abcdefghijklmnopqrstuvwxyz';
    if (uppercase) chars += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    if (numbers) chars += '0123456789';
    if (symbols) chars += '!@#$%^&*()_+-=[]{}|;:,.<>?';
    if (excludeAmbiguous) chars = chars.replace(/[0OlI1|]/g, '');
    
    chars = chars.split('').filter(c => !exclude.includes(c)).join('');
    
    let password = '';
    const bytes = crypto.randomBytes(length);
    for (let i = 0; i < length; i++) {
      password += chars[bytes[i] % chars.length];
    }
    
    return password;
  },

  checkStrength: (password) => {
    let score = 0;
    const checks = {
      length: password.length >= 8,
      longLength: password.length >= 12,
      veryLong: password.length >= 16,
      lowercase: /[a-z]/.test(password),
      uppercase: /[A-Z]/.test(password),
      numbers: /\d/.test(password),
      symbols: /[!@#$%^&*()_+\-=\[\]{}|;:,.<>?]/.test(password),
      noCommonPatterns: !/^(password|123456|qwerty)/i.test(password),
      noRepeats: !/(.)\1{2,}/.test(password)
    };
    
    if (checks.length) score += 10;
    if (checks.longLength) score += 15;
    if (checks.veryLong) score += 10;
    if (checks.lowercase) score += 10;
    if (checks.uppercase) score += 10;
    if (checks.numbers) score += 15;
    if (checks.symbols) score += 20;
    if (checks.noCommonPatterns) score += 5;
    if (checks.noRepeats) score += 5;
    
    return {
      score: Math.min(100, score),
      strength: score < 40 ? 'weak' : score < 60 ? 'fair' : score < 80 ? 'good' : 'strong',
      suggestions: Object.entries(checks).filter(([k, v]) => !v).map(([k]) => k)
    };
  },

  hash: async (password, options = {}) => {
    try {
      const bcrypt = await import('bcryptjs');
      const rounds = options.rounds || 10;
      return bcrypt.hashSync(password, rounds);
    } catch { throw new Error('bcryptjs not installed'); }
  },

  verify: async (password, hash) => {
    try {
      const bcrypt = await import('bcryptjs');
      return bcrypt.compareSync(password, hash);
    } catch { throw new Error('bcryptjs not installed'); }
  },

  derive: (password, salt, iterations = 100000, keylen = 32) => {
    const derived = crypto.pbkdf2Sync(password, salt, iterations, keylen, 'sha512');
    return derived.toString('hex');
  },

  generateSalt: (length = 16) => crypto.randomBytes(length).toString('hex'),

  randomPhrase: (wordCount = 4, separator = '-') => {
    const words = ['apple', 'banana', 'cherry', 'dragon', 'eagle', 'forest', 'garden', 'harbor', 'island', 'jungle',
                   'kernel', 'lemon', 'mountain', 'nectar', 'ocean', 'palace', 'quartz', 'river', 'sunset', 'thunder',
                   'umbrella', 'valley', 'winter', 'xylophone', 'yellow', 'zebra', 'anchor', 'breeze', 'castle', 'dolphin'];
    const bytes = crypto.randomBytes(wordCount);
    const selected = [];
    for (let i = 0; i < wordCount; i++) {
      selected.push(words[bytes[i] % words.length]);
    }
    return selected.join(separator);
  },

  pin: (length = 6) => {
    const bytes = crypto.randomBytes(length);
    return Array.from({ length }, (_, i) => bytes[i] % 10).join('');
  },

  passphrase: (options = {}) => {
    const { words = 4, numbers = true, capitalize = true, separator = '-' } = options;
    let phrase = functions.randomPhrase(words, separator);
    if (capitalize) phrase = phrase.replace(/\b\w/g, c => c.toUpperCase());
    if (numbers) {
      const idx = Math.floor(Math.random() * words);
      const num = Math.floor(Math.random() * 100);
      phrase += separator + num;
    }
    return phrase;
  }
};

export default { manifest, init, activate, deactivate, functions };
