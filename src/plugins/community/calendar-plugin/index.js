export const manifest = {
  name: 'calendar-plugin',
  id: 'calendar-plugin',
  version: '1.0.0',
  description: 'Calendar management and scheduling',
  author: 'NEXUS',
  main: 'index.js',
  permissions: []
};

let api;
const events = new Map();
const calendars = new Map();

export async function init(context) {
  api = context;
  initializeDefaultCalendar();
  api.log('Calendar plugin initialized');
}

function initializeDefaultCalendar() {
  calendars.set('default', {
    id: 'default',
    name: 'Primary Calendar',
    color: '#3788d8',
    events: []
  });
}

export async function activate(context) {
  api.log('Calendar plugin activated');
}

export function deactivate() {
  api.log('Calendar plugin deactivated');
}

export const hooks = {
  'schedule:event': async (event, context) => {
    return scheduleEvent(event);
  }
};

export const functions = {
  createCalendar: (name, options = {}) => {
    const id = `cal_${Date.now()}`;
    const calendar = {
      id,
      name,
      color: options.color || '#3788d8',
      description: options.description || '',
      timezone: options.timezone || 'UTC',
      events: [],
      createdAt: Date.now()
    };
    calendars.set(id, calendar);
    return calendar;
  },
  getCalendar: (id) => calendars.get(id),
  listCalendars: () => Array.from(calendars.values()),
  deleteCalendar: (id) => {
    if (id === 'default') return { error: 'Cannot delete default calendar' };
    return calendars.delete(id);
  },
  scheduleEvent: (event) => {
    const id = `evt_${Date.now()}`;
    const fullEvent = {
      id,
      title: event.title,
      description: event.description || '',
      start: new Date(event.start).getTime(),
      end: new Date(event.end || event.start).getTime(),
      allDay: event.allDay || false,
      calendarId: event.calendarId || 'default',
      reminders: event.reminders || [],
      attendees: event.attendees || [],
      location: event.location || '',
      status: 'confirmed',
      createdAt: Date.now()
    };
    events.set(id, fullEvent);
    const calendar = calendars.get(fullEvent.calendarId);
    if (calendar) calendar.events.push(id);
    return fullEvent;
  },
  getEvent: (id) => events.get(id),
  updateEvent: (id, updates) => {
    const event = events.get(id);
    if (!event) return { error: 'Event not found' };
    Object.assign(event, updates);
    return event;
  },
  deleteEvent: (id) => events.delete(id),
  listEvents: (filters = {}) => {
    let result = Array.from(events.values());
    if (filters.calendarId) {
      result = result.filter(e => e.calendarId === filters.calendarId);
    }
    if (filters.start && filters.end) {
      const start = new Date(filters.start).getTime();
      const end = new Date(filters.end).getTime();
      result = result.filter(e => e.start >= start && e.start <= end);
    }
    return result.sort((a, b) => a.start - b.start);
  },
  getUpcoming: (days = 7) => {
    const now = Date.now();
    const future = now + (days * 24 * 60 * 60 * 1000);
    return functions.listEvents({ start: now, end: future });
  },
  checkConflicts: (start, end, calendarId = 'default') => {
    const startTime = new Date(start).getTime();
    const endTime = new Date(end).getTime();
    return functions.listEvents({ calendarId }).filter(e => {
      return (startTime < e.end && endTime > e.start);
    });
  }
};

export default { manifest, init, activate, deactivate, hooks, functions };
