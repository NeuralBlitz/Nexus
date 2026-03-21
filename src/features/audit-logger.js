import { EventEmitter } from 'events';
import crypto from 'crypto';

export class AuditEvent {
  constructor(data) {
    this.id = `audit_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    this.timestamp = Date.now();
    this.action = data.action;
    this.resource = data.resource;
    this.resourceId = data.resourceId;
    this.userId = data.userId;
    this.userAgent = data.userAgent;
    this.ip = data.ip;
    this.changes = data.changes || {};
    this.metadata = data.metadata || {};
    this.severity = data.severity || 'info';
  }

  toJSON() {
    return {
      id: this.id,
      timestamp: this.timestamp,
      action: this.action,
      resource: this.resource,
      resourceId: this.resourceId,
      userId: this.userId,
      userAgent: this.userAgent,
      ip: this.ip,
      changes: this.changes,
      metadata: this.metadata,
      severity: this.severity
    };
  }
}

export class AuditLogger extends EventEmitter {
  constructor(options = {}) {
    super();

    this.store = options.store || new Map();
    this.maxEvents = options.maxEvents || 10000;
    this.retentionDays = options.retentionDays || 90;
    this.includeRequestBody = options.includeRequestBody !== false;
    this.sensitiveFields = new Set(options.sensitiveFields || ['password', 'token', 'secret', 'apiKey', 'creditCard']);

    this.stats = {
      totalEvents: 0,
      byAction: new Map(),
      byResource: new Map(),
      bySeverity: { info: 0, warning: 0, error: 0, critical: 0 }
    };
  }

  log(action, resource, resourceId, context = {}) {
    const event = new AuditEvent({
      action,
      resource,
      resourceId,
      userId: context.userId,
      userAgent: context.userAgent,
      ip: context.ip,
      changes: this.sanitizeData(context.changes),
      metadata: this.sanitizeData(context.metadata),
      severity: context.severity || 'info'
    });

    this.store.set(event.id, event);
    this.updateStats(event);
    this.pruneOldEvents();

    this.emit('audit', event);
    return event;
  }

  sanitizeData(data) {
    if (!data) return {};

    const sanitized = {};
    for (const [key, value] of Object.entries(data)) {
      if (this.sensitiveFields.has(key.toLowerCase())) {
        sanitized[key] = '[REDACTED]';
      } else if (typeof value === 'object' && value !== null) {
        sanitized[key] = this.sanitizeData(value);
      } else {
        sanitized[key] = value;
      }
    }
    return sanitized;
  }

  updateStats(event) {
    this.stats.totalEvents++;

    const actionCount = this.stats.byAction.get(event.action) || 0;
    this.stats.byAction.set(event.action, actionCount + 1);

    const resourceCount = this.stats.byResource.get(event.resource) || 0;
    this.stats.byResource.set(event.resource, resourceCount + 1);

    if (this.stats.bySeverity[event.severity] !== undefined) {
      this.stats.bySeverity[event.severity]++;
    }
  }

  pruneOldEvents() {
    if (this.store.size <= this.maxEvents) return;

    const cutoff = Date.now() - (this.retentionDays * 24 * 60 * 60 * 1000);
    const toDelete = [];

    for (const [id, event] of this.store) {
      if (event.timestamp < cutoff) {
        toDelete.push(id);
      }
    }

    for (const id of toDelete) {
      this.store.delete(id);
    }
  }

  query(filters = {}) {
    const results = [];

    for (const event of this.store.values()) {
      let match = true;

      if (filters.action && event.action !== filters.action) match = false;
      if (filters.resource && event.resource !== filters.resource) match = false;
      if (filters.resourceId && event.resourceId !== filters.resourceId) match = false;
      if (filters.userId && event.userId !== filters.userId) match = false;
      if (filters.severity && event.severity !== filters.severity) match = false;
      if (filters.startTime && event.timestamp < filters.startTime) match = false;
      if (filters.endTime && event.timestamp > filters.endTime) match = false;

      if (match) results.push(event);
    }

    return results.sort((a, b) => b.timestamp - a.timestamp);
  }

  getStats() {
    return {
      ...this.stats,
      byAction: Object.fromEntries(this.stats.byAction),
      byResource: Object.fromEntries(this.stats.byResource),
      storeSize: this.store.size,
      maxEvents: this.maxEvents
    };
  }

  export(format = 'json') {
    const events = Array.from(this.store.values());

    if (format === 'csv') {
      const headers = ['id', 'timestamp', 'action', 'resource', 'resourceId', 'userId', 'ip', 'severity'];
      const rows = events.map(e => headers.map(h => e[h] || '').join(','));
      return [headers.join(','), ...rows].join('\n');
    }

    return events;
  }
}

export function createAuditMiddleware(auditLogger) {
  return (req, res, next) => {
    const originalSend = res.send;

    res.send = function(body) {
      if (req.method !== 'GET') {
        auditLogger.log(req.method, req.path, null, {
          userId: req.user?.id,
          userAgent: req.get('User-Agent'),
          ip: req.ip,
          metadata: {
            statusCode: res.statusCode,
            body: auditLogger.includeRequestBody ? req.body : undefined
          },
          severity: res.statusCode >= 400 ? 'warning' : 'info'
        });
      }

      return originalSend.call(this, body);
    };

    next();
  };
}

let auditLogger = null;

export function getAuditLogger(options = {}) {
  if (!auditLogger) {
    auditLogger = new AuditLogger(options);
  }
  return auditLogger;
}

export default { AuditLogger, AuditEvent, createAuditMiddleware, getAuditLogger };
