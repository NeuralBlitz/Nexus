export const manifest = {
  name: 'emoji-plugin',
  id: 'emoji-plugin',
  version: '1.0.0',
  description: 'Emoji utilities and conversions',
  author: 'NEXUS',
  main: 'index.js',
  permissions: []
};

let api;

const emojiMap = {
  'smile': '😊', 'laugh': '😂', 'cry': '😢', 'heart': '❤️', 'fire': '🔥',
  'star': '⭐', 'sun': '☀️', 'moon': '🌙', 'cloud': '☁️', 'rain': '🌧️',
  'snow': '❄️', 'check': '✅', 'x': '❌', 'warning': '⚠️', 'info': 'ℹ️',
  'question': '❓', 'exclaim': '❗', 'arrow_up': '⬆️', 'arrow_down': '⬇️',
  'arrow_left': '⬅️', 'arrow_right': '➡️', 'thumbs_up': '👍', 'thumbs_down': '👎',
  'clap': '👏', 'wave': '👋', 'pray': '🙏', 'muscle': '💪', 'eyes': '👀',
  'brain': '🧠', 'robot': '🤖', 'alien': '👽', 'ghost': '👻', 'cat': '🐱',
  'dog': '🐕', 'bear': '🐻', 'panda': '🐼', 'koala': '🐨', 'lion': '🦁',
  'unicorn': '🦄', 'butterfly': '🦋', 'bee': '🐝', 'ant': '🐜', 'beetle': '🪲',
  'turtle': '🐢', 'fish': '🐟', 'dolphin': '🐬', 'whale': '🐳', 'shark': '🦈',
  'dragon': '🐉', 'snake': '🐍', 'frog': '🐸', 'panda_face': '🐼',
  'chicken': '🐔', 'penguin': '🐧', 'bird': '🐦', 'eagle': '🦅', 'owl': '🦉',
  'peacock': '🦚', 'flamingo': '🦩', 'dove': '🕊️', 'apple': '🍎', 'banana': '🍌',
  'grapes': '🍇', 'watermelon': '🍉', 'strawberry': '🍓', 'cherry': '🍒',
  'peach': '🍑', 'lemon': '🍋', 'orange': '🍊', 'tomato': '🍅', 'eggplant': '🍆',
  'pizza': '🍕', 'burger': '🍔', 'fries': '🍟', 'hotdog': '🌭', 'taco': '🌮',
  'burrito': '🌯', 'ramen': '🍜', 'spaghetti': '🍝', 'bread': '🍞', 'croissant': '🥐',
  'baguette': '🥖', 'pretzel': '🥨', 'pancakes': '🥞', 'waffle': '🧇', 'cheese': '🧀',
  'meat': '🥩', 'poultry': '🍗', 'bacon': '🥓', 'egg': '🥚', 'fried_egg': '🍳',
  'shallow_pan': '🥘', 'stew': '🍲', 'bowl': '🥣', 'salad': '🥗', 'popcorn': '🍿',
  'butter': '🧈', 'salt': '🧂', 'canned': '🥫', 'bento': '🍱', 'rice': '🍚',
  'curry': '🍛', 'sake': '🍶', 'beer': '🍺', 'wine': '🍷', 'cocktail': '🍸',
  'tropical_drink': '🍹', 'champagne': '🍾', 'tea': '🍵', 'coffee': '☕', 'milk': '🥛',
  'juice': '🧃', 'mate': '🧉', 'ice': '🧊', 'cup_with_straw': '🥤', 'spoon': '🥄',
  'fork_knife': '🍴', 'plate': '🍽️', 'bowl_with_spoon': '🥣', 'chopsticks': '🍜',
  'avocado': '🥑', 'cucumber': '🥒', 'broccoli': '🥦', 'corn': '🌽', 'carrot': '🥕',
  'hot_pepper': '🌶️', 'potato': '🥔', 'sweet_potato': '🍠', 'croissant': '🥐',
  'mushroom': '🍄', 'peanuts': '🥜', 'chestnut': '🌰', 'bread': '🍞'
};

const categories = {
  'smileys': ['😊', '😂', '😢', '😍', '🥰', '🤔', '😅', '🤩', '😎', '🥳'],
  'animals': ['🐱', '🐕', '🐻', '🐼', '🦁', '🐸', '🦊', '🐰', '🐶', '🐷'],
  'food': ['🍕', '🍔', '🍟', '🌮', '🍣', '🍜', '🍝', '🍰', '🍩', '🍪'],
  'activities': ['⚽', '🏀', '⚾', '🎮', '🎯', '🎲', '🎸', '🎨', '🏆', '🎭'],
  'travel': ['✈️', '🚗', '🏠', '🏨', '🏖️', '⛺', '🗽', '🗼', '🏔️', '🌋'],
  'objects': ['💻', '📱', '⌚', '📷', '🎧', '🔑', '💡', '📚', '✏️', '💰']
};

export async function init(context) {
  api = context;
  api.log('Emoji plugin initialized');
}

export async function activate(context) {
  api.log('Emoji plugin activated');
}

export function deactivate() {
  api.log('Emoji plugin deactivated');
}

export const functions = {
  convert: (text) => {
    let result = text;
    for (const [key, emoji] of Object.entries(emojiMap)) {
      const regex = new RegExp(`:${key}:`, 'gi');
      result = result.replace(regex, emoji);
    }
    return result;
  },

  toShortcode: (emoji) => {
    for (const [key, value] of Object.entries(emojiMap)) {
      if (value === emoji) return `:${key}:`;
    }
    return null;
  },

  search: (query) => {
    const results = [];
    query = query.toLowerCase();
    
    for (const [key, emoji] of Object.entries(emojiMap)) {
      if (key.includes(query)) {
        results.push({ key, emoji });
      }
    }
    
    return results.slice(0, 20);
  },

  getCategory: (name) => categories[name] || [],

  listCategories: () => Object.keys(categories),

  random: (count = 1) => {
    const all = Object.values(emojiMap);
    const result = [];
    for (let i = 0; i < count; i++) {
      result.push(all[Math.floor(Math.random() * all.length)]);
    }
    return count === 1 ? result[0] : result;
  },

  skinTone: (emoji, tone = 'light') => {
    const tones = {
      'light': '\u{1F3FB}',
      'medium_light': '\u{1F3FC}',
      'medium': '\u{1F3FD}',
      'medium_dark': '\u{1F3FE}',
      'dark': '\u{1F3FF}'
    };
    return emoji + (tones[tone] || tones['light']);
  },

  count: (text) => {
    let count = 0;
    for (const char of text) {
      if (emojiMap[char] || /\p{Emoji}/u.test(char)) count++;
    }
    return count;
  },

  strip: (text) => {
    return text.replace(/[\u{1F300}-\u{1F9FF}]/gu, '');
  },

  kaomoji: (mood = 'happy') => {
    const kaomojis = {
      'happy': ['(◕‿◕)', 'ヽ(>∀<☆)☆', '٩(◕‿◕)۶', '(✿◠‿◠)'],
      'sad': ['(╥﹏╥)', '(´;ω;`)', '(｡•́︿•̀｡)', '(╯︵╰,)'],
      'angry': ['(╬ Ò﹏Ó)', '(ノಠ益ಠ)ノ彡┻━┻', '(ㆆ_ㆆ)', '(」°ロ°)」'],
      'surprised': ['(°o°)', '(⊙_⊙)', '(⊙﹏⊙)', 'Σ(°△°|||)'],
      'love': ['(♥‿♥)', '♡(◡‿◡)♡', '(´∀｀)♡', '💕💕💕'],
      'cool': ['(⌐■_■)', '( •_•)>⌐■-■', '( •_•)O', '(⌐⊙_⊙)']
    };
    const moodList = kaomojis[mood] || kaomojis['happy'];
    return moodList[Math.floor(Math.random() * moodList.length)];
  }
};

export default { manifest, init, activate, deactivate, functions };
