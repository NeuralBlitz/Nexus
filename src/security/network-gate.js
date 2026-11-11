import { timingSafeEqual } from 'node:crypto';

/**
 * Bootstrap perimeter authorization for the Nexus HTTP API and WebSocket.
 * Denies all API/WS access unless NEXUS_API_KEY is provisioned.
 * This is a transport-level gate, not a replacement for RBAC or user sessions.
 */
export function authorizeNetworkRequest(request, configuredKey = process.env.NEXUS_API_KEY) {
  if (typeof configuredKey !== 'string' || configuredKey.length < 32) {
    return { allowed: false, status: 503, reason: 'Nexus API authentication is not configured' };
  }

  const headers = request?.headers ?? {};
  const direct = headers['x-api-key'];
  const authorization = headers.authorization;
  const bearer = typeof authorization === 'string' && /^Bearer\s+\S+$/i.test(authorization)
    ? authorization.replace(/^Bearer\s+/i, '')
    : undefined;
  const provided = typeof direct === 'string' ? direct : bearer;

  if (typeof provided !== 'string' || !provided) {
    return { allowed: false, status: 401, reason: 'API key required' };
  }

  const expected = Buffer.from(configuredKey, 'utf8');
  const received = Buffer.from(provided, 'utf8');
  if (expected.length !== received.length || !timingSafeEqual(expected, received)) {
    return { allowed: false, status: 401, reason: 'Invalid API key' };
  }
  return { allowed: true, status: 200 };
}

export function requireNetworkAuthorization(req, res, next) {
  const decision = authorizeNetworkRequest(req);
  if (!decision.allowed) {
    return res.status(decision.status).json({ error: decision.reason });
  }
  next();
}
