export const manifest = {
  name: 'flag-plugin',
  id: 'flag-plugin',
  version: '1.0.0',
  description: 'Feature flags management',
  author: 'NEXUS',
  main: 'index.js',
  permissions: []
};

let api;
const flags = new Map();
const overrides = new Map();

export async function init(context) {
  api = context;
  api.log('Flag plugin initialized');
}

export async function activate(context) {
  api.log('Flag plugin activated');
}

export function deactivate() {
  api.log('Flag plugin deactivated');
}

function evaluateConditions(conditions, context) {
  if (!conditions || conditions.length === 0) return true;
  return conditions.every(cond => {
    const value = cond.field.split('.').reduce((obj, k) => obj?.[k], context);
    switch (cond.operator) {
      case 'equals': return value === cond.value;
      case 'notEquals': return value !== cond.value;
      case 'contains': return String(value).includes(cond.value);
      case 'in': return cond.value.includes(value);
      case 'gt': return Number(value) > Number(cond.value);
      case 'gte': return Number(value) >= Number(cond.value);
      case 'lt': return Number(value) < Number(cond.value);
      case 'lte': return Number(value) <= Number(cond.value);
      case 'exists': return cond.value ? value !== undefined : value === undefined;
      case 'matches': return new RegExp(cond.value).test(String(value));
      default: return true;
    }
  });
}

export const functions = {
  create: (name, options = {}) => {
    const flag = {
      name,
      enabled: options.enabled ?? false,
      defaultValue: options.defaultValue ?? false,
      description: options.description || '',
      conditions: options.conditions || [],
      variants: options.variants || null,
      rollout: options.rollout || 0,
      metadata: options.metadata || {},
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    flags.set(name, flag);
    return flag;
  },

  get: (name) => flags.get(name) || null,

  set: (name, options = {}) => {
    const flag = flags.get(name);
    if (!flag) return null;
    Object.assign(flag, options, { updatedAt: Date.now() });
    return flag;
  },

  delete: (name) => flags.delete(name),

  list: () => Array.from(flags.values()).map(f => ({ ...f })),

  enable: (name) => {
    const flag = flags.get(name);
    if (!flag) return false;
    flag.enabled = true;
    flag.updatedAt = Date.now();
    return true;
  },

  disable: (name) => {
    const flag = flags.get(name);
    if (!flag) return false;
    flag.enabled = false;
    flag.updatedAt = Date.now();
    return true;
  },

  toggle: (name) => {
    const flag = flags.get(name);
    if (!flag) return false;
    flag.enabled = !flag.enabled;
    flag.updatedAt = Date.now();
    return flag.enabled;
  },

  isEnabled: (name, context = {}) => {
    if (overrides.has(name)) return overrides.get(name);
    const flag = flags.get(name);
    if (!flag) return false;
    if (!flag.enabled) return false;
    if (flag.rollout > 0 && flag.rollout < 100) {
      const hash = (context.userId || context.sessionId || Math.random()).toString().split('').reduce((h, c) => ((h << 5) - h) + c.charCodeAt(0), 0);
      if ((Math.abs(hash) % 100) >= flag.rollout) return false;
    }
    return evaluateConditions(flag.conditions, context);
  },

  isDisabled: (name, context = {}) => !functions.isEnabled(name, context),

  getValue: (name, context = {}) => {
    const flag = flags.get(name);
    if (!flag) return flag?.defaultValue ?? null;
    if (flag.variants) return functions.isEnabled(name, context) ? flag.variants.on : flag.variants.off;
    return functions.isEnabled(name, context);
  },

  variant: (name, context = {}) => {
    const flag = flags.get(name);
    if (!flag || !flag.variants) return null;
    return functions.isEnabled(name, context) ? 'on' : 'off';
  },

  conditions: (name, conditions) => {
    const flag = flags.get(name);
    if (!flag) return false;
    flag.conditions = conditions;
    flag.updatedAt = Date.now();
    return true;
  },

  addCondition: (name, condition) => {
    const flag = flags.get(name);
    if (!flag) return false;
    flag.conditions.push(condition);
    flag.updatedAt = Date.now();
    return true;
  },

  rollout: (name, percentage) => {
    const flag = flags.get(name);
    if (!flag) return false;
    flag.rollout = Math.max(0, Math.min(100, percentage));
    flag.updatedAt = Date.now();
    return true;
  },

  override: (name, value) => {
    overrides.set(name, value);
    return true;
  },

  clearOverride: (name) => overrides.delete(name),

  clearAllOverrides: () => overrides.clear(),

  reset: (name) => {
    flags.delete(name);
    overrides.delete(name);
    return true;
  },

  clone: (from, to) => {
    const flag = flags.get(from);
    if (!flag) return null;
    return functions.create(to, { ...flag });
  },

  evaluate: (name, context) => ({
    enabled: functions.isEnabled(name, context),
    value: functions.getValue(name, context),
    variant: functions.variant(name, context)
  }),

  stats: () => {
    let enabled = 0, disabled = 0, withConditions = 0, withRollout = 0;
    for (const flag of flags.values()) {
      if (flag.enabled) enabled++; else disabled++;
      if (flag.conditions.length) withConditions++;
      if (flag.rollout > 0 && flag.rollout < 100) withRollout++;
    }
    return { total: flags.size, enabled, disabled, withConditions, withRollout, overrides: overrides.size };
  }
};

export default { manifest, init, activate, deactivate, functions };
