export const manifest = {
  name: 'state-plugin',
  id: 'state-plugin',
  version: '1.0.0',
  description: 'State machine and state management',
  author: 'NEXUS',
  main: 'index.js',
  permissions: []
};

let api;
const machines = new Map();

export async function init(context) {
  api = context;
  api.log('State plugin initialized');
}

export async function activate(context) {
  api.log('State plugin activated');
}

export function deactivate() {
  api.log('State plugin deactivated');
}

class StateMachine {
  constructor(config) {
    this.id = config.id;
    this.states = new Set(config.states || []);
    this.initial = config.initial;
    this.current = config.initial;
    this.final = new Set(config.final || []);
    this.context = config.context || {};
    this.transitions = new Map();
    this.history = [{ state: config.initial, timestamp: Date.now() }];

    for (const transition of config.transitions || []) {
      this.addTransition(transition);
    }
  }

  addTransition(transition) {
    const { name, from, to, guard, action } = transition;
    if (!this.transitions.has(from)) this.transitions.set(from, []);
    this.transitions.get(from).push({ name, to, guard, action });
  }

  transition(event, payload = {}) {
    const transitions = this.transitions.get(this.current) || [];
    const transition = transitions.find(t => {
      if (typeof t.name === 'string') return t.name === event;
      return t.name.includes(event);
    });

    if (!transition) return { success: false, error: 'Invalid transition', current: this.current };

    if (transition.guard && !transition.guard(this.context, payload)) {
      return { success: false, error: 'Guard condition failed', current: this.current };
    }

    const from = this.current;
    if (transition.action) transition.action(this.context, payload);
    this.current = transition.to;
    this.history.push({ state: this.current, event, from, timestamp: Date.now() });

    return { success: true, from, to: this.current, event };
  }

  can(event) {
    const transitions = this.transitions.get(this.current) || [];
    return transitions.some(t => {
      if (typeof t.name === 'string') return t.name === event;
      return t.name.includes(event);
    });
  }

  isFinal() {
    return this.final.has(this.current);
  }

  getState() {
    return this.current;
  }

  setContext(ctx) {
    this.context = { ...this.context, ...ctx };
  }

  getContext() {
    return { ...this.context };
  }

  getHistory() {
    return [...this.history];
  }

  reset() {
    this.current = this.initial;
    this.context = {};
    this.history = [{ state: this.initial, timestamp: Date.now() }];
  }
}

export const functions = {
  create: (config) => {
    const id = config.id || `sm_${Date.now()}`;
    const machine = new StateMachine({ ...config, id });
    machines.set(id, machine);
    return { id, initial: machine.initial };
  },

  get: (id) => machines.get(id) || null,

  delete: (id) => machines.delete(id),

  transition: (id, event, payload) => {
    const machine = machines.get(id);
    if (!machine) return { success: false, error: 'Machine not found' };
    return machine.transition(event, payload);
  },

  can: (id, event) => {
    const machine = machines.get(id);
    return machine ? machine.can(event) : false;
  },

  state: (id) => {
    const machine = machines.get(id);
    return machine ? machine.getState() : null;
  },

  isFinal: (id) => {
    const machine = machines.get(id);
    return machine ? machine.isFinal() : null;
  },

  context: (id) => {
    const machine = machines.get(id);
    return machine ? machine.getContext() : null;
  },

  setContext: (id, ctx) => {
    const machine = machines.get(id);
    if (!machine) return false;
    machine.setContext(ctx);
    return true;
  },

  history: (id) => {
    const machine = machines.get(id);
    return machine ? machine.getHistory() : [];
  },

  reset: (id) => {
    const machine = machines.get(id);
    if (!machine) return false;
    machine.reset();
    return true;
  },

  availableTransitions: (id) => {
    const machine = machines.get(id);
    if (!machine) return [];
    const transitions = machine.transitions.get(machine.current) || [];
    return transitions.map(t => t.name);
  },

  onTransition: (id, callback) => {
    const machine = machines.get(id);
    if (!machine) return false;
    machine.onTransition = callback;
    return true;
  },

  presetOrderWorkflow: () => functions.create({
    initial: 'pending',
    states: ['pending', 'processing', 'shipped', 'delivered', 'cancelled'],
    final: ['delivered', 'cancelled'],
    transitions: [
      { name: 'process', from: 'pending', to: 'processing' },
      { name: 'ship', from: 'processing', to: 'shipped' },
      { name: 'deliver', from: 'shipped', to: 'delivered' },
      { name: 'cancel', from: 'pending', to: 'cancelled' }
    ]
  }),

  presetAuthWorkflow: () => functions.create({
    initial: 'logged_out',
    states: ['logged_out', 'pending', 'logged_in', 'suspended'],
    final: [],
    transitions: [
      { name: 'login', from: 'logged_out', to: 'pending' },
      { name: 'approve', from: 'pending', to: 'logged_in' },
      { name: 'reject', from: 'pending', to: 'logged_out' },
      { name: 'logout', from: 'logged_in', to: 'logged_out' },
      { name: 'suspend', from: 'logged_in', to: 'suspended' },
      { name: 'unsuspend', from: 'suspended', to: 'logged_in' }
    ]
  })
};

export default { manifest, init, activate, deactivate, functions };
