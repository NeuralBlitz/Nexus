import { EventEmitter } from 'events';

export class ABTest {
  constructor(config) {
    this.id = config.id || `test_${Date.now()}`;
    this.name = config.name;
    this.description = config.description;
    this.variants = new Map();
    this.weights = [];
    this.status = 'draft';
    this.startedAt = null;
    this.endedAt = null;
    this.targeting = config.targeting || {};
    this.metrics = new Map();
  }

  addVariant(name, weight = 1, config = {}) {
    const variant = {
      name,
      weight,
      config,
      impressions: 0,
      conversions: 0,
      users: new Set()
    };

    this.variants.set(name, variant);
    this.recalculateWeights();
    return this;
  }

  recalculateWeights() {
    const total = Array.from(this.variants.values()).reduce((sum, v) => sum + v.weight, 0);
    this.weights = [];

    let cumulative = 0;
    for (const variant of this.variants.values()) {
      cumulative += variant.weight / total;
      this.weights.push(cumulative);
    }
  }

  selectVariant(userId) {
    const hash = this.hashUser(userId);
    let cumulative = 0;

    for (let i = 0; i < this.weights.length; i++) {
      cumulative += this.weights[i] / this.weights.length;
      if (hash < cumulative) {
        return Array.from(this.variants.keys())[i];
      }
    }

    return Array.from(this.variants.keys())[0];
  }

  hashUser(userId) {
    let hash = 0;
    const str = String(userId);
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash) + str.charCodeAt(i);
      hash |= 0;
    }
    return Math.abs(hash) / 2147483647;
  }

  assign(userId, variantName) {
    const variant = this.variants.get(variantName);
    if (!variant) return null;

    variant.users.add(userId);
    variant.impressions++;
    this.emit('assignment', { test: this.id, variant: variantName, userId });

    return variantName;
  }

  convert(userId, variantName, value = 1) {
    const variant = this.variants.get(variantName);
    if (!variant) return false;

    if (variant.users.has(userId)) {
      variant.conversions += value;
      this.emit('conversion', { test: this.id, variant: variantName, value });
      return true;
    }

    return false;
  }

  start() {
    this.status = 'running';
    this.startedAt = Date.now();
    this.emit('started', { test: this.id });
    return this;
  }

  stop() {
    this.status = 'ended';
    this.endedAt = Date.now();
    this.emit('stopped', { test: this.id });
    return this;
  }

  getResults() {
    const results = [];

    for (const [name, variant] of this.variants) {
      const rate = variant.impressions > 0
        ? (variant.conversions / variant.impressions * 100)
        : 0;

      results.push({
        variant: name,
        impressions: variant.impressions,
        conversions: variant.conversions,
        conversionRate: rate.toFixed(2) + '%',
        uniqueUsers: variant.users.size
      });
    }

    return {
      id: this.id,
      name: this.name,
      status: this.status,
      startedAt: this.startedAt,
      endedAt: this.endedAt,
      variants: results
    };
  }

  getWinner() {
    let winner = null;
    let bestRate = -1;

    for (const variant of this.variants.values()) {
      const rate = variant.impressions > 0 ? variant.conversions / variant.impressions : 0;
      if (rate > bestRate) {
        bestRate = rate;
        winner = variant;
      }
    }

    return winner ? winner.name : null;
  }
}

export class ABTestManager extends EventEmitter {
  constructor(options = {}) {
    super();
    this.tests = new Map();
    this.userAssignments = new Map();
  }

  createTest(config) {
    const test = new ABTest(config);
    this.tests.set(test.id, test);
    this.emit('test:created', test);
    return test;
  }

  getTest(testId) {
    return this.tests.get(testId);
  }

  getTestByName(name) {
    for (const test of this.tests.values()) {
      if (test.name === name) return test;
    }
    return null;
  }

  assignUser(testId, userId) {
    const test = this.tests.get(testId);
    if (!test || test.status !== 'running') return null;

    const assignmentKey = `${testId}:${userId}`;

    if (this.userAssignments.has(assignmentKey)) {
      return this.userAssignments.get(assignmentKey);
    }

    const variant = test.selectVariant(userId);
    test.assign(userId, variant);
    this.userAssignments.set(assignmentKey, variant);

    return variant;
  }

  recordConversion(testId, userId, value = 1) {
    const test = this.tests.get(testId);
    if (!test) return false;

    const assignmentKey = `${testId}:${userId}`;
    const variant = this.userAssignments.get(assignmentKey);
    if (!variant) return false;

    return test.convert(userId, variant, value);
  }

  listTests(status = null) {
    let tests = Array.from(this.tests.values());

    if (status) {
      tests = tests.filter(t => t.status === status);
    }

    return tests.map(t => ({
      id: t.id,
      name: t.name,
      status: t.status,
      variants: t.variants.size
    }));
  }

  getAllResults() {
    return Array.from(this.tests.values()).map(t => t.getResults());
  }

  archiveTest(testId) {
    const test = this.tests.get(testId);
    if (test) {
      test.stop();
      this.emit('test:archived', test);
    }
  }

  deleteTest(testId) {
    return this.tests.delete(testId);
  }
}

export class FeatureRollout {
  constructor(name, options = {}) {
    this.name = name;
    this.percentage = options.percentage || 0;
    this.enabled = options.enabled !== false;
    this.targets = new Set(options.targets || []);
    this.targetingRules = options.targetingRules || [];
    this.status = this.enabled && this.percentage > 0 ? 'active' : 'inactive';
  }

  isEnabled(userId = null) {
    if (!this.enabled) return false;
    if (this.targets.has(userId)) return true;
    if (this.targetingRules.length > 0 && userId) {
      return this.evaluateRules(userId);
    }
    if (this.percentage > 0) {
      return this.checkPercentage(userId);
    }
    return false;
  }

  checkPercentage(userId) {
    if (!userId) return Math.random() * 100 < this.percentage;

    let hash = 0;
    const str = `${this.name}:${userId}`;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash) + str.charCodeAt(i);
      hash |= 0;
    }

    return (Math.abs(hash) % 100) < this.percentage;
  }

  evaluateRules(userId) {
    for (const rule of this.targetingRules) {
      if (rule.type === 'userId') {
        if (rule.operator === 'in' && !rule.values.includes(userId)) {
          return false;
        }
      }
    }
    return true;
  }

  setPercentage(value) {
    this.percentage = Math.min(100, Math.max(0, value));
    this.status = this.percentage > 0 ? 'active' : 'inactive';
  }

  addTarget(userId) {
    this.targets.add(userId);
  }

  removeTarget(userId) {
    this.targets.delete(userId);
  }

  enable() {
    this.enabled = true;
    this.status = this.percentage > 0 ? 'active' : 'inactive';
  }

  disable() {
    this.enabled = false;
    this.status = 'inactive';
  }
}

export class FeatureManager extends EventEmitter {
  constructor() {
    super();
    this.features = new Map();
  }

  createFeature(name, options = {}) {
    const feature = new FeatureRollout(name, options);
    this.features.set(name, feature);
    this.emit('feature:created', feature);
    return feature;
  }

  getFeature(name) {
    return this.features.get(name);
  }

  isEnabled(featureName, userId = null) {
    const feature = this.features.get(featureName);
    return feature ? feature.isEnabled(userId) : false;
  }

  updateFeature(name, updates) {
    const feature = this.features.get(name);
    if (!feature) return null;

    if (updates.percentage !== undefined) {
      feature.setPercentage(updates.percentage);
    }
    if (updates.enabled !== undefined) {
      updates.enabled ? feature.enable() : feature.disable();
    }

    this.emit('feature:updated', feature);
    return feature;
  }

  listFeatures() {
    return Array.from(this.features.values()).map(f => ({
      name: f.name,
      percentage: f.percentage,
      enabled: f.enabled,
      status: f.status,
      targets: f.targets.size
    }));
  }

  deleteFeature(name) {
    return this.features.delete(name);
  }
}

let abTestManager = null;
let featureManager = null;

export function getABTestManager() {
  if (!abTestManager) {
    abTestManager = new ABTestManager();
  }
  return abTestManager;
}

export function getFeatureManager() {
  if (!featureManager) {
    featureManager = new FeatureManager();
  }
  return featureManager;
}

export default { ABTestManager, ABTest, FeatureManager, FeatureRollout, getABTestManager, getFeatureManager };
