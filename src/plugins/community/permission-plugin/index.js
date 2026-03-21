export const manifest = {
  name: 'permission-plugin',
  id: 'permission-plugin',
  version: '1.0.0',
  description: 'Permission and access control',
  author: 'NEXUS',
  main: 'index.js',
  permissions: []
};

let api;
const roles = new Map();
const permissions = new Map();
const assignments = new Map();

export async function init(context) {
  api = context;
  initializeDefaults();
  api.log('Permission plugin initialized');
}

function initializeDefaults() {
  roles.set('admin', { name: 'admin', inherits: null, permissions: ['*'] });
  roles.set('user', { name: 'user', inherits: null, permissions: ['read'] });
  roles.set('guest', { name: 'guest', inherits: null, permissions: [] });
}

export async function activate(context) {
  api.log('Permission plugin activated');
}

export function deactivate() {
  api.log('Permission plugin deactivated');
}

function resolvePermissions(roleName, visited = new Set()) {
  if (visited.has(roleName)) return [];
  visited.add(roleName);
  
  const role = roles.get(roleName);
  if (!role) return [];
  
  let perms = [...role.permissions];
  if (role.inherits) perms = [...perms, ...resolvePermissions(role.inherits, visited)];
  return [...new Set(perms)];
}

export const functions = {
  createRole: (name, options = {}) => {
    const role = { name, inherits: options.inherits || null, permissions: options.permissions || [] };
    roles.set(name, role);
    return role;
  },

  getRole: (name) => roles.get(name),

  updateRole: (name, updates) => {
    const role = roles.get(name);
    if (!role) return null;
    Object.assign(role, updates);
    return role;
  },

  deleteRole: (name) => {
    if (['admin', 'user', 'guest'].includes(name)) return false;
    for (const [, r] of roles) { if (r.inherits === name) r.inherits = null; }
    return roles.delete(name);
  },

  listRoles: () => Array.from(roles.values()),

  assignRole: (userId, roleName) => {
    if (!roles.has(roleName)) return false;
    if (!assignments.has(userId)) assignments.set(userId, []);
    const userRoles = assignments.get(userId);
    if (!userRoles.includes(roleName)) userRoles.push(roleName);
    return true;
  },

  revokeRole: (userId, roleName) => {
    const userRoles = assignments.get(userId);
    if (!userRoles) return false;
    const index = userRoles.indexOf(roleName);
    if (index > -1) { userRoles.splice(index, 1); return true; }
    return false;
  },

  getUserRoles: (userId) => assignments.get(userId) || [],

  getUserPermissions: (userId) => {
    const userRoles = assignments.get(userId) || [];
    const allPerms = [];
    for (const role of userRoles) allPerms.push(...resolvePermissions(role));
    return [...new Set(allPerms)];
  },

  hasPermission: (userId, permission) => {
    const perms = functions.getUserPermissions(userId);
    if (perms.includes('*')) return true;
    if (perms.includes(permission)) return true;
    const parts = permission.split(':');
    for (let i = parts.length; i > 0; i--) {
      const wildcard = parts.slice(0, i).join(':') + ':*';
      if (perms.includes(wildcard)) return true;
    }
    return false;
  },

  grantPermission: (userId, permission) => {
    if (!assignments.has(userId)) assignments.set(userId, []);
    const user = assignments.get(userId);
    const permKey = `perm_${userId}_${permission}`;
    permissions.set(permKey, { userId, permission });
    return true;
  },

  revokePermission: (userId, permission) => {
    const permKey = `perm_${userId}_${permission}`;
    return permissions.delete(permKey);
  },

  can: (userId, action, resource) => functions.hasPermission(userId, `${action}:${resource}`),

  authorize: (userId, permission) => {
    if (!functions.hasPermission(userId, permission)) {
      throw new Error(`Unauthorized: ${permission}`);
    }
    return true;
  },

  filter: (userId, items, permissionKey = 'permission') => {
    return items.filter(item => functions.hasPermission(userId, item[permissionKey]));
  },

  sanitize: (userId, data, permissionMap = {}) => {
    const result = {};
    for (const [key, value] of Object.entries(data)) {
      const requiredPerm = permissionMap[key] || key;
      if (functions.hasPermission(userId, requiredPerm)) result[key] = value;
    }
    return result;
  }
};

export default { manifest, init, activate, deactivate, functions };
