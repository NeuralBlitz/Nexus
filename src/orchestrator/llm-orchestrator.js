#!/usr/bin/env node

import { EventEmitter } from 'events';
import crypto from 'crypto';
import { ModelRegistry, getAllModelProfiles } from '../providers/model-registry.js';

// ═══════════════════════════════════════════════════════════════════════════
// LLM ORCHESTRATOR
// Intelligent model selection, routing, caching, batching, fallback chains
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Task categories for model selection
 */
export const TaskCategory = {
  CODE_GENERATION: 'code_generation',
  CODE_REVIEW: 'code_review',
  CODE_DEBUG: 'code_debug',
  TEXT_GENERATION: 'text_generation',
  ANALYSIS: 'analysis',
  RESEARCH: 'research',
  CREATIVE: 'creative',
  TRANSLATION: 'translation',
  SUMMARIZATION: 'summarization',
  CONVERSATION: 'conversation',
  CLASSIFICATION: 'classification',
  EXTRACTION: 'extraction',
  EMBEDDING: 'embedding',
  VISION: 'vision'
};

/**
 * Model capabilities
 */
export const ModelCapability = {
  CHAT: 'chat',
  COMPLETION: 'completion',
  CODE: 'code',
  VISION: 'vision',
  EMBEDDING: 'embedding',
  FUNCTION_CALLING: 'function_calling',
  STREAMING: 'streaming',
  LONG_CONTEXT: 'long_context'
};

/**
 * Model Profile
 */
export class ModelProfile {
  constructor(config) {
    this.id = config.id;
    this.name = config.name;
    this.provider = config.provider;
    this.version = config.version || '1.0';

    // Capabilities
    this.capabilities = config.capabilities || [ModelCapability.CHAT];

    // Performance metrics
    this.metrics = {
      avgLatency: config.avgLatency || 1000,
      throughput: config.throughput || 100, // tokens/sec
      successRate: config.successRate || 0.95,
      qualityScore: config.qualityScore || 0.8,
      costPerToken: config.costPerToken || 0.0001,
      ...config.metrics
    };

    // Limits
    this.limits = {
      maxTokens: config.maxTokens || 4096,
      contextWindow: config.contextWindow || 8192,
      requestsPerMinute: config.requestsPerMinute || 60,
      ...config.limits
    };

    // Supported categories
    this.supportedCategories = config.supportedCategories || [
      TaskCategory.TEXT_GENERATION,
      TaskCategory.CONVERSATION
    ];

    // Tags for matching
    this.tags = config.tags || [];

    // Enabled
    this.enabled = config.enabled !== false;
  }

  /**
   * Calculate score for a given task
   */
  scoreForTask(task) {
    let score = 0;

    // Category match
    if (task.category && this.supportedCategories.includes(task.category)) {
      score += 30;
    }

    // Capability match
    if (task.requiredCapabilities) {
      const matched = task.requiredCapabilities.filter(c => this.capabilities.includes(c));
      score += (matched.length / task.requiredCapabilities.length) * 30;
    }

    // Quality score
    score += this.metrics.qualityScore * 20;

    // Cost efficiency (lower is better)
    const costScore = Math.max(0, 1 - (this.metrics.costPerToken / 0.001));
    score += costScore * 10;

    // Latency preference (faster is better)
    const latencyScore = Math.max(0, 1 - (this.metrics.avgLatency / 5000));
    score += latencyScore * 10;

    return score;
  }

  /**
   * Can handle task
   */
  canHandle(task) {
    if (!this.enabled) return false;

    // Check context window
    if (task.estimatedTokens && task.estimatedTokens > this.limits.contextWindow) {
      return false;
    }

    // Check category
    if (task.category && !this.supportedCategories.includes(task.category)) {
      return false;
    }

    // Check capabilities
    if (task.requiredCapabilities) {
      const hasAll = task.requiredCapabilities.every(c => this.capabilities.includes(c));
      if (!hasAll) return false;
    }

    return true;
  }

  /**
   * To JSON
   */
  toJSON() {
    return {
      id: this.id,
      name: this.name,
      provider: this.provider,
      capabilities: this.capabilities,
      metrics: this.metrics,
      limits: this.limits,
      enabled: this.enabled
    };
  }
}

/**
 * Prompt Template
 */
export class PromptTemplate {
  constructor(config) {
    this.id = config.id || `template_${crypto.randomBytes(6).toString('hex')}`;
    this.name = config.name;
    this.category = config.category;
    this.systemPrompt = config.systemPrompt || '';
    this.template = config.template || '';
    this.variables = config.variables || [];
    this.outputFormat = config.outputFormat || 'text';

    // Metadata
    this.usageCount = 0;
    this.avgQuality = 0;
  }

  /**
   * Render template with variables
   */
  render(variables = {}) {
    let rendered = this.template;

    for (const [key, value] of Object.entries(variables)) {
      rendered = rendered.replace(new RegExp(`{{${key}}}`, 'g'), value);
    }

    return {
      system: this.systemPrompt,
      user: rendered
    };
  }

  /**
   * Record usage
   */
  recordUsage(quality = 0.8) {
    this.usageCount++;
    this.avgQuality = ((this.avgQuality * (this.usageCount - 1)) + quality) / this.usageCount;
  }
}

/**
 * Request Cache
 */
class RequestCache {
  constructor(options = {}) {
    this.cache = new Map();
    this.maxSize = options.maxSize || 1000;
    this.ttl = options.ttl || 3600000; // 1 hour
  }

  /**
   * Generate cache key
   */
  getKey(provider, model, messages, options) {
    const content = JSON.stringify({ provider, model, messages, options });
    return crypto.createHash('sha256').update(content).digest('hex');
  }

  /**
   * Get from cache
   */
  get(key) {
    const entry = this.cache.get(key);
    if (!entry) return null;

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    entry.hits++;
    return entry.value;
  }

  /**
   * Set in cache
   */
  set(key, value) {
    // Evict oldest if at capacity
    if (this.cache.size >= this.maxSize) {
      let oldestKey = null;
      let oldestTime = Infinity;

      for (const [k, entry] of this.cache) {
        if (entry.createdAt < oldestTime) {
          oldestTime = entry.createdAt;
          oldestKey = k;
        }
      }

      if (oldestKey) {
        this.cache.delete(oldestKey);
      }
    }

    this.cache.set(key, {
      value,
      createdAt: Date.now(),
      expiresAt: Date.now() + this.ttl,
      hits: 0
    });
  }

  /**
   * Clear cache
   */
  clear() {
    this.cache.clear();
  }

  /**
   * Get stats
   */
  getStats() {
    return {
      size: this.cache.size,
      maxSize: this.maxSize
    };
  }
}

/**
 * Request Batcher
 */
class RequestBatcher {
  constructor(options = {}) {
    this.batches = new Map();
    this.batchSize = options.batchSize || 10;
    this.batchDelay = options.batchDelay || 100;
    this.processors = new Map();
  }

  /**
   * Add request to batch
   */
  addToBatch(batchKey, request) {
    if (!this.batches.has(batchKey)) {
      this.batches.set(batchKey, []);
      setTimeout(() => this._processBatch(batchKey), this.batchDelay);
    }

    return new Promise((resolve, reject) => {
      this.batches.get(batchKey).push({ request, resolve, reject });

      if (this.batches.get(batchKey).length >= this.batchSize) {
        this._processBatch(batchKey);
      }
    });
  }

  /**
   * Process a batch
   */
  async _processBatch(batchKey) {
    const batch = this.batches.get(batchKey);
    if (!batch || batch.length === 0) return;

    this.batches.delete(batchKey);

    const processor = this.processors.get(batchKey);
    if (processor) {
      try {
        const results = await processor(batch.map(b => b.request));

        for (let i = 0; i < batch.length; i++) {
          batch[i].resolve(results[i]);
        }
      } catch (error) {
        for (const item of batch) {
          item.reject(error);
        }
      }
    } else {
      // No processor - reject all
      for (const item of batch) {
        item.reject(new Error('No batch processor'));
      }
    }
  }

  /**
   * Register batch processor
   */
  registerProcessor(batchKey, processor) {
    this.processors.set(batchKey, processor);
  }
}

/**
 * LLM Orchestrator
 */
export class LLMOrchestrator extends EventEmitter {
  constructor(options = {}) {
    super();

    // Model registry
    this.models = new Map();

    // Templates
    this.templates = new Map();

    // Cache
    this.cache = new RequestCache(options.cache);

    // Batcher
    this.batcher = new RequestBatcher(options.batcher);

    // Routing rules
    this.routingRules = [];

    // Statistics
    this.stats = {
      totalRequests: 0,
      cacheHits: 0,
      routingDecisions: {},
      avgLatency: 0,
      totalTokens: 0,
      totalCost: 0
    };

    // Fallback chain
    this.fallbackChain = options.fallbackChain || [];

    // Current provider adapters
    this.providers = new Map();
  }

  /**
   * Register a model
   */
  registerModel(modelConfig) {
    const model = modelConfig instanceof ModelProfile ? modelConfig : new ModelProfile(modelConfig);
    this.models.set(model.id, model);
    return model;
  }

  /**
   * Register a provider adapter
   */
  registerProvider(name, adapter) {
    this.providers.set(name, adapter);
  }

  /**
   * Register a template
   */
  registerTemplate(templateConfig) {
    const template = templateConfig instanceof PromptTemplate ? templateConfig : new PromptTemplate(templateConfig);
    this.templates.set(template.id, template);
    return template;
  }

  /**
   * Load all models from the model registry
   */
  loadModelRegistry() {
    const profiles = getAllModelProfiles();
    let loaded = 0;

    for (const profile of profiles) {
      const model = new ModelProfile(profile);
      this.models.set(model.id, model);
      loaded++;
    }

    this.emit('registry:loaded', { total: loaded });
    return loaded;
  }

  /**
   * Get all model IDs
   */
  listModels() {
    return Array.from(this.models.keys()).map(id => {
      const model = this.models.get(id);
      return { id, name: model.name, provider: model.provider, enabled: model.enabled };
    });
  }

  /**
   * Search models by query
   */
  searchModels(query) {
    const q = query.toLowerCase();
    return Object.values(ModelRegistry).filter(m =>
      m.name.toLowerCase().includes(q) ||
      m.id.toLowerCase().includes(q) ||
      m.provider.toLowerCase().includes(q)
    ).map(m => m.id);
  }

  /**
   * Get models by capability
   */
  getModelsByCapability(capability) {
    return Array.from(this.models.values())
      .filter(m => m.capabilities.includes(capability))
      .map(m => m.id);
  }

  /**
   * Get models by provider
   */
  getModelsByProvider(provider) {
    return Array.from(this.models.values())
      .filter(m => m.provider === provider)
      .map(m => m.id);
  }

  /**
   * Add routing rule
   */
  addRoutingRule(rule) {
    this.routingRules.push(rule);
  }

  /**
   * Analyze task and determine category
   */
  analyzeTask(task) {
    const text = typeof task === 'string' ? task : task.content || '';
    const lowerText = text.toLowerCase();

    // Category detection
    let category = TaskCategory.TEXT_GENERATION;
    let requiredCapabilities = [ModelCapability.CHAT];

    // Code-related
    if (lowerText.includes('function') || lowerText.includes('code') ||
        lowerText.includes('implement') || lowerText.includes('debug') ||
        lowerText.includes('class') || lowerText.includes('import')) {
      
      if (lowerText.includes('review') || lowerText.includes('analyze')) {
        category = TaskCategory.CODE_REVIEW;
      } else if (lowerText.includes('debug') || lowerText.includes('fix') || lowerText.includes('error')) {
        category = TaskCategory.CODE_DEBUG;
      } else {
        category = TaskCategory.CODE_GENERATION;
      }
      requiredCapabilities.push(ModelCapability.CODE);
    }

    // Analysis
    if (lowerText.includes('analyze') || lowerText.includes('compare') || lowerText.includes('evaluate')) {
      category = TaskCategory.ANALYSIS;
    }

    // Research
    if (lowerText.includes('research') || lowerText.includes('find') || lowerText.includes('search')) {
      category = TaskCategory.RESEARCH;
    }

    // Creative
    if (lowerText.includes('write a story') || lowerText.includes('creative') || lowerText.includes('poem')) {
      category = TaskCategory.CREATIVE;
    }

    // Summary
    if (lowerText.includes('summarize') || lowerText.includes('summary') || lowerText.includes('tldr')) {
      category = TaskCategory.SUMMARIZATION;
    }

    // Classification
    if (lowerText.includes('classify') || lowerText.includes('categorize') || lowerText.includes('label')) {
      category = TaskCategory.CLASSIFICATION;
    }

    // Estimate tokens
    const estimatedTokens = Math.ceil(text.length / 4);

    return {
      category,
      requiredCapabilities,
      estimatedTokens,
      text
    };
  }

  /**
   * Select best model for task
   */
  selectModel(task) {
    const analysis = typeof task === 'string' ? this.analyzeTask(task) : task;

    let bestModel = null;
    let bestScore = -1;

    const availableModels = Array.from(this.models.values()).filter(m => m.enabled);

    for (const model of availableModels) {
      if (!model.canHandle(analysis)) continue;

      const score = model.scoreForTask(analysis);

      if (score > bestScore) {
        bestScore = score;
        bestModel = model;
      }
    }

    // Apply routing rules
    for (const rule of this.routingRules) {
      if (rule.condition(analysis)) {
        const ruleModel = this.models.get(rule.modelId);
        if (ruleModel && ruleModel.canHandle(analysis)) {
          bestModel = ruleModel;
          bestScore = rule.priority > (rule.priority || 0) ? Infinity : bestScore;
        }
      }
    }

    // Track routing decision
    this.stats.routingDecisions[analysis.category] = (this.stats.routingDecisions[analysis.category] || 0) + 1;

    return {
      model: bestModel,
      score: bestScore,
      analysis
    };
  }

  /**
   * Complete a request
   */
  async complete(messages, options = {}) {
    const startTime = Date.now();
    this.stats.totalRequests++;

    // Analyze task
    const task = typeof messages === 'string' ? messages : messages[messages.length - 1]?.content || '';
    const analysis = this.analyzeTask(task);

    // Select model
    const selection = this.selectModel({ ...analysis, ...options });

    if (!selection.model) {
      throw new Error('No suitable model found for task');
    }

    // Check cache
    if (options.useCache !== false) {
      const cacheKey = this.cache.getKey(selection.model.provider, selection.model.id, messages, options);
      const cached = this.cache.get(cacheKey);

      if (cached) {
        this.stats.cacheHits++;
        this.emit('cache:hit', { model: selection.model.id });
        return cached;
      }
    }

    // Get provider
    const provider = this.providers.get(selection.model.provider);
    if (!provider) {
      throw new Error(`Provider not found: ${selection.model.provider}`);
    }

    // Execute with fallback
    let result = null;
    let lastError = null;

    const modelsToTry = [selection.model.id, ...this.fallbackChain];

    for (const modelId of modelsToTry) {
      const model = this.models.get(modelId);
      if (!model || !model.enabled) continue;

      try {
        result = await provider.complete(messages, {
          ...options,
          model: model.id
        });

        result._meta = {
          model: model.id,
          provider: model.provider,
          latency: Date.now() - startTime,
          cached: false,
          fallback: modelId !== selection.model.id
        };

        break;
      } catch (error) {
        lastError = error;
        this.emit('model:error', { model: modelId, error: error.message });
        continue;
      }
    }

    if (!result) {
      throw lastError || new Error('All models failed');
    }

    // Update stats
    const latency = Date.now() - startTime;
    this.stats.avgLatency = (this.stats.avgLatency * (this.stats.totalRequests - 1) + latency) / this.stats.totalRequests;
    this.stats.totalTokens += result.usage?.totalTokens || 0;
    this.stats.totalCost += (selection.model.metrics.costPerToken || 0) * (result.usage?.totalTokens || 0);

    // Cache result
    if (options.useCache !== false) {
      const cacheKey = this.cache.getKey(selection.model.provider, selection.model.id, messages, options);
      this.cache.set(cacheKey, result);
    }

    this.emit('complete', {
      model: selection.model.id,
      latency,
      tokens: result.usage?.totalTokens
    });

    return result;
  }

  /**
   * Stream complete
   */
  async *streamComplete(messages, options = {}) {
    const analysis = this.analyzeTask(typeof messages === 'string' ? messages : messages[messages.length - 1]?.content || '');
    const selection = this.selectModel({ ...analysis, ...options });

    if (!selection.model) {
      throw new Error('No suitable model found');
    }

    const provider = this.providers.get(selection.model.provider);
    if (!provider) {
      throw new Error(`Provider not found: ${selection.model.provider}`);
    }

    yield* provider.stream(messages, {
      ...options,
      model: selection.model.id
    });
  }

  /**
   * Use a template
   */
  useTemplate(templateId, variables = {}) {
    const template = this.templates.get(templateId);
    if (!template) {
      throw new Error(`Template not found: ${templateId}`);
    }

    return template.render(variables);
  }

  /**
   * Get stats
   */
  getStats() {
    return {
      ...this.stats,
      cache: this.cache.getStats(),
      models: this.models.size,
      templates: this.templates.size
    };
  }

  /**
   * Get model recommendations
   */
  getRecommendations(task) {
    const analysis = this.analyzeTask(task);
    const recommendations = [];

    for (const model of this.models.values()) {
      if (model.canHandle(analysis)) {
        recommendations.push({
          model: model.toJSON(),
          score: model.scoreForTask(analysis),
          reason: this._getRecommendationReason(model, analysis)
        });
      }
    }

    return recommendations.sort((a, b) => b.score - a.score);
  }

  /**
   * Get recommendation reason
   */
  _getRecommendationReason(model, analysis) {
    const reasons = [];

    if (model.supportedCategories.includes(analysis.category)) {
      reasons.push(`Supports ${analysis.category} tasks`);
    }

    if (model.metrics.qualityScore > 0.8) {
      reasons.push('High quality output');
    }

    if (model.metrics.costPerToken < 0.0002) {
      reasons.push('Cost effective');
    }

    if (model.metrics.avgLatency < 1000) {
      reasons.push('Fast response');
    }

    return reasons.join(', ') || 'General purpose';
  }

  /**
   * Clear cache
   */
  clearCache() {
    this.cache.clear();
  }

  /**
   * Get cost estimate for a task
   */
  estimateCost(task, modelId = null) {
    const selection = modelId
      ? { model: this.models.get(modelId) }
      : this.selectModel(task);

    if (!selection?.model) return { error: 'No model available' };

    const estimatedTokens = Math.ceil((task.length || 100) / 4) + 500;
    const cost = estimatedTokens * selection.model.metrics.costPerToken;

    return {
      model: selection.model.name,
      estimatedTokens,
      estimatedCost: `$${cost.toFixed(6)}`,
      costPerToken: selection.model.metrics.costPerToken,
      reasoning: selection.reasoning
    };
  }

  /**
   * Get all model health statuses
   */
  getModelHealth() {
    const health = {};
    for (const [id, model] of this.models) {
      health[id] = {
        name: model.name,
        enabled: model.enabled,
        qualityScore: model.metrics.qualityScore,
        avgLatency: Math.round(model.metrics.avgLatency),
        usageCount: model.metrics.usageCount,
        lastUsed: model.metrics.lastUsed
      };
    }
    return health;
  }

  /**
   * Enable/disable a model
   */
  setModelEnabled(modelId, enabled) {
    const model = this.models.get(modelId);
    if (model) {
      model.enabled = enabled;
      this.emit('model:toggled', { modelId, enabled });
    }
    return this;
  }

  /**
   * Set model quality score
   */
  setModelQuality(modelId, score) {
    const model = this.models.get(modelId);
    if (model) {
      model.metrics.qualityScore = Math.max(0, Math.min(1, score));
    }
    return this;
  }

  /**
   * Get usage statistics
   */
  getUsageStats() {
    const stats = {
      totalRequests: 0,
      totalTokens: 0,
      totalCost: 0,
      byModel: {}
    };

    for (const [id, model] of this.models) {
      const usage = model.metrics.usageCount;
      stats.totalRequests += usage;
      stats.byModel[id] = {
        name: model.name,
        requests: usage,
        avgLatency: Math.round(model.metrics.avgLatency),
        quality: model.metrics.qualityScore
      };
    }

    return stats;
  }

  /**
   * Batch complete multiple prompts
   */
  async batchComplete(prompts, options = {}) {
    const { concurrency = 5 } = options;
    const results = [];

    for (let i = 0; i < prompts.length; i += concurrency) {
      const batch = prompts.slice(i, i + concurrency);
      const batchResults = await Promise.allSettled(
        batch.map(p => this.complete(p, options))
      );
      results.push(...batchResults.map((r, j) => ({
        prompt: batch[j].substring(0, 50),
        status: r.status,
        result: r.status === 'fulfilled' ? r.value : null,
        error: r.status === 'rejected' ? r.reason.message : null
      })));
    }

    return results;
  }
}

// Export singleton
let orchestrator = null;

export function getLLMOrchestrator(options) {
  if (!orchestrator) {
    orchestrator = new LLMOrchestrator(options);
    orchestrator.loadModelRegistry();
  }
  return orchestrator;
}

export default {
  LLMOrchestrator,
  ModelProfile,
  PromptTemplate,
  TaskCategory,
  ModelCapability,
  ModelRegistry,
  getLLMOrchestrator
};