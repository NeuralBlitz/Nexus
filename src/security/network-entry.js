import { createBrowserSessions } from './browser-session.js';
import { requireNetworkAuthorization } from './network-gate.js';

/**
 * Install the production Nexus HTTP API and WebSocket perimeter.
 * Must be called before any /api route is registered.
 */
export function mountNexusNetworkSecurity(app, server, wss, { browserSessions = createBrowserSessions() } = {}) {
  app.post('/auth/session', browserSessions.login);
  app.get('/auth/status', browserSessions.status);
  app.post('/auth/logout', browserSessions.logout);
  app.use('/api', requireNetworkAuthorization);

  server.on('upgrade', (request, socket, head) => {
    const decision = browserSessions.authorizeUpgrade(request);
    if (!decision.allowed) {
      socket.end('HTTP/1.1 ' + decision.status
        + (decision.status === 503 ? ' Service Unavailable' : ' Unauthorized')
        + '\r\nConnection: close\r\n\r\n');
      return;
    }
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request);
    });
  });
  return browserSessions;
}
