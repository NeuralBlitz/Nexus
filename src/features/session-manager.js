import { EventEmitter } from 'events';
import crypto from 'crypto';

export class Session {
  constructor(config) {
    this.id = config.id || crypto.randomBytes(32).toString('hex');
    this.userId = config.userId;
    this.data = config.data || {};
    this.createdAt = Date.now();
    this.lastAccessedAt = Date.now();
    this.expiresAt = config.expiresAt || (Date.now() + 86400000);
    this.ip = config.ip;
    this.userAgent = config.userAgent;
    this.active = true;
  }

  get(key) {
    this.touch();
    return this.data[key];
  }

  set(key, value) {
    this.touch();
    this.data[key] = value;
  }

  delete(key) {
    delete this.data[key];
  }

  touch() {
    this.lastAccessedAt = Date.now();
  }

  isExpired() {
    return Date.now() > this.expiresAt;
  }

  invalidate() {
    this.active = false;
  }
}

export class SessionStore {
  constructor(options = {}) {
    this.sessions = new Map();
    this.ttl = options.ttl || 86400000;
    this.cleanupInterval = options.cleanupInterval || 3600000;
    this.cleanupTimer = null;

    this.startCleanup();
  }

  create(config) {
    const session = new Session(config);
    this.sessions.set(session.id, session);
    return session;
  }

  get(sessionId) {
    const session = this.sessions.get(sessionId);
    if (!session) return null;
    if (session.isExpired()) {
      this.destroy(sessionId);
      return null;
    }
    session.touch();
    return session;
  }

  destroy(sessionId) {
    return this.sessions.delete(sessionId);
  }

  update(sessionId, data) {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.data = { ...session.data, ...data };
      session.touch();
    }
  }

  cleanup() {
    const now = Date.now();
    let cleaned = 0;

    for (const [id, session] of this.sessions) {
      if (session.isExpired() || !session.active) {
        this.sessions.delete(id);
        cleaned++;
      }
    }

    return cleaned;
  }

  startCleanup() {
    this.cleanupTimer = setInterval(() => {
      this.cleanup();
    }, this.cleanupInterval);
  }

  stopCleanup() {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
  }

  size() {
    return this.sessions.size;
  }
}

export class SessionManager extends EventEmitter {
  constructor(options = {}) {
    super();

    this.store = new SessionStore({
      ttl: options.ttl,
      cleanupInterval: options.cleanupInterval
    });

    this.cookieName = options.cookieName || 'nexus_session';
    this.cookieOptions = {
      httpOnly: options.httpOnly !== false,
      secure: options.secure || false,
      sameSite: options.sameSite || 'lax',
      path: '/'
    };

    this.middleware = this.middleware.bind(this);
  }

  create(req, config = {}) {
    const session = this.store.create({
      userId: config.userId,
      data: config.data || {},
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      expiresAt: config.expiresAt ? Date.now() + config.expiresAt : undefined
    });

    this.emit('session:created', session);
    return session;
  }

  get(req) {
    const sessionId = this.getSessionId(req);
    if (!sessionId) return null;

    const session = this.store.get(sessionId);
    if (session) {
      this.emit('session:accessed', session);
    }
    return session;
  }

  getSessionId(req) {
    if (req.cookies && req.cookies[this.cookieName]) {
      return req.cookies[this.cookieName];
    }
    if (req.headers['x-session-id']) {
      return req.headers['x-session-id'];
    }
    return null;
  }

  destroy(req) {
    const sessionId = this.getSessionId(req);
    if (sessionId) {
      this.store.destroy(sessionId);
      this.emit('session:destroyed', { sessionId });
      return true;
    }
    return false;
  }

  middleware() {
    return (req, res, next) => {
      const sessionId = this.getSessionId(req);

      if (sessionId) {
        req.session = this.store.get(sessionId);
      }

      if (!req.session) {
        req.session = this.create(req);
      }

      const originalEnd = res.end;
      res.end = function(...args) {
        if (req.session) {
          res.setHeader('Set-Cookie', `${this.sessionManager.cookieName}=${req.session.id}; Path=/; HttpOnly`);
        }
        return originalEnd.apply(this, args);
      }.bind({ sessionManager: this, cookieName: this.cookieName });

      next();
    };
  }

  regenerate(req, config = {}) {
    const oldSession = this.get(req);
    const newSession = this.create(req, {
      userId: oldSession?.userId,
      data: oldSession?.data
    });

    if (oldSession) {
      this.store.destroy(oldSession.id);
    }

    return newSession;
  }

  touch(req) {
    const session = this.get(req);
    if (session) {
      session.touch();
    }
  }

  getStats() {
    return {
      totalSessions: this.store.size(),
      cookieName: this.cookieName
    };
  }
}

let sessionManager = null;

export function getSessionManager(options = {}) {
  if (!sessionManager) {
    sessionManager = new SessionManager(options);
  }
  return sessionManager;
}

export default { SessionManager, SessionStore, Session, getSessionManager };
