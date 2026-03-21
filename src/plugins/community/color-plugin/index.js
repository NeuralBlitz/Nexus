export const manifest = {
  name: 'color-plugin',
  id: 'color-plugin',
  version: '1.0.0',
  description: 'Color conversion and manipulation utilities',
  author: 'NEXUS',
  main: 'index.js',
  permissions: []
};

let api;

export async function init(context) {
  api = context;
  api.log('Color plugin initialized');
}

export async function activate(context) {
  api.log('Color plugin activated');
}

export function deactivate() {
  api.log('Color plugin deactivated');
}

export const functions = {
  parse: (color) => {
    if (color.startsWith('#')) return parseHex(color);
    if (color.startsWith('rgb')) return parseRgb(color);
    if (color.startsWith('hsl')) return parseHsl(color);
    if (color.startsWith('hsv')) return parseHsv(color);
    return parseName(color);
  },

  toHex: (color) => {
    const parsed = functions.parse(color);
    if (!parsed) return null;
    const { r, g, b } = parsed;
    return '#' + [r, g, b].map(x => x.toString(16).padStart(2, '0')).join('').toUpperCase();
  },

  toRgb: (color) => {
    const parsed = functions.parse(color);
    if (!parsed) return null;
    return { r: parsed.r, g: parsed.g, b: parsed.b, a: parsed.a };
  },

  toHsl: (color) => {
    const rgb = functions.toRgb(color);
    if (!rgb) return null;
    return rgbToHsl(rgb.r, rgb.g, rgb.b);
  },

  toHsv: (color) => {
    const rgb = functions.toRgb(color);
    if (!rgb) return null;
    return rgbToHsv(rgb.r, rgb.g, rgb.b);
  },

  lighten: (color, amount = 10) => {
    const hsl = functions.toHsl(color);
    if (!hsl) return null;
    hsl.l = Math.min(100, hsl.l + amount);
    return hslToHex(hsl.h, hsl.s, hsl.l);
  },

  darken: (color, amount = 10) => {
    const hsl = functions.toHsl(color);
    if (!hsl) return null;
    hsl.l = Math.max(0, hsl.l - amount);
    return hslToHex(hsl.h, hsl.s, hsl.l);
  },

  saturate: (color, amount = 10) => {
    const hsl = functions.toHsl(color);
    if (!hsl) return null;
    hsl.s = Math.min(100, hsl.s + amount);
    return hslToHex(hsl.h, hsl.s, hsl.l);
  },

  desaturate: (color, amount = 10) => {
    const hsl = functions.toHsl(color);
    if (!hsl) return null;
    hsl.s = Math.max(0, hsl.s - amount);
    return hslToHex(hsl.h, hsl.s, hsl.l);
  },

  complementary: (color) => {
    const hsl = functions.toHsl(color);
    if (!hsl) return null;
    hsl.h = (hsl.h + 180) % 360;
    return hslToHex(hsl.h, hsl.s, hsl.l);
  },

  triadic: (color) => {
    const hsl = functions.toHsl(color);
    if (!hsl) return null;
    return [
      hslToHex(hsl.h, hsl.s, hsl.l),
      hslToHex((hsl.h + 120) % 360, hsl.s, hsl.l),
      hslToHex((hsl.h + 240) % 360, hsl.s, hsl.l)
    ];
  },

  analogous: (color) => {
    const hsl = functions.toHsl(color);
    if (!hsl) return null;
    return [
      hslToHex((hsl.h - 30 + 360) % 360, hsl.s, hsl.l),
      hslToHex(hsl.h, hsl.s, hsl.l),
      hslToHex((hsl.h + 30) % 360, hsl.s, hsl.l)
    ];
  },

  mix: (color1, color2, ratio = 0.5) => {
    const rgb1 = functions.toRgb(color1);
    const rgb2 = functions.toRgb(color2);
    if (!rgb1 || !rgb2) return null;
    const r = Math.round(rgb1.r * (1 - ratio) + rgb2.r * ratio);
    const g = Math.round(rgb1.g * (1 - ratio) + rgb2.g * ratio);
    const b = Math.round(rgb1.b * (1 - ratio) + rgb2.b * ratio);
    return functions.toHex({ r, g, b });
  },

  grayscale: (color) => {
    const rgb = functions.toRgb(color);
    if (!rgb) return null;
    const gray = Math.round(0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b);
    return functions.toHex({ r: gray, g: gray, b: gray });
  },

  blend: (color1, color2, mode = 'multiply') => {
    const rgb1 = functions.toRgb(color1);
    const rgb2 = functions.toRgb(color2);
    if (!rgb1 || !rgb2) return null;
    
    let r, g, b;
    switch (mode) {
      case 'multiply': r = rgb1.r * rgb2.r / 255; g = rgb1.g * rgb2.g / 255; b = rgb1.b * rgb2.b / 255; break;
      case 'screen': r = 255 - (255 - rgb1.r) * (255 - rgb2.r) / 255; g = 255 - (255 - rgb1.g) * (255 - rgb2.g) / 255; b = 255 - (255 - rgb1.b) * (255 - rgb2.b) / 255; break;
      case 'overlay': r = overlayComponent(rgb1.r, rgb2.r); g = overlayComponent(rgb1.g, rgb2.g); b = overlayComponent(rgb1.b, rgb2.b); break;
      default: return functions.mix(color1, color2);
    }
    return functions.toHex({ r: Math.round(r), g: Math.round(g), b: Math.round(b) });
  },

  contrast: (color1, color2) => {
    const rgb1 = functions.toRgb(color1);
    const rgb2 = functions.toRgb(color2);
    if (!rgb1 || !rgb2) return null;
    return {
      ratio: calculateContrastRatio(rgb1, rgb2),
      passesWCAG: calculateContrastRatio(rgb1, rgb2) >= 4.5
    };
  },

  isLight: (color) => {
    const rgb = functions.toRgb(color);
    if (!rgb) return null;
    const brightness = (rgb.r * 299 + rgb.g * 587 + rgb.b * 114) / 1000;
    return brightness > 128;
  },

  generatePalette: (baseColor, count = 5) => {
    const hsl = functions.toHsl(baseColor);
    if (!hsl) return null;
    const palette = [];
    for (let i = 0; i < count; i++) {
      const shade = (i + 1) * (100 / (count + 1));
      palette.push(hslToHex(hsl.h, hsl.s, shade));
    }
    return palette;
  }
};

function parseHex(hex) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (result) {
    return { r: parseInt(result[1], 16), g: parseInt(result[2], 16), b: parseInt(result[3], 16), a: 1 };
  }
  const short = /^#?([a-f\d])([a-f\d])([a-f\d])$/i.exec(hex);
  if (short) {
    return { r: parseInt(short[1] + short[1], 16), g: parseInt(short[2] + short[2], 16), b: parseInt(short[3] + short[3], 16), a: 1 };
  }
  return null;
}

function parseRgb(str) {
  const match = str.match(/rgba?\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+))?\s*\)/);
  if (match) {
    return { r: parseInt(match[1]), g: parseInt(match[2]), b: parseInt(match[3]), a: match[4] ? parseFloat(match[4]) : 1 };
  }
  return null;
}

function parseHsl(str) {
  const match = str.match(/hsla?\s*\(\s*(\d+)\s*,\s*(\d+)%?\s*,\s*(\d+)%?\s*(?:,\s*([\d.]+))?\s*\)/);
  if (match) {
    return { h: parseInt(match[1]), s: parseInt(match[2]), l: parseInt(match[3]), a: match[4] ? parseFloat(match[4]) : 1 };
  }
  return null;
}

function parseHsv(str) {
  return null;
}

function parseName(name) {
  const namedColors = {
    'red': '#FF0000', 'green': '#008000', 'blue': '#0000FF',
    'white': '#FFFFFF', 'black': '#000000', 'yellow': '#FFFF00',
    'cyan': '#00FFFF', 'magenta': '#FF00FF', 'orange': '#FFA500'
  };
  return namedColors[name.toLowerCase()] ? parseHex(namedColors[name.toLowerCase()]) : null;
}

function rgbToHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h, s, l = (max + min) / 2;
  if (max === min) { h = s = 0; }
  else {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }
  return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
}

function hslToHex(h, s, l) {
  s /= 100; l /= 100;
  const a = s * Math.min(l, 1 - l);
  const f = n => {
    const k = (n + h / 30) % 12;
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color).toString(16).padStart(2, '0');
  };
  return '#' + f(0) + f(8) + f(4);
}

function rgbToHsv(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h, s, v = max;
  const d = max - min;
  s = max === 0 ? 0 : d / max;
  if (max === min) { h = 0; }
  else {
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h /= 6;
  }
  return { h: Math.round(h * 360), s: Math.round(s * 100), v: Math.round(v * 100) };
}

function overlayComponent(a, b) {
  return a < 128 ? (2 * a * b / 255) : (255 - 2 * (255 - a) * (255 - b) / 255);
}

function calculateContrastRatio(rgb1, rgb2) {
  const lum1 = (0.299 * rgb1.r + 0.587 * rgb1.g + 0.114 * rgb1.b) / 255;
  const lum2 = (0.299 * rgb2.r + 0.587 * rgb2.g + 0.114 * rgb2.b) / 255;
  const lighter = Math.max(lum1, lum2);
  const darker = Math.min(lum1, lum2);
  return (lighter + 0.05) / (darker + 0.05);
}

export default { manifest, init, activate, deactivate, functions };
