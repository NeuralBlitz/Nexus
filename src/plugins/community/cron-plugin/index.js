export const manifest = {
  name: 'cron-plugin',
  id: 'cron-plugin',
  version: '1.0.0',
  description: 'Cron expression parsing and utilities',
  author: 'NEXUS',
  main: 'index.js',
  permissions: []
};

let api;
const jobs = new Map();

export async function init(context) {
  api = context;
  api.log('Cron plugin initialized');
}

export async function activate(context) {
  api.log('Cron plugin activated');
}

export function deactivate() {
  api.log('Cron plugin deactivated');
}

export const functions = {
  parse: (expression) => {
    const parts = expression.trim().split(/\s+/);
    if (parts.length < 5 || parts.length > 6) return { error: 'Invalid cron expression' };
    
    const [minute, hour, dayOfMonth, month, dayOfWeek, ...secondPart] = parts;
    const second = secondPart[0] || '0';
    
    return {
      expression,
      fields: { second, minute, hour, dayOfMonth, month, dayOfWeek },
      description: functions.describe(expression)
    };
  },

  describe: (expression) => {
    const parts = expression.trim().split(/\s+/);
    const [minute, hour, dayOfMonth, month, dayOfWeek] = parts;
    
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    
    let desc = 'Runs ';
    
    if (minute === '*') desc += 'every minute';
    else if (minute.includes('/')) desc += `every ${minute.split('/')[1]} minutes`;
    else desc += `at minute ${minute}`;
    
    if (hour !== '*') {
      if (hour.includes('/')) desc += ` every ${hour.split('/')[1]} hours`;
      else desc += ` at ${hour}:00`;
    }
    
    if (dayOfMonth !== '*') desc += ` on day ${dayOfMonth}`;
    if (month !== '*') desc += ` in ${months[parseInt(month) - 1] || month}`;
    if (dayOfWeek !== '*' && dayOfWeek !== '?') desc += ` on ${days[parseInt(dayOfWeek)] || dayOfWeek}`;
    
    return desc;
  },

  next: (expression, from = new Date(), count = 1) => {
    const parsed = functions.parse(expression);
    if (parsed.error) return [];
    
    const results = [];
    let current = new Date(from);
    
    while (results.length < count && current.getTime() < from.getTime() + 365 * 24 * 60 * 60 * 1000) {
      current.setMinutes(current.getMinutes() + 1);
      if (functions.matches(parsed.fields, current)) {
        results.push(new Date(current));
      }
    }
    
    return results;
  },

  matches: (fields, date) => {
    const second = date.getSeconds();
    const minute = date.getMinutes();
    const hour = date.getHours();
    const dayOfMonth = date.getDate();
    const month = date.getMonth() + 1;
    const dayOfWeek = date.getDay();
    
    return matchesField(fields.second, second) &&
           matchesField(fields.minute, minute) &&
           matchesField(fields.hour, hour) &&
           matchesField(fields.dayOfMonth, dayOfMonth) &&
           matchesField(fields.month, month) &&
           (fields.dayOfWeek === '*' || fields.dayOfWeek === '?' || matchesField(fields.dayOfWeek, dayOfWeek));
  },

  isValid: (expression) => !functions.parse(expression).error,

  schedule: (id, expression, fn) => {
    jobs.set(id, { expression, fn, interval: null });
    const scheduleNext = () => {
      const nextRuns = functions.next(expression, new Date(), 1);
      if (nextRuns.length > 0) {
        const delay = nextRuns[0].getTime() - Date.now();
        jobs.get(id).interval = setTimeout(() => {
          const job = jobs.get(id);
          if (job) { job.fn(); scheduleNext(); }
        }, Math.max(0, delay));
      }
    };
    scheduleNext();
    return { id, expression, scheduled: true };
  },

  cancel: (id) => {
    const job = jobs.get(id);
    if (job?.interval) clearTimeout(job.interval);
    return jobs.delete(id);
  },

  listJobs: () => Array.from(jobs.entries()).map(([id, job]) => ({ id, expression: job.expression })),

  common: {
    everyMinute: '* * * * *',
    every5Minutes: '*/5 * * * *',
    every15Minutes: '*/15 * * * *',
    every30Minutes: '*/30 * * * *',
    everyHour: '0 * * * *',
    everyDay: '0 0 * * *',
    everyWeek: '0 0 * * 0',
    everyMonth: '0 0 1 * *',
    everyYear: '0 0 1 1 *'
  }
};

function matchesField(field, value) {
  if (field === '*' || field === '?') return true;
  if (field.includes('/')) {
    const [range, step] = field.split('/');
    const start = range === '*' ? 0 : parseInt(range);
    return value >= start && (value - start) % parseInt(step) === 0;
  }
  if (field.includes(',')) return field.split(',').some(v => matchesField(v.trim(), value));
  if (field.includes('-')) {
    const [min, max] = field.split('-').map(Number);
    return value >= min && value <= max;
  }
  return parseInt(field) === value;
}

export default { manifest, init, activate, deactivate, functions };
