export const manifest = {
  name: 'svg-plugin',
  id: 'svg-plugin',
  version: '1.0.0',
  description: 'SVG generation and manipulation',
  author: 'NEXUS',
  main: 'index.js',
  permissions: []
};

let api;

export async function init(context) {
  api = context;
  api.log('SVG plugin initialized');
}

export async function activate(context) {
  api.log('SVG plugin activated');
}

export function deactivate() {
  api.log('SVG plugin deactivated');
}

export const functions = {
  create: (options = {}) => {
    const { width = 200, height = 200, viewBox } = options;
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" ${viewBox ? `viewBox="${viewBox}"` : ''}></svg>`;
  },

  rect: (x, y, width, height, options = {}) => {
    const { fill = '#000', stroke, strokeWidth = 1, rx, ry, opacity } = options;
    return `<rect x="${x}" y="${y}" width="${width}" height="${height}" fill="${fill}" ${stroke ? `stroke="${stroke}" stroke-width="${strokeWidth}"` : ''} ${rx !== undefined ? `rx="${rx}"` : ''} ${ry !== undefined ? `ry="${ry}"` : ''} ${opacity !== undefined ? `opacity="${opacity}"` : ''}/>`;
  },

  circle: (cx, cy, r, options = {}) => {
    const { fill = '#000', stroke, strokeWidth = 1, opacity } = options;
    return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${fill}" ${stroke ? `stroke="${stroke}" stroke-width="${strokeWidth}"` : ''} ${opacity !== undefined ? `opacity="${opacity}"` : ''}/>`;
  },

  ellipse: (cx, cy, rx, ry, options = {}) => {
    const { fill = '#000', stroke, strokeWidth = 1, opacity } = options;
    return `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${fill}" ${stroke ? `stroke="${stroke}" stroke-width="${strokeWidth}"` : ''} ${opacity !== undefined ? `opacity="${opacity}"` : ''}/>`;
  },

  line: (x1, y1, x2, y2, options = {}) => {
    const { stroke = '#000', strokeWidth = 1, opacity } = options;
    return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${stroke}" stroke-width="${strokeWidth}" ${opacity !== undefined ? `opacity="${opacity}"` : ''}/>`;
  },

  polyline: (points, options = {}) => {
    const { fill = 'none', stroke = '#000', strokeWidth = 1, opacity } = options;
    return `<polyline points="${points.map(p => p.join(',')).join(' ')}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" ${opacity !== undefined ? `opacity="${opacity}"` : ''}/>`;
  },

  polygon: (points, options = {}) => {
    const { fill = '#000', stroke, strokeWidth = 1, opacity } = options;
    return `<polygon points="${points.map(p => p.join(',')).join(' ')}" fill="${fill}" ${stroke ? `stroke="${stroke}" stroke-width="${strokeWidth}"` : ''} ${opacity !== undefined ? `opacity="${opacity}"` : ''}/>`;
  },

  path: (d, options = {}) => {
    const { fill = 'none', stroke = '#000', strokeWidth = 1, opacity } = options;
    return `<path d="${d}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" ${opacity !== undefined ? `opacity="${opacity}"` : ''}/>`;
  },

  text: (content, x, y, options = {}) => {
    const { fontSize = 12, fontFamily = 'sans-serif', fill = '#000', textAnchor, fontWeight } = options;
    return `<text x="${x}" y="${y}" font-size="${fontSize}" font-family="${fontFamily}" fill="${fill}" ${textAnchor ? `text-anchor="${textAnchor}"` : ''} ${fontWeight ? `font-weight="${fontWeight}"` : ''}>${content}</text>`;
  },

  group: (elements, options = {}) => {
    const { transform, opacity } = options;
    return `<g ${transform ? `transform="${transform}"` : ''} ${opacity !== undefined ? `opacity="${opacity}"` : ''}>${elements.join('')}</g>`;
  },

  gradient: (id, stops, options = {}) => {
    const { type = 'linear', x1 = 0, y1 = 0, x2 = 1, y2 = 0 } = options;
    const tag = type === 'linear' ? 'linearGradient' : 'radialGradient';
    const attrs = type === 'linear' ? `x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"` : 'cx="0.5" cy="0.5" r="0.5"';
    const stopsStr = stops.map(([offset, color]) => `<stop offset="${offset}%" stop-color="${color}"/>`).join('');
    return `<${tag} id="${id}" ${attrs}>${stopsStr}</${tag}>`;
  },

  icon: (name, size = 24) => {
    const icons = {
      check: '<path d="M20 6L9 17l-5-5"/>',
      x: '<path d="M18 6L6 18M6 6l12 12"/>',
      plus: '<path d="M12 5v14M5 12h14"/>',
      minus: '<path d="M5 12h14"/>'
    };
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">${icons[name] || ''}</svg>`;
  },

  chart: (data, options = {}) => {
    const { width = 300, height = 200, type = 'bar' } = options;
    const max = Math.max(...data.map(d => d.value));
    const barWidth = width / data.length - 10;
    
    if (type === 'bar') {
      const bars = data.map((d, i) => {
        const barHeight = (d.value / max) * (height - 40);
        return `<rect x="${i * (barWidth + 10) + 5}" y="${height - 30 - barHeight}" width="${barWidth}" height="${barHeight}" fill="${d.color || '#3498db'}"/>`;
      }).join('');
      return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">${bars}</svg>`;
    }
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"></svg>`;
  }
};

export default { manifest, init, activate, deactivate, functions };
