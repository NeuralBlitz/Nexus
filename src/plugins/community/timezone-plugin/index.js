export const manifest = {
  name: 'time-plugin',
  id: 'time-plugin',
  version: '1.0.0',
  description: 'Time zone and timezone utilities',
  author: 'NEXUS',
  main: 'index.js',
  permissions: []
};

let api;

const timezones = {
  UTC: 0, EST: -5, CST: -6, MST: -7, PST: -8,
  JST: 9, KST: 9, IST: 5.5, GMT: 0, CET: 1, EET: 2,
  AEST: 10, NZST: 12
};

export async function init(context) {
  api = context;
  api.log('Time plugin initialized');
}

export async function activate(context) {
  api.log('Time plugin activated');
}

export function deactivate() {
  api.log('Time plugin deactivated');
}

export const functions = {
  now: (tz = 'UTC') => {
    const date = new Date();
    return { iso: date.toISOString(), unix: date.getTime(), timezone: tz };
  },

  toTimezone: (date, fromTz, toTz) => {
    const d = new Date(date);
    const offset = (timezones[toTz] - timezones[fromTz]) * 3600000;
    const converted = new Date(d.getTime() + offset);
    return converted.toISOString();
  },

  convert: (date, fromTz, toTz) => functions.toTimezone(date, fromTz, toTz),

  getOffset: (tz) => timezones[tz] !== undefined ? timezones[tz] : null,

  setOffset: (tz, offset) => { timezones[tz] = offset; return { set: true }; },

  listTimezones: () => Object.keys(timezones),

  getTimeInZone: (tz) => {
    const date = new Date();
    const offset = timezones[tz] || 0;
    const local = new Date(date.getTime() + offset * 3600000);
    return {
      timezone: tz,
      offset: offset,
      hour: local.getUTCHours(),
      minute: local.getUTCMinutes(),
      second: local.getUTCSeconds(),
      time: local.toISOString()
    };
  },

  isDST: (tz, date = new Date()) => {
    const jan = new Date(date.getFullYear(), 0, 1);
    const jul = new Date(date.getFullYear(), 6, 1);
    const stdOffset = Math.max(jan.getTimezoneOffset(), jul.getTimezoneOffset());
    return date.getTimezoneOffset() < stdOffset;
  },

  nextDST: (tz, year = new Date().getFullYear()) => {
    return { date: `${year}-03-14T02:00:00`, offset: timezones[tz] };
  },

  timeUntil: (targetDate, fromDate = new Date()) => {
    const target = new Date(targetDate);
    const diff = target - new Date(fromDate);
    const days = Math.floor(diff / 86400000);
    const hours = Math.floor((diff % 86400000) / 3600000);
    const minutes = Math.floor((diff % 3600000) / 60000);
    const seconds = Math.floor((diff % 60000) / 1000);
    return { days, hours, minutes, seconds, total: diff };
  },

  age: (birthdate) => {
    const birth = new Date(birthdate);
    const now = new Date();
    let years = now.getFullYear() - birth.getFullYear();
    const monthDiff = now.getMonth() - birth.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < birth.getDate())) years--;
    const months = (now.getMonth() + 12 - birth.getMonth()) % 12;
    const days = Math.floor((now - new Date(now.getFullYear(), birth.getMonth(), birth.getDate())) / 86400000);
    return { years, months, days, total: Math.floor((now - birth) / 86400000) };
  },

  isWeekend: (date, tz = 'UTC') => {
    const d = new Date(date);
    const day = d.getDay();
    return day === 0 || day === 6;
  },

  isBusinessDay: (date, holidays = []) => {
    const d = new Date(date);
    const day = d.getDay();
    if (day === 0 || day === 6) return false;
    return !holidays.includes(d.toISOString().split('T')[0]);
  },

  addBusinessDays: (date, days, holidays = []) => {
    let result = new Date(date);
    let added = 0;
    while (added < days) {
      result.setDate(result.getDate() + 1);
      if (functions.isBusinessDay(result, holidays)) added++;
    }
    return result.toISOString();
  },

  startOfWeek: (date, weekStartsOn = 0) => {
    const d = new Date(date);
    const day = d.getDay();
    const diff = (day < weekStartsOn ? 7 : 0) + day - weekStartsOn;
    d.setDate(d.getDate() - diff);
    return d.toISOString().split('T')[0];
  },

  endOfWeek: (date, weekStartsOn = 0) => {
    const start = new Date(functions.startOfWeek(date, weekStartsOn));
    start.setDate(start.getDate() + 6);
    return start.toISOString().split('T')[0];
  },

  weekNumber: (date) => {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + 4 - (d.getDay() || 7));
    const yearStart = new Date(d.getFullYear(), 0, 1);
    return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  },

  quarter: (date) => Math.ceil((new Date(date).getMonth() + 1) / 3),

  dayOfYear: (date) => {
    const start = new Date(new Date(date).getFullYear(), 0, 0);
    const diff = new Date(date) - start;
    return Math.floor(diff / 86400000);
  }
};

export default { manifest, init, activate, deactivate, functions };
