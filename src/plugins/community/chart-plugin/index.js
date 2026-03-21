export const manifest = {
  name: 'chart-plugin',
  id: 'chart-plugin',
  version: '1.0.0',
  description: 'Chart and graph generation',
  author: 'NEXUS',
  main: 'index.js',
  permissions: []
};

let api;

export async function init(context) {
  api = context;
  api.log('Chart plugin initialized');
}

export async function activate(context) {
  api.log('Chart plugin activated');
}

export function deactivate() {
  api.log('Chart plugin deactivated');
}

export const functions = {
  barChart: (data, options = {}) => {
    const { width = 600, height = 400, title, colors = ['#3498db', '#e74c3c', '#2ecc71', '#f1c40f', '#9b59b6'] } = options;
    const max = Math.max(...data.map(d => d.value));
    const barWidth = (width - 100) / data.length - 10;
    const bars = data.map((d, i) => {
      const barHeight = (d.value / max) * (height - 100);
      return `<rect x="${i * (barWidth + 10) + 50}" y="${height - 50 - barHeight}" width="${barWidth}" height="${barHeight}" fill="${d.color || colors[i % colors.length]}" rx="3">
        <title>${d.label}: ${d.value}</title>
      </rect>
      <text x="${i * (barWidth + 10) + 50 + barWidth/2}" y="${height - 30}" text-anchor="middle" font-size="12">${d.label}</text>
      <text x="${i * (barWidth + 10) + 50 + barWidth/2}" y="${height - 55 - barHeight}" text-anchor="middle" font-size="11">${d.value}</text>`;
    }).join('');
    
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
      ${title ? `<text x="${width/2}" y="30" text-anchor="middle" font-size="18" font-weight="bold">${title}</text>` : ''}
      ${bars}
      <line x1="50" y1="${height - 50}" x2="${width - 20}" y2="${height - 50}" stroke="#333" stroke-width="2"/>
    </svg>`;
  },

  lineChart: (data, options = {}) => {
    const { width = 600, height = 400, title, colors = ['#3498db', '#e74c3c', '#2ecc71'], smooth = false } = options;
    const allValues = data.flatMap(d => d.values);
    const max = Math.max(...allValues), min = Math.min(...allValues);
    const range = max - min || 1;
    
    const points = data.map((series, si) => {
      const pts = series.values.map((v, i) => {
        const x = 60 + (i / (series.values.length - 1 || 1)) * (width - 100);
        const y = height - 60 - ((v - min) / range) * (height - 100);
        return `${x},${y}`;
      });
      const pathD = smooth ? smoothPath(pts) : `M ${pts.join(' L ')}`;
      return `<path d="${pathD}" fill="none" stroke="${colors[si % colors.length]}" stroke-width="2"/>
              ${pts.map((p, i) => `<circle cx="${p.split(',')[0]}" cy="${p.split(',')[1]}" r="4" fill="${colors[si % colors.length]}">
                <title>${series.label}: ${series.values[i]}</title>
              </circle>`).join('')}`;
    });
    
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
      ${title ? `<text x="${width/2}" y="30" text-anchor="middle" font-size="18" font-weight="bold">${title}</text>` : ''}
      ${points.join('')}
    </svg>`;
  },

  pieChart: (data, options = {}) => {
    const { width = 400, height = 400, title, colors = ['#3498db', '#e74c3c', '#2ecc71', '#f1c40f', '#9b59b6', '#1abc9c'] } = options;
    const total = data.reduce((s, d) => s + d.value, 0);
    let currentAngle = -90;
    const slices = data.map((d, i) => {
      const angle = (d.value / total) * 360;
      const startAngle = currentAngle;
      const endAngle = currentAngle + angle;
      currentAngle = endAngle;
      const x1 = 200 + 150 * Math.cos(startAngle * Math.PI / 180);
      const y1 = 200 + 150 * Math.sin(startAngle * Math.PI / 180);
      const x2 = 200 + 150 * Math.cos(endAngle * Math.PI / 180);
      const y2 = 200 + 150 * Math.sin(endAngle * Math.PI / 180);
      const largeArc = angle > 180 ? 1 : 0;
      return `<path d="M200,200 L${x1},${y1} A150,150 0 ${largeArc},1 ${x2},${y2} Z" fill="${d.color || colors[i % colors.length]}">
        <title>${d.label}: ${d.value} (${((d.value/total)*100).toFixed(1)}%)</title>
      </path>`;
    }).join('');
    
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
      ${title ? `<text x="${width/2}" y="30" text-anchor="middle" font-size="18" font-weight="bold">${title}</text>` : ''}
      ${slices}
    </svg>`;
  },

  doughnutChart: (data, options = {}) => {
    const { width = 400, height = 400, title, innerRadius = 60, colors = ['#3498db', '#e74c3c', '#2ecc71', '#f1c40f', '#9b59b6'] } = options;
    const total = data.reduce((s, d) => s + d.value, 0);
    let currentAngle = -90;
    const slices = data.map((d, i) => {
      const angle = (d.value / total) * 360;
      const startAngle = currentAngle;
      const endAngle = currentAngle + angle;
      currentAngle = endAngle;
      const x1 = 200 + 150 * Math.cos(startAngle * Math.PI / 180);
      const y1 = 200 + 150 * Math.sin(startAngle * Math.PI / 180);
      const x2 = 200 + 150 * Math.cos(endAngle * Math.PI / 180);
      const y2 = 200 + 150 * Math.sin(endAngle * Math.PI / 180);
      const x3 = 200 + innerRadius * Math.cos(endAngle * Math.PI / 180);
      const y3 = 200 + innerRadius * Math.sin(endAngle * Math.PI / 180);
      const x4 = 200 + innerRadius * Math.cos(startAngle * Math.PI / 180);
      const y4 = 200 + innerRadius * Math.sin(startAngle * Math.PI / 180);
      const largeArc = angle > 180 ? 1 : 0;
      return `<path d="M${x1},${y1} A150,150 0 ${largeArc},1 ${x2},${y2} L${x3},${y3} A${innerRadius},${innerRadius} 0 ${largeArc},0 ${x4},${y4} Z" fill="${d.color || colors[i % colors.length]}">
        <title>${d.label}: ${d.value}</title>
      </path>`;
    }).join('');
    
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
      ${title ? `<text x="${width/2}" y="30" text-anchor="middle" font-size="18" font-weight="bold">${title}</text>` : ''}
      ${slices}
    </svg>`;
  },

  scatterPlot: (points, options = {}) => {
    const { width = 500, height = 400, title, color = '#3498db' } = options;
    const xs = points.map(p => p.x), ys = points.map(p => p.y);
    const maxX = Math.max(...xs), maxY = Math.max(...ys);
    const dots = points.map(p => {
      const cx = 50 + (p.x / maxX) * (width - 80);
      const cy = height - 50 - (p.y / maxY) * (height - 100);
      return `<circle cx="${cx}" cy="${cy}" r="5" fill="${p.color || color}" opacity="0.7">
        <title>(${p.x}, ${p.y})</title>
      </circle>`;
    }).join('');
    
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
      ${title ? `<text x="${width/2}" y="30" text-anchor="middle" font-size="18">${title}</text>` : ''}
      ${dots}
      <line x1="50" y1="${height - 50}" x2="${width - 30}" y2="${height - 50}" stroke="#333"/>
      <line x1="50" y1="${height - 50}" x2="50" y2="30" stroke="#333"/>
    </svg>`;
  }
};

function smoothPath(points) {
  if (points.length < 2) return `M ${points.join(' L ')}`;
  let d = `M ${points[0]}`;
  for (let i = 1; i < points.length; i++) {
    const [x1, y1] = points[i-1].split(',').map(Number);
    const [x2, y2] = points[i].split(',').map(Number);
    const cx = (x1 + x2) / 2, cy = (y1 + y2) / 2;
    d += ` Q ${x1},${y1} ${cx},${cy}`;
  }
  const last = points[points.length - 1].split(',');
  d += ` L ${last[0]},${last[1]}`;
  return d;
}

export default { manifest, init, activate, deactivate, functions };
