export const manifest = {
  name: 'date-plugin',
  id: 'date-plugin',
  version: '1.0.0',
  description: 'Date and time utilities',
  author: 'NEXUS',
  main: 'index.js',
  permissions: []
};

let api;

export async function init(context) {
  api = context;
  api.log('Date plugin initialized');
}

export async function activate(context) {
  api.log('Date plugin activated');
}

export function deactivate() {
  api.log('Date plugin deactivated');
}

export const functions = {
  now: () => new Date().toISOString(),
  
  format: (date, format) => {
    const d = new Date(date);
    const tokens = {
      'YYYY': d.getFullYear(),
      'MM': String(d.getMonth() + 1).padStart(2, '0'),
      'DD': String(d.getDate()).padStart(2, '0'),
      'HH': String(d.getHours()).padStart(2, '0'),
      'mm': String(d.getMinutes()).padStart(2, '0'),
      'ss': String(d.getSeconds()).padStart(2, '0'),
      'SSS': String(d.getMilliseconds()).padStart(3, '0')
    };
    return format.replace(/YYYY|MM|DD|HH|mm|ss|SSS/g, m => tokens[m]);
  },

  add: (date, amount, unit) => {
    const d = new Date(date);
    const units = { days: 'Date', months: 'Month', years: 'FullYear', hours: 'Hours', minutes: 'Minutes', seconds: 'Seconds' };
    const method = 'set' + units[unit];
    d[method](d['get' + units[unit]]() + amount);
    return d.toISOString();
  },

  diff: (date1, date2, unit = 'days') => {
    const d1 = new Date(date1), d2 = new Date(date2);
    const diff = Math.abs(d1 - d2);
    const units = { ms: 1, seconds: 1000, minutes: 60000, hours: 3600000, days: 86400000, weeks: 604800000, months: 2592000000 };
    return Math.floor(diff / (units[unit] || units.days));
  },

  startOf: (date, unit) => {
    const d = new Date(date);
    switch (unit) {
      case 'day': d.setHours(0, 0, 0, 0); break;
      case 'week': d.setDate(d.getDate() - d.getDay()); d.setHours(0, 0, 0, 0); break;
      case 'month': d.setDate(1); d.setHours(0, 0, 0, 0); break;
      case 'year': d.setMonth(0, 1); d.setHours(0, 0, 0, 0); break;
    }
    return d.toISOString();
  },

  endOf: (date, unit) => {
    const d = new Date(date);
    switch (unit) {
      case 'day': d.setHours(23, 59, 59, 999); break;
      case 'week': d.setDate(d.getDate() + (6 - d.getDay())); d.setHours(23, 59, 59, 999); break;
      case 'month': d.setMonth(d.getMonth() + 1, 0); d.setHours(23, 59, 59, 999); break;
      case 'year': d.setMonth(11, 31); d.setHours(23, 59, 59, 999); break;
    }
    return d.toISOString();
  },

  isWeekend: (date) => {
    const d = new Date(date);
    return d.getDay() === 0 || d.getDay() === 6;
  },

  isLeapYear: (year) => {
    return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
  },

  daysInMonth: (year, month) => {
    return new Date(year, month + 1, 0).getDate();
  },

  businessDays: (start, end) => {
    let count = 0;
    const startDate = new Date(start);
    const endDate = new Date(end);
    const current = new Date(startDate);
    while (current <= endDate) {
      if (current.getDay() !== 0 && current.getDay() !== 6) count++;
      current.setDate(current.getDate() + 1);
    }
    return count;
  }
};

export default { manifest, init, activate, deactivate, functions };
