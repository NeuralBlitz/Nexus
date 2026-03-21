export const manifest = {
  name: 'translator-plugin',
  id: 'translator-plugin',
  version: '1.0.0',
  description: 'Multi-language translation and language detection',
  author: 'NEXUS',
  main: 'index.js',
  permissions: []
};

let api;
const translations = new Map();

export async function init(context) {
  api = context;
  initializeBuiltInTranslations();
  api.log('Translator plugin initialized');
}

export async function activate(context) {
  api.log('Translator plugin activated');
}

export function deactivate() {
  api.log('Translator plugin deactivated');
}

function initializeBuiltInTranslations() {
  translations.set('hello_es', 'Hola');
  translations.set('hello_fr', 'Bonjour');
  translations.set('hello_de', 'Hallo');
  translations.set('hello_it', 'Ciao');
  translations.set('hello_ja', 'Konnichiwa');
  translations.set('hello_zh', 'Ni Hao');
  translations.set('goodbye_es', 'Adios');
  translations.set('goodbye_fr', 'Au revoir');
  translations.set('goodbye_de', 'Auf Wiedersehen');
}

export const hooks = {
  'message:process': async (message, context) => {
    if (message.translated) return message;
    return message;
  }
};

export const functions = {
  detect: (text) => {
    const patterns = {
      'ja': /[\u3040-\u309F\u30A0-\u30FF]/,
      'ko': /[\uAC00-\uD7AF\u1100-\u11FF]/,
      'zh': /[\u4E00-\u9FFF]/,
      'ar': /[\u0600-\u06FF]/,
      'ru': /[\u0400-\u04FF]/,
      'el': /[\u0370-\u03FF]/,
      'th': /[\u0E00-\u0E7F]/,
      'hi': /[\u0900-\u097F]/
    };

    for (const [lang, pattern] of Object.entries(patterns)) {
      if (pattern.test(text)) return lang;
    }
    return 'en';
  },
  translate: (text, from = 'auto', to = 'en') => {
    const key = `${text}_${to}`;
    if (translations.has(key)) {
      return { original: text, translated: translations.get(key), from, to };
    }
    return { original: text, translated: text, from, to, note: 'Translation not available' };
  },
  addTranslation: (text, translation, language) => {
    translations.set(`${text}_${language}`, translation);
    return { success: true, text, translation, language };
  },
  getSupportedLanguages: () => [
    { code: 'en', name: 'English' },
    { code: 'es', name: 'Spanish' },
    { code: 'fr', name: 'French' },
    { code: 'de', name: 'German' },
    { code: 'it', name: 'Italian' },
    { code: 'pt', name: 'Portuguese' },
    { code: 'ja', name: 'Japanese' },
    { code: 'ko', name: 'Korean' },
    { code: 'zh', name: 'Chinese' },
    { code: 'ar', name: 'Arabic' },
    { code: 'ru', name: 'Russian' }
  ]
};

export default { manifest, init, activate, deactivate, hooks, functions };
