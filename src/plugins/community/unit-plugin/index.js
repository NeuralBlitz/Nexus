export const manifest = {
  name: 'unit-plugin',
  id: 'unit-plugin',
  version: '1.0.0',
  description: 'Unit conversion utilities',
  author: 'NEXUS',
  main: 'index.js',
  permissions: []
};

let api;

const conversions = {
  length: {
    m: 1, km: 1000, cm: 0.01, mm: 0.001, mi: 1609.344, yd: 0.9144, ft: 0.3048, in: 0.0254
  },
  weight: {
    kg: 1, g: 0.001, mg: 0.000001, lb: 0.453592, oz: 0.0283495, ton: 1000
  },
  temperature: {
    celsius: (v) => v, fahrenheit: (v) => (v - 32) * 5/9, kelvin: (v) => v - 273.15
  },
  volume: {
    l: 1, ml: 0.001, m3: 1000, gal: 3.78541, qt: 0.946353, pt: 0.473176, cup: 0.236588
  },
  speed: {
    ms: 1, kmh: 0.277778, mph: 0.44704, knot: 0.514444, fts: 0.3048
  },
  area: {
    m2: 1, km2: 1000000, cm2: 0.0001, mm2: 0.000001, mi2: 2589988.11, acre: 4046.86, hectare: 10000
  },
  time: {
    s: 1, ms: 0.001, min: 60, h: 3600, day: 86400, week: 604800, month: 2629746, year: 31556952
  },
  digital: {
    B: 1, KB: 1024, MB: 1048576, GB: 1073741824, TB: 1099511627776, bit: 0.125, Kbit: 128, Mbit: 131072
  }
};

export async function init(context) {
  api = context;
  api.log('Unit plugin initialized');
}

export async function activate(context) {
  api.log('Unit plugin activated');
}

export function deactivate() {
  api.log('Unit plugin deactivated');
}

export const functions = {
  convert: (value, from, to, category = 'length') => {
    if (category === 'temperature') {
      const celsius = conversions.temperature[from]?.(value) ?? value;
      const result = conversions.temperature[to] ? (to === 'celsius' ? celsius : (to === 'fahrenheit' ? celsius * 9/5 + 32 : celsius + 273.15)) : celsius;
      return { value, from, to, result: Math.round(result * 1000) / 1000 };
    }
    const fromFactor = conversions[category]?.[from];
    const toFactor = conversions[category]?.[to];
    if (!fromFactor || !toFactor) return { error: 'Invalid unit or category' };
    return { value, from, to, result: (value * fromFactor) / toFactor };
  },

  convertWeight: (value, from, to) => functions.convert(value, from, to, 'weight'),
  convertLength: (value, from, to) => functions.convert(value, from, to, 'length'),
  convertVolume: (value, from, to) => functions.convert(value, from, to, 'volume'),
  convertSpeed: (value, from, to) => functions.convert(value, from, to, 'speed'),
  convertArea: (value, from, to) => functions.convert(value, from, to, 'area'),
  convertTime: (value, from, to) => functions.convert(value, from, to, 'time'),
  convertDigital: (value, from, to) => functions.convert(value, from, to, 'digital'),

  convertTemperature: (value, from, to) => functions.convert(value, from, to, 'temperature'),

  formatDistance: (meters) => {
    if (meters < 1000) return `${Math.round(meters)} m`;
    if (meters < 10000) return `${(meters / 1000).toFixed(2)} km`;
    return `${(meters / 1609.344).toFixed(2)} mi`;
  },

  formatWeight: (kg) => {
    if (kg < 1) return `${Math.round(kg * 1000)} g`;
    if (kg < 100) return `${kg.toFixed(2)} kg`;
    return `${(kg * 2.20462).toFixed(2)} lb`;
  },

  formatData: (bytes) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(2)} KB`;
    if (bytes < 1073741824) return `${(bytes / 1048576).toFixed(2)} MB`;
    return `${(bytes / 1073741824).toFixed(2)} GB`;
  },

  formatDuration: (seconds) => {
    if (seconds < 60) return `${seconds}s`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
    return `${Math.floor(seconds / 86400)}d ${Math.floor((seconds % 86400) / 3600)}h`;
  },

  listCategories: () => Object.keys(conversions),
  listUnits: (category) => Object.keys(conversions[category] || {})
};

export default { manifest, init, activate, deactivate, functions };
