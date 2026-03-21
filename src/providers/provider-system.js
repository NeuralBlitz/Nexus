#!/usr/bin/env node

import { EventEmitter } from 'events';
import https from 'https';
import http from 'http';

// ═══════════════════════════════════════════════════════════════════════════
// COMPREHENSIVE PROVIDER SYSTEM
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Provider states
 */
export const ProviderState = {
  INITIALIZING: 'INITIALIZING',
  HEALTHY: 'HEALTHY',
  DEGRADED: 'DEGRADED',
  UNHEALTHY: 'UNHEALTHY',
  DISABLED: 'DISABLED',
  RATE_LIMITED: 'RATE_LIMITED'
};

/**
 * Message roles
 */
export const MessageRole = {
  SYSTEM: 'system',
  USER: 'user',
  ASSISTANT: 'assistant',
  FUNCTION: 'function'
};

/**
 * Core Provider class - Unified interface for all AI providers
 */
export class Provider extends EventEmitter {
  constructor(config) {
    super();

    this.id = config.id;
    this.name = config.name;
    this.type = config.type; // 'local', 'cloud', 'api'
    this.baseUrl = config.baseUrl;
    this.apiKey = config.apiKey;
    this.enabled = config.enabled !== false;

    // Models supported
    this.models = new Map();
    this.defaultModel = config.defaultModel || null;

    // State
    this.state = ProviderState.INITIALIZING;
    this.lastHealthCheck = null;

    // Rate limiting
    this.rateLimit = {
      requests: 0,
      tokens: 0,
      windowStart: Date.now(),
      limit: config.rateLimit || 100, // requests per minute
      tokenLimit: config.tokenLimit || 100000
    };

    // Statistics
    this.stats = {
      requests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      totalTokens: 0,
      totalLatency: 0,
      averageLatency: 0
    };

    // Request queue for rate limiting
    this.requestQueue = [];
    this.processing = false;

    // Configuration
    this.config = {
      timeout: config.timeout || 60000,
      maxRetries: config.maxRetries || 3,
      retryDelay: config.retryDelay || 1000,
      healthCheckInterval: config.healthCheckInterval || 60000,
      ...config.config
    };

    // Initialize models
    if (config.models) {
      for (const model of config.models) {
        this.registerModel(model);
      }
    }
  }

  /**
   * Register a model
   */
  registerModel(model) {
    const modelInfo = {
      id: model.id || model.name,
      name: model.name || model.id,
      description: model.description || '',
      maxTokens: model.maxTokens || 4096,
      contextWindow: model.contextWindow || 4096,
      capabilities: model.capabilities || ['chat', 'completion'],
      pricing: model.pricing || null
    };

    this.models.set(modelInfo.id, modelInfo);

    if (!this.defaultModel) {
      this.defaultModel = modelInfo.id;
    }

    this.emit('model:registered', { provider: this.id, model: modelInfo.id });
  }

  /**
   * Get available models
   */
  getModels() {
    return Array.from(this.models.values());
  }

  /**
   * Check if provider has a specific model
   */
  hasModel(modelId) {
    return this.models.has(modelId);
  }

  /**
   * Check rate limits
   */
  canMakeRequest(tokens = 0) {
    // Reset window if needed
    const now = Date.now();
    if (now - this.rateLimit.windowStart > 60000) {
      this.rateLimit.requests = 0;
      this.rateLimit.tokens = 0;
      this.rateLimit.windowStart = now;
    }

    return (
      this.rateLimit.requests < this.rateLimit.limit &&
      this.rateLimit.tokens + tokens < this.rateLimit.tokenLimit
    );
  }

  /**
   * Update rate limit counters
   */
  _updateRateLimit(tokens) {
    this.rateLimit.requests += 1;
    this.rateLimit.tokens += tokens;
  }

  /**
   * Create a chat completion
   */
  async chat(messages, options = {}) {
    const model = options.model || this.defaultModel;

    if (!this.enabled) {
      throw new Error(`Provider ${this.name} is disabled`);
    }

    if (!this.hasModel(model)) {
      throw new Error(`Model ${model} not available in ${this.name}`);
    }

    // Check rate limits
    if (!this.canMakeRequest()) {
      this.state = ProviderState.RATE_LIMITED;
      throw new Error(`Rate limit exceeded for ${this.name}`);
    }

    const startTime = Date.now();
    this.stats.requests += 1;

    try {
      const result = await this._executeChat(messages, {
        ...options,
        model
      });

      // Update statistics
      const latency = Date.now() - startTime;
      this.stats.successfulRequests += 1;
      this.stats.totalTokens += result.usage?.totalTokens || 0;
      this.stats.totalLatency += latency;
      this.stats.averageLatency = this.stats.totalLatency / this.stats.successfulRequests;

      // Update rate limit
      this._updateRateLimit(result.usage?.completionTokens || 0);

      this.emit('request:completed', {
        provider: this.id,
        model,
        latency,
        tokens: result.usage?.totalTokens
      });

      return result;
    } catch (error) {
      this.stats.failedRequests += 1;

      // Check if rate limited
      if (error.message.includes('rate') || error.message.includes('429')) {
        this.state = ProviderState.RATE_LIMITED;
        this.emit('rate:limited', { provider: this.id });
      }

      this.emit('request:failed', {
        provider: this.id,
        model,
        error: error.message
      });

      throw error;
    }
  }

  /**
   * Execute chat - to be implemented by subclasses
   */
  async _executeChat(messages, options) {
    throw new Error('_executeChat must be implemented by subclass');
  }

  /**
   * Stream chat completion
   */
  async *streamChat(messages, options = {}) {
    // Default implementation - no streaming
    const result = await this.chat(messages, options);
    yield result;
  }

  /**
   * Perform health check
   */
  async healthCheck() {
    try {
      const healthy = await this._checkHealth();
      this.lastHealthCheck = Date.now();

      if (healthy) {
        this.state = ProviderState.HEALTHY;
      } else {
        this.state = ProviderState.UNHEALTHY;
      }

      return {
        provider: this.id,
        state: this.state,
        timestamp: this.lastHealthCheck
      };
    } catch (error) {
      this.state = ProviderState.UNHEALTHY;
      return {
        provider: this.id,
        state: this.state,
        error: error.message,
        timestamp: Date.now()
      };
    }
  }

  /**
   * Health check implementation - to be implemented by subclasses
   */
  async _checkHealth() {
    return this.enabled;
  }

  /**
   * Get provider status
   */
  getStatus() {
    return {
      id: this.id,
      name: this.name,
      type: this.type,
      state: this.state,
      enabled: this.enabled,
      models: this.getModels(),
      defaultModel: this.defaultModel,
      stats: this.stats,
      rateLimit: {
        remaining: this.rateLimit.limit - this.rateLimit.requests,
        limit: this.rateLimit.limit
      }
    };
  }

  /**
   * Enable provider
   */
  enable() {
    this.enabled = true;
    this.emit('enabled', { provider: this.id });
  }

  /**
   * Disable provider
   */
  disable() {
    this.enabled = false;
    this.state = ProviderState.DISABLED;
    this.emit('disabled', { provider: this.id });
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// OPENAI PROVIDER
// ═══════════════════════════════════════════════════════════════════════════

export class OpenAIProvider extends Provider {
  constructor(config) {
    super({
      ...config,
      type: 'cloud',
      baseUrl: config.baseUrl || 'https://api.openai.com/v1',
      models: config.models || [
        { id: 'gpt-4', name: 'GPT-4', maxTokens: 8192, contextWindow: 8192 },
        { id: 'gpt-4-turbo', name: 'GPT-4 Turbo', maxTokens: 128000, contextWindow: 128000 },
        { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo', maxTokens: 4096, contextWindow: 16385 }
      ]
    });
  }

  async _executeChat(messages, options) {
    const body = {
      model: options.model,
      messages,
      temperature: options.temperature || 0.7,
      max_tokens: options.maxTokens || 4096
    };

    const response = await this._request('POST', '/chat/completions', body);

    return {
      content: response.choices[0].message.content,
      role: response.choices[0].message.role,
      finishReason: response.choices[0].finish_reason,
      usage: {
        promptTokens: response.usage.prompt_tokens,
        completionTokens: response.usage.completion_tokens,
        totalTokens: response.usage.total_tokens
      }
    };
  }

  async *_streamChat(messages, options) {
    const body = {
      model: options.model,
      messages,
      temperature: options.temperature || 0.7,
      max_tokens: options.maxTokens || 4096,
      stream: true
    };

    // Streaming implementation would go here
    const result = await this._executeChat(messages, options);
    yield result;
  }

  async _checkHealth() {
    try {
      await this._request('GET', '/models');
      return true;
    } catch {
      return false;
    }
  }

  async _request(method, path, body = null) {
    const url = new URL(path, this.baseUrl);

    const options = {
      hostname: url.hostname,
      port: 443,
      path: url.pathname,
      method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`
      }
    };

    return new Promise((resolve, reject) => {
      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            resolve(JSON.parse(data));
          } catch {
            reject(new Error('Invalid JSON response'));
          }
        });
      });

      req.on('error', reject);
      req.setTimeout(this.config.timeout, () => {
        req.destroy();
        reject(new Error('Request timeout'));
      });

      if (body) req.write(JSON.stringify(body));
      req.end();
    });
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// ANTHROPIC PROVIDER
// ═══════════════════════════════════════════════════════════════════════════

export class AnthropicProvider extends Provider {
  constructor(config) {
    super({
      ...config,
      type: 'cloud',
      baseUrl: config.baseUrl || 'https://api.anthropic.com',
      models: config.models || [
        { id: 'claude-3-opus-20240229', name: 'Claude 3 Opus', maxTokens: 4096, contextWindow: 200000 },
        { id: 'claude-3-sonnet-20240229', name: 'Claude 3 Sonnet', maxTokens: 4096, contextWindow: 200000 },
        { id: 'claude-3-haiku-20240307', name: 'Claude 3 Haiku', maxTokens: 4096, contextWindow: 200000 }
      ]
    });
  }

  async _executeChat(messages, options) {
    // Convert messages to Anthropic format
    const systemMessage = messages.find(m => m.role === 'system');
    const chatMessages = messages.filter(m => m.role !== 'system');

    const body = {
      model: options.model,
      messages: chatMessages,
      max_tokens: options.maxTokens || 4096,
      temperature: options.temperature || 0.7
    };

    if (systemMessage) {
      body.system = systemMessage.content;
    }

    const response = await this._request('POST', '/v1/messages', body);

    return {
      content: response.content[0].text,
      role: 'assistant',
      finishReason: response.stop_reason,
      usage: {
        promptTokens: response.usage.input_tokens,
        completionTokens: response.usage.output_tokens,
        totalTokens: response.usage.input_tokens + response.usage.output_tokens
      }
    };
  }

  async _checkHealth() {
    try {
      // Simple check - try to list models or make a minimal request
      return !!this.apiKey;
    } catch {
      return false;
    }
  }

  async _request(method, path, body = null) {
    const url = new URL(path, this.baseUrl);

    const options = {
      hostname: url.hostname,
      port: 443,
      path: url.pathname,
      method,
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01'
      }
    };

    return new Promise((resolve, reject) => {
      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            resolve(JSON.parse(data));
          } catch {
            reject(new Error('Invalid JSON response'));
          }
        });
      });

      req.on('error', reject);
      req.setTimeout(this.config.timeout, () => {
        req.destroy();
        reject(new Error('Request timeout'));
      });

      if (body) req.write(JSON.stringify(body));
      req.end();
    });
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// OLLAMA PROVIDER (Local)
// ═══════════════════════════════════════════════════════════════════════════

export class OllamaProvider extends Provider {
  constructor(config) {
    super({
      ...config,
      type: 'local',
      baseUrl: config.baseUrl || 'http://localhost:11434'
    });
  }

  async _executeChat(messages, options) {
    const body = {
      model: options.model,
      messages: messages.map(m => ({
        role: m.role,
        content: m.content
      })),
      stream: false,
      options: {
        temperature: options.temperature || 0.7,
        num_predict: options.maxTokens || 4096
      }
    };

    const response = await this._request('POST', '/api/chat', body);

    return {
      content: response.message.content,
      role: response.message.role,
      finishReason: response.done ? 'stop' : 'length',
      usage: {
        promptTokens: response.prompt_eval_count || 0,
        completionTokens: response.eval_count || 0,
        totalTokens: (response.prompt_eval_count || 0) + (response.eval_count || 0)
      }
    };
  }

  async *_streamChat(messages, options) {
    const body = {
      model: options.model,
      messages: messages.map(m => ({
        role: m.role,
        content: m.content
      })),
      stream: true,
      options: {
        temperature: options.temperature || 0.7
      }
    };

    // Streaming implementation
    yield* this._streamRequest('POST', '/api/chat', body);
  }

  async listModels() {
    try {
      const response = await this._request('GET', '/api/tags');
      return response.models.map(m => ({
        id: m.name,
        name: m.name,
        description: m.details?.family || '',
        maxTokens: 4096,
        contextWindow: 4096
      }));
    } catch {
      return [];
    }
  }

  async _checkHealth() {
    try {
      const response = await this._request('GET', '/api/tags');
      return !!response.models;
    } catch {
      return false;
    }
  }

  async _request(method, path, body = null) {
    const url = new URL(path, this.baseUrl);

    return new Promise((resolve, reject) => {
      const transport = url.protocol === 'https:' ? https : http;

      const options = {
        hostname: url.hostname,
        port: url.port || (url.protocol === 'https:' ? 443 : 11434),
        path: url.pathname,
        method,
        headers: {
          'Content-Type': 'application/json'
        }
      };

      const req = transport.request(options, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            resolve(JSON.parse(data));
          } catch {
            reject(new Error('Invalid JSON response'));
          }
        });
      });

      req.on('error', reject);
      req.setTimeout(this.config.timeout, () => {
        req.destroy();
        reject(new Error('Request timeout'));
      });

      if (body) req.write(JSON.stringify(body));
      req.end();
    });
  }

  async *_streamRequest(method, path, body = null) {
    const url = new URL(path, this.baseUrl);

    const response = await new Promise((resolve, reject) => {
      const options = {
        hostname: url.hostname,
        port: url.port || 11434,
        path: url.pathname,
        method,
        headers: { 'Content-Type': 'application/json' }
      };

      const req = http.request(options, resolve);
      req.on('error', reject);
      if (body) req.write(JSON.stringify(body));
      req.end();
    });

    for await (const chunk of response) {
      try {
        const data = JSON.parse(chunk.toString());
        yield data;
      } catch {
        // Ignore parse errors in streaming
      }
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// LOCAL PROVIDER (Mock/Local execution)
// ═══════════════════════════════════════════════════════════════════════════

export class LocalProvider extends Provider {
  constructor(config) {
    super({
      ...config,
      type: 'local'
    });

    this.handlers = new Map();
  }

  /**
   * Register a local handler for a model
   */
  registerHandler(modelId, handler) {
    this.handlers.set(modelId, handler);
  }

  async _executeChat(messages, options) {
    const handler = this.handlers.get(options.model);
    if (!handler) {
      throw new Error(`No handler for model: ${options.model}`);
    }

    return handler(messages, options);
  }

  async _checkHealth() {
    return true;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// PROVIDER MANAGER - Unified management of all providers
// ═══════════════════════════════════════════════════════════════════════════

export class ProviderManager extends EventEmitter {
  constructor() {
    super();

    this.providers = new Map();
    this.fallbackOrder = [];
    this.loadBalancer = {
      strategy: 'round-robin', // 'round-robin', 'least-latency', 'random'
      lastIndex: 0
    };
  }

  /**
   * Register a provider
   */
  register(provider) {
    if (!(provider instanceof Provider)) {
      throw new Error('Must be a Provider instance');
    }

    this.providers.set(provider.id, provider);

    // Forward events
    provider.on('request:completed', (data) => this.emit('provider:request', data));
    provider.on('request:failed', (data) => this.emit('provider:error', data));
    provider.on('rate:limited', (data) => this.emit('provider:rate-limit', data));

    this.emit('provider:registered', { provider: provider.id });
    return this;
  }

  /**
   * Get a provider by ID
   */
  get(providerId) {
    return this.providers.get(providerId);
  }

  /**
   * Get all providers
   */
  getAll() {
    return Array.from(this.providers.values());
  }

  /**
   * Get healthy providers
   */
  getHealthy() {
    return this.getAll().filter(p =>
      p.enabled && p.state === ProviderState.HEALTHY
    );
  }

  /**
   * Get providers that support a model
   */
  getByModel(modelId) {
    return this.getAll().filter(p =>
      p.enabled && p.hasModel(modelId)
    );
  }

  /**
   * Set fallback order
   */
  setFallbackOrder(providerIds) {
    this.fallbackOrder = providerIds;
  }

  /**
   * Get best provider for a model (with failover)
   */
  async getProvider(modelId, options = {}) {
    // Strategy: round-robin, least-latency, or specific preference
    const candidates = this.getByModel(modelId);

    if (candidates.length === 0) {
      throw new Error(`No provider found for model: ${modelId}`);
    }

    // Filter to healthy providers
    let healthyCandidates = candidates.filter(p =>
      p.state === ProviderState.HEALTHY || p.state === ProviderState.DEGRADED
    );

    if (healthyCandidates.length === 0) {
      // Fall back to any enabled provider
      healthyCandidates = candidates.filter(p => p.enabled);
    }

    if (healthyCandidates.length === 0) {
      throw new Error('No available providers');
    }

    // Select based on strategy
    let selected;
    switch (this.loadBalancer.strategy) {
      case 'least-latency':
        selected = healthyCandidates.reduce((best, current) =>
          current.stats.averageLatency < best.stats.averageLatency ? current : best
        );
        break;

      case 'random':
        selected = healthyCandidates[Math.floor(Math.random() * healthyCandidates.length)];
        break;

      case 'round-robin':
      default:
        this.loadBalancer.lastIndex = (this.loadBalancer.lastIndex + 1) % healthyCandidates.length;
        selected = healthyCandidates[this.loadBalancer.lastIndex];
        break;
    }

    return selected;
  }

  /**
   * Execute with failover
   */
  async chatWithFailover(messages, options = {}) {
    const modelId = options.model;
    const candidates = this.getByModel(modelId).filter(p => p.enabled);

    if (candidates.length === 0) {
      throw new Error(`No provider found for model: ${modelId}`);
    }

    let lastError;

    // Try each provider in order
    for (const provider of candidates) {
      if (provider.state === ProviderState.RATE_LIMITED) {
        continue; // Skip rate-limited providers
      }

      try {
        return await provider.chat(messages, options);
      } catch (error) {
        lastError = error;
        this.emit('provider:failover', {
          model: modelId,
          failedProvider: provider.id,
          error: error.message
        });
      }
    }

    throw lastError || new Error('All providers failed');
  }

  /**
   * Set load balancing strategy
   */
  setLoadBalancerStrategy(strategy) {
    if (!['round-robin', 'least-latency', 'random'].includes(strategy)) {
      throw new Error('Invalid strategy');
    }
    this.loadBalancer.strategy = strategy;
  }

  /**
   * Health check all providers
   */
  async healthCheckAll() {
    const results = [];

    for (const provider of this.providers.values()) {
      if (provider.enabled) {
        results.push(await provider.healthCheck());
      }
    }

    return results;
  }

  /**
   * Get manager status
   */
  getStatus() {
    const providers = this.getAll();

    return {
      total: providers.length,
      healthy: providers.filter(p => p.state === ProviderState.HEALTHY).length,
      degraded: providers.filter(p => p.state === ProviderState.DEGRADED).length,
      unhealthy: providers.filter(p => p.state === ProviderState.UNHEALTHY).length,
      disabled: providers.filter(p => p.state === ProviderState.DISABLED).length,
      rateLimited: providers.filter(p => p.state === ProviderState.RATE_LIMITED).length,
      loadBalancer: this.loadBalancer,
      providers: providers.map(p => p.getStatus())
    };
  }
}

// Export singleton
let manager = null;

export function getProviderManager() {
  if (!manager) {
    manager = new ProviderManager();
  }
  return manager;
}

export default {
  Provider,
  ProviderState,
  MessageRole,
  OpenAIProvider,
  AnthropicProvider,
  OllamaProvider,
  LocalProvider,
  ProviderManager,
  getProviderManager
};