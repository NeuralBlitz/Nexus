import assert from 'node:assert/strict';
import test from 'node:test';
import { createServer } from 'node:http';
import { once } from 'node:events';
import express from 'express';
import WebSocket, { WebSocketServer } from 'ws';
import { mountNexusNetworkSecurity } from './network-entry.js';

const KEY = 'test-Nexus-perimeter-key-of-adequate-length';
async function fixture() {
  const app = express();
  const server = createServer(app);
  const wss = new WebSocketServer({ noServer: true });
  mountNexusNetworkSecurity(app, server, wss);
  app.get('/api/probe', (_req, res) => res.json({ ok: true }));
  wss.on('connection', ws => ws.send('ready'));
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const origin = 'http://127.0.0.1:' + server.address().port;
  return {
    origin, wss, server,
    async close() {
      for (const client of wss.clients) client.terminate();
      await new Promise(resolve => wss.close(resolve));
      await new Promise(resolve => server.close(resolve));
    }
  };
}

test('real HTTP API route denies unauthorized requests and accepts a header key', async () => {
  const previous = process.env.NEXUS_API_KEY;
  process.env.NEXUS_API_KEY = KEY;
  const env = await fixture();
  try {
    const denied = await fetch(env.origin + '/api/probe');
    assert.equal(denied.status, 401);
    const accepted = await fetch(env.origin + '/api/probe', { headers: { 'x-api-key': KEY } });
    assert.equal(accepted.status, 200);
    assert.equal((await accepted.json()).ok, true);
  } finally {
    await env.close();
    if (previous === undefined) delete process.env.NEXUS_API_KEY;
    else process.env.NEXUS_API_KEY = previous;
  }
});

test('real WebSocket handshake rejects missing credentials and accepts a browser session cookie', async () => {
  const previous = process.env.NEXUS_API_KEY;
  process.env.NEXUS_API_KEY = KEY;
  const env = await fixture();
  try {
    const wsUrl = env.origin.replace(/^http:/, 'ws:');
    async function rejected(headers) {
      return new Promise((resolve, reject) => {
        const ws = new WebSocket(wsUrl, { headers });
        ws.on('unexpected-response', (_req, response) => {
          response.resume();
          resolve(response.statusCode);
        });
        ws.on('open', () => { ws.terminate(); reject(new Error('unexpected accepted handshake')); });
        ws.on('error', reject);
      });
    }
    assert.equal(await rejected({ Origin: env.origin }), 401);

    const session = await fetch(env.origin + '/auth/session', {
      method: 'POST',
      headers: { Origin: env.origin, 'x-api-key': KEY }
    });
    assert.equal(session.status, 204);
    const cookie = session.headers.get('set-cookie').split(';')[0];
    const ws = new WebSocket(wsUrl, { headers: { Origin: env.origin, Cookie: cookie } });
    const [message] = await once(ws, 'message');
    assert.equal(String(message), 'ready');
    ws.terminate();
    assert.equal(await rejected({ Origin: 'http://evil.example', Cookie: cookie }), 401);
  } finally {
    await env.close();
    if (previous === undefined) delete process.env.NEXUS_API_KEY;
    else process.env.NEXUS_API_KEY = previous;
  }
});
