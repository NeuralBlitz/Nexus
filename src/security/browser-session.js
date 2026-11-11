import { randomBytes } from 'node:crypto';
import { authorizeNetworkRequest } from './network-gate.js';

const COOKIE_NAME = 'nexus_ws_session';
const MAX_SESSIONS = 1024;
const SESSION_TTL_MS = 60 * 60 * 1000;

function isSameOrigin(request) {
  const origin = request?.headers?.origin;
  const host = request?.headers?.host;
  if (typeof origin !== 'string' || typeof host !== 'string') return false;
  try {
    const url = new URL(origin);
    if (!['http:', 'https:'].includes(url.protocol) || url.host !== host) return false;
    const hostname = url.hostname.toLowerCase();
    const loopback = ['localhost', '127.0.0.1', '[::1]'].includes(hostname);
    // Remote browser sessions require HTTPS at the ingress.
    return loopback || url.protocol === 'https:';
  } catch {
    return false;
  }
}

function readCookie(request) {
  const value = request?.headers?.cookie;
  if (typeof value !== 'string') return null;
  const matches = value.split(';').map((item) => item.trim())
    .filter((item) => item.startsWith(COOKIE_NAME + '='));
  if (matches.length !== 1) return null;
  return matches[0].slice(COOKIE_NAME.length + 1);
}

/**
 * In-memory, single-instance browser WebSocket sessions for an authenticated
 * operator. This is a bootstrap mechanism, not per-user identity or RBAC.
 */
export function createBrowserSessions({ now = Date.now, generateToken = () => randomBytes(32).toString('hex') } = {}) {
  const sessions = new Map();

  function getSession(request) {
    const token = readCookie(request);
    if (!token || !/^[a-f0-9]{64}$/.test(token)) return null;
    const expiry = sessions.get(token);
    if (expiry === undefined) return null;
    if (expiry <= now()) {
      sessions.delete(token);
      return null;
    }
    return { token, expiry };
  }

  function login(req, res) {
    if (!isSameOrigin(req)) return res.status(403).json({ error: 'Origin not permitted' });
    const decision = authorizeNetworkRequest(req);
    if (!decision.allowed) return res.status(decision.status).json({ error: decision.reason });

    const current = now();
    for (const [token, expiry] of sessions) {
      if (expiry <= current) sessions.delete(token);
    }
    while (sessions.size >= MAX_SESSIONS) sessions.delete(sessions.keys().next().value);

    const token = generateToken();
    if (!/^[a-f0-9]{64}$/.test(token)) throw new Error('Invalid session token generator');
    sessions.set(token, current + SESSION_TTL_MS);

    const origin = new URL(req.headers.origin);
    const secure = origin.protocol === 'https:' ? '; Secure' : '';
    res.setHeader('Set-Cookie', COOKIE_NAME + '=' + token
      + '; HttpOnly; SameSite=Strict; Path=/; Max-Age=3600' + secure);
    res.setHeader('Cache-Control', 'no-store');
    return res.status(204).end();
  }

  function status(req, res) {
    const valid = isSameOrigin(req) && getSession(req) !== null;
    res.setHeader('Cache-Control', 'no-store');
    return res.status(valid ? 200 : 401).json({ authenticated: valid });
  }

  function logout(req, res) {
    if (!isSameOrigin(req)) return res.status(403).json({ error: 'Origin not permitted' });
    const session = getSession(req);
    if (session) sessions.delete(session.token);
    res.setHeader('Set-Cookie', COOKIE_NAME + '=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0');
    return res.status(204).end();
  }

  function authorizeUpgrade(request) {
    const keyDecision = authorizeNetworkRequest(request);
    if (keyDecision.allowed && (!request.headers?.origin || isSameOrigin(request))) return keyDecision;
    if (isSameOrigin(request) && getSession(request)) return { allowed: true, status: 200 };
    // Preserve the 503 fail-closed state if no API key is configured.
    return keyDecision.status === 503 ? keyDecision : { allowed: false, status: 401, reason: 'Unauthorized WebSocket upgrade' };
  }

  return { login, status, logout, authorizeUpgrade };
}
