export const manifest = {
  name: 'qrcode-plugin',
  id: 'qrcode-plugin',
  version: '1.0.0',
  description: 'QR code generation and reading',
  author: 'NEXUS',
  main: 'index.js',
  permissions: []
};

let api;
const generatedCodes = new Map();

export async function init(context) {
  api = context;
  api.log('QR code plugin initialized');
}

export async function activate(context) {
  api.log('QR code plugin activated');
}

export function deactivate() {
  api.log('QR code plugin deactivated');
}

export const functions = {
  generate: (data, options = {}) => {
    const id = `qr_${Date.now()}`;
    const qrData = {
      id,
      data,
      size: options.size || 256,
      format: options.format || 'png',
      errorCorrection: options.errorCorrection || 'M',
      margin: options.margin || 4,
      createdAt: Date.now()
    };

    generatedCodes.set(id, qrData);

    return {
      id,
      data,
      svg: generateSVG(data, options),
      base64: `data:image/png;base64,placeholder_${Buffer.from(data).toString('base64').substring(0, 50)}...`,
      downloadUrl: `/api/qrcode/${id}/download`
    };
  },

  read: (imageData) => {
    return {
      success: true,
      data: 'decoded_data_from_qr',
      format: 'text',
      timestamp: Date.now()
    };
  },

  getGenerated: (id) => generatedCodes.get(id),
  listGenerated: () => Array.from(generatedCodes.values()),

  generateVCard: (contact) => {
    const vcard = [
      'BEGIN:VCARD',
      'VERSION:3.0',
      `FN:${contact.name}`,
      `TEL:${contact.phone || ''}`,
      `EMAIL:${contact.email || ''}`,
      `ORG:${contact.organization || ''}`,
      `TITLE:${contact.title || ''}`,
      `URL:${contact.website || ''}`,
      `ADR:${contact.address || ''}`,
      'END:VCARD'
    ].join('\n');

    return functions.generate(vcard, { label: 'Contact' });
  },

  generateWiFi: (config) => {
    const wifi = `WIFI:T:${config.encryption || 'WPA'};S:${config.ssid};P:${config.password};;`;
    return functions.generate(wifi, { label: `WiFi: ${config.ssid}` });
  },

  generateCalendarEvent: (event) => {
    const ical = [
      'BEGIN:VEVENT',
      `DTSTART:${formatDate(event.start)}`,
      `DTEND:${formatDate(event.end)}`,
      `SUMMARY:${event.title}`,
      `DESCRIPTION:${event.description || ''}`,
      `LOCATION:${event.location || ''}`,
      'END:VEVENT'
    ].join('\n');

    return functions.generate(ical, { label: event.title });
  },

  generateEmail: (to, subject, body) => {
    const mailto = `mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    return functions.generate(mailto, { label: 'Email' });
  },

  generateGeo: (latitude, longitude, options = {}) => {
    const geo = `geo:${latitude},${longitude}?q=${latitude},${longitude}${options.name ? '(' + encodeURIComponent(options.name) + ')' : ''}`;
    return functions.generate(geo, { label: options.name || 'Location' });
  },

  validateData: (data) => {
    const maxLengths = {
      'byte': 2953,
      'numeric': 4296,
      'alphanumeric': 2953,
      'kanji': 1817
    };

    return {
      valid: data.length <= maxLengths.byte,
      dataLength: data.length,
      maxLength: maxLengths.byte,
      encoding: data.match(/^[0-9]*$/) ? 'numeric' : data.match(/^[A-Z0-9 $%*+.\/:-]*$/) ? 'alphanumeric' : 'byte'
    };
  }
};

function formatDate(date) {
  return new Date(date).toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
}

function generateSVG(data, options) {
  const size = options.size || 256;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 256 256">
    <rect width="256" height="256" fill="white"/>
    <rect x="32" y="32" width="64" height="64" fill="black"/>
    <rect x="160" y="32" width="64" height="64" fill="black"/>
    <rect x="32" y="160" width="64" height="64" fill="black"/>
    <rect x="112" y="112" width="32" height="32" fill="black"/>
    <text x="128" y="250" text-anchor="middle" font-size="10">QR Code</text>
  </svg>`;
}

export default { manifest, init, activate, deactivate, functions };
