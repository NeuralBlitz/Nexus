import assert from 'node:assert/strict';
import test from 'node:test';
import { createBrowserSessions } from './browser-session.js';

const KEY = 'browser-session-test-key-of-sufficient-length';
function request(headers = {}) {
  return { headers: { host: 'localhost:3000', origin: 'http://localhost:3000', ...headers } };
}
function response() {
  return {
    code: 0, headers: {}, body: null,
    setHeader(key, value) { this.headers[key] = value; },
    status(value) { this.code = value; return this; },
    json(body) { this.body = body; return this; },
    end() { return this; }
  };
}

test('browser session exchanges a valid header key for an HttpOnly cookie', () => {
  const original = process.env.NEXUS_API_KEY;
  try {
    process.env.NEXUS_API_KEY = KEY;
    const sessions = createBrowserSessions();
    const denied = response();
    sessions.login(request(), denied);
    assert.equal(denied.code, 401);
    const accepted = response();
    sessions.login(request({ 'x-api-key': KEY }), accepted);
    assert.equal(accepted.code, 204);
    assert.match(accepted.headers['Set-Cookie'], /HttpOnly; SameSite=Strict/);
  } finally {
    if (original === undefined) delete process.env.NEXUS_API_KEY;
    else process.env.NEXUS_API_KEY = original;
  }
});

test('session permits same-origin upgrades, expires, and never permits cross-origin use', () => {
  const original = process.env.NEXUS_API_KEY;
  let current = 1000;
  try {
    process.env.NEXUS_API_KEY = KEY;
    const sessions = createBrowserSessions({ now: () => current });
    const res = response();
    sessions.login(request({ 'x-api-key': KEY }), res);
    assert.equal(res.code, 204);
    assert.match(res.headers['Set-Cookie'], /HttpOnly; SameSite=Strict/);
    const cookie = res.headers['Set-Cookie'].split(';')[0];

    assert.equal(sessions.authorizeUpgrade(request({ cookie })).allowed, true);
    assert.equal(sessions.authorizeUpgrade(request({ cookie, origin: 'https://attacker.example' })).allowed, false);
    assert.equal(sessions.authorizeUpgrade(request({ cookie: cookie + '; ' + cookie })).allowed, false);
    assert.equal(sessions.authorizeUpgrade(request()).allowed, false);
    current += 60 * 60 * 1000 + 1;
    assert.equal(sessions.authorizeUpgrade(request({ cookie })).allowed, false);
  } finally {
    if (original === undefined) delete process.env.NEXUS_API_KEY;
    else process.env.NEXUS_API_KEY = original;
  }
});

test('session status and logout revoke a valid browser session', () => {
  const original = process.env.NEXUS_API_KEY;
  try {
    process.env.NEXUS_API_KEY = KEY;
    const sessions = createBrowserSessions();
    const login = response();
    sessions.login(request({ authorization: 'Bearer ' + KEY }), login);
    const cookie = login.headers['Set-Cookie'].split(';')[0];
    const status = response();
    sessions.status(request({ cookie }), status);
    assert.equal(status.code, 200);
    const loggedOut = response();
    sessions.logout(request({ cookie }), loggedOut);
    assert.equal(loggedOut.code, 204);
    assert.equal(sessions.authorizeUpgrade(request({ cookie })).allowed, false);
  } finally {
    if (original === undefined) delete process.env.NEXUS_API_KEY;
    else process.env.NEXUS_API_KEY = original;
  }
});

test('rejects cross-site session creation and remote HTTP browser origins', () => {
  const original = process.env.NEXUS_API_KEY;
  try {
    process.env.NEXUS_API_KEY = KEY;
    const sessions = createBrowserSessions();
    const cross = response();
    sessions.login(request({ origin: 'http://evil.example', 'x-api-key': KEY }), cross);
    assert.equal(cross.code, 403);
    const plain = response();
    sessions.login({ headers: { host: 'nexus.example', origin: 'http://nexus.example', 'x-api-key': KEY } }, plain);
    assert.equal(plain.code, 403);
    const secure = response();
    sessions.login({ headers: { host: 'nexus.example', origin: 'https://nexus.example', 'x-api-key': KEY } }, secure);
    assert.equal(secure.code, 204);
    assert.match(secure.headers['Set-Cookie'], /; Secure$/);
  } finally {
    if (original === undefined) delete process.env.NEXUS_API_KEY;
    else process.env.NEXUS_API_KEY = original;
  }
});
