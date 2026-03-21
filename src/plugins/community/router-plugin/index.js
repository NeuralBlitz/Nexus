export const manifest = {
  name: 'router-plugin',
  id: 'router-plugin',
  version: '1.0.0',
  description: 'HTTP routing utilities',
  author: 'NEXUS',
  main: 'index.js',
  permissions: []
};

let api;
const routes = new Map();

export async function init(context) {
  api = context;
  api.log('Router plugin initialized');
}

export async function activate(context) {
  api.log('Router plugin activated');
}

export function deactivate() {
  api.log('Router plugin deactivated');
}

function parseParams(pattern, path) {
  const paramNames = [];
  const regexStr = pattern.replace(/(:[\w]+)/g, (m) => { paramNames.push(m.slice(1)); return '([^/]+)'; });
  const regex = new RegExp(`^${regexStr}$`);
  const match = path.match(regex);
  if (!match) return null;
  const params = {};
  paramNames.forEach((name, i) => params[name] = match[i + 1];
  return params;
}

function matchRoute(method, path, router) {
  const key = `${method}:${path}`;
  const exact = router.get(key);
  if (exact) return { handler: exact, params: {} };

  for (const [routeKey, handler] of router) {
    const [routeMethod, routePath] = routeKey.split(':');
    if (routeMethod !== method) continue;
    const params = parseParams(routePath, path);
    if (params) return { handler, params };
  }
  return null;
}

export const functions = {
  createRouter: (name) => {
    const router = new Map();
    routes.set(name, router);
    return router;
  },

  getRouter: (name) => routes.get(name) || null,

  deleteRouter: (name) => routes.delete(name),

  addRoute: (routerName, method, pattern, handler) => {
    const router = routes.get(routerName);
    if (!router) return false;
    router.set(`${method}:${pattern}`, handler);
    return true;
  },

  get: (routerName, pattern, handler) => functions.addRoute(routerName, 'GET', pattern, handler),
  post: (routerName, pattern, handler) => functions.addRoute(routerName, 'POST', pattern, handler),
  put: (routerName, pattern, handler) => functions.addRoute(routerName, 'PUT', pattern, handler),
  patch: (routerName, pattern, handler) => functions.addRoute(routerName, 'PATCH', pattern, handler),
  delete: (routerName, pattern, handler) => functions.addRoute(routerName, 'DELETE', pattern, handler),
  head: (routerName, pattern, handler) => functions.addRoute(routerName, 'HEAD', pattern, handler),
  options: (routerName, pattern, handler) => functions.addRoute(routerName, 'OPTIONS', pattern, handler),

  match: (routerName, method, path) => {
    const router = routes.get(routerName);
    if (!router) return null;
    return matchRoute(method, path, router);
  },

  route: (routerName, method, path, req = {}) => {
    const router = routes.get(routerName);
    if (!router) return { error: 'Router not found' };
    const match = matchRoute(method, path, router);
    if (!match) return { error: 'Route not found' };
    try {
      return { success: true, result: match.handler({ ...req, params: match.params }) };
    } catch (e) {
      return { error: e.message };
    }
  },

  listRoutes: (routerName) => {
    const router = routes.get(routerName);
    if (!router) return [];
    return Array.from(router.entries()).map(([key, handler]) => {
      const [method, pattern] = key.split(':');
      return { method, pattern, handler: handler.name || 'anonymous' };
    });
  },

  removeRoute: (routerName, method, pattern) => {
    const router = routes.get(routerName);
    if (!router) return false;
    return router.delete(`${method}:${pattern}`);
  },

  group: (routerName, options = {}, fn) => {
    const router = routes.get(routerName);
    if (!router) return null;
    const prefix = options.prefix || '';
    const middleware = options.middleware || [];
    return { prefix, middleware, router };
  },

  resource: (routerName, base, controller) => {
    const router = routes.get(routerName);
    if (!router) return false;
    const actions = ['index', 'show', 'create', 'update', 'destroy'];
    const methods = { index: 'GET', show: 'GET', create: 'GET', update: 'PUT', destroy: 'DELETE' };
    const patterns = { index: '', show: '/:id', create: '/new', update: '/:id/edit', destroy: '/:id' };
    
    for (const action of actions) {
      if (controller[action]) {
        router.set(`${methods[action]}:${base}${patterns[action]}`, controller[action]);
      }
    }
    return true;
  },

  middleware: (handler) => handler
};

export default { manifest, init, activate, deactivate, functions };
