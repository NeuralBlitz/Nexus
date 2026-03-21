#!/usr/bin/env node

import { EventEmitter } from 'events';
import https from 'https';
import http from 'http';
import { Provider } from './provider-system.js';

// ═══════════════════════════════════════════════════════════════════════════
// EXTRA LLM PROVIDERS (15 MORE)
// ═══════════════════════════════════════════════════════════════════════════

export class AzureOpenAIProvider extends Provider {
  constructor(config) {
    super({
      ...config,
      type: 'cloud',
      baseUrl: config.baseUrl || `https://${config.resourceName}.openai.azure.com`,
      models: config.models || [
        { id: 'gpt-4', name: 'GPT-4', maxTokens: 8192, contextWindow: 8192 },
        { id: 'gpt-4-turbo', name: 'GPT-4 Turbo', maxTokens: 128000, contextWindow: 128000 },
        { id: 'gpt-35-turbo', name: 'GPT-3.5 Turbo', maxTokens: 4096, contextWindow: 16385 }
      ]
    });
  }

  async _executeChat(messages, options) {
    const body = {
      messages,
      temperature: options.temperature || 0.7,
      max_tokens: options.maxTokens || 4096
    };

    const response = await this._request('POST', `/openai/deployments/${options.model}/chat/completions?api-version=2024-02-01`, body);

    return {
      content: response.choices[0].message.content,
      role: response.choices[0].message.role,
      finishReason: response.choices[0].finish_reason,
      usage: response.usage
    };
  }

  async _checkHealth() {
    return !!this.apiKey;
  }

  async _request(method, path, body = null) {
    const url = new URL(path, this.baseUrl);
    const options = {
      hostname: url.hostname,
      port: 443,
      path: url.pathname + url.search,
      method,
      headers: {
        'Content-Type': 'application/json',
        'api-key': this.apiKey
      }
    };

    return new Promise((resolve, reject) => {
      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try { resolve(JSON.parse(data)); }
          catch { reject(new Error('Invalid JSON')); }
        });
      });
      req.on('error', reject);
      req.setTimeout(this.config.timeout, () => { req.destroy(); reject(new Error('Timeout')); });
      if (body) req.write(JSON.stringify(body));
      req.end();
    });
  }
}

export class VertexAIProvider extends Provider {
  constructor(config) {
    super({
      ...config,
      type: 'cloud',
      baseUrl: config.baseUrl || `https://${config.location || 'us-central1'}-aiplatform.googleapis.com/v1`,
      models: config.models || [
        { id: 'chat-bison@002', name: 'Chat Bison', maxTokens: 4096, contextWindow: 4096 },
        { id: 'codechat-bison@002', name: 'Code Chat Bison', maxTokens: 4096, contextWindow: 4096 }
      ]
    });
  }

  async _executeChat(messages, options) {
    const body = {
      instances: [{
        messages: messages.map(m => ({ author: m.role === 'assistant' ? 'assistant' : 'user', content: m.content }))
      }],
      parameters: {
        temperature: options.temperature || 0.7,
        maxOutputTokens: options.maxTokens || 1024
      }
    };

    const response = await this._request('POST', `/projects/${this.projectId}/locations/${this.location || 'us-central1'}/publishers/google/models/${options.model}:predict`, body);

    return {
      content: response.predictions?.[0]?.candidates?.[0]?.content || '',
      role: 'assistant',
      usage: {}
    };
  }

  async _checkHealth() {
    return !!this.apiKey && !!this.projectId;
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
          try { resolve(JSON.parse(data)); }
          catch { reject(new Error('Invalid JSON')); }
        });
      });
      req.on('error', reject);
      req.setTimeout(this.config.timeout, () => { req.destroy(); reject(new Error('Timeout')); });
      if (body) req.write(JSON.stringify(body));
      req.end();
    });
  }
}

export class AWSBedrockProvider extends Provider {
  constructor(config) {
    super({
      ...config,
      type: 'cloud',
      baseUrl: config.baseUrl || 'https://bedrock-runtime.us-east-1.amazonaws.com',
      models: config.models || [
        { id: 'anthropic.claude-3-sonnet-20240229-v1:0', name: 'Claude 3 Sonnet', maxTokens: 4096, contextWindow: 200000 },
        { id: 'anthropic.claude-3-haiku-20240307-v1:0', name: 'Claude 3 Haiku', maxTokens: 4096, contextWindow: 200000 },
        { id: 'meta.llama2-70b-chat-v1', name: 'Llama 2 70B', maxTokens: 4096, contextWindow: 4096 }
      ]
    });
  }

  async _executeChat(messages, options) {
    const body = {
      anthropic_version: 'bedrock-2023-05-31',
      messages: messages.map(m => ({ role: m.role, content: m.content })),
      max_tokens: options.maxTokens || 4096,
      temperature: options.temperature || 0.7
    };

    const response = await this._request('POST', `/model/${options.model}/invoke`, body);

    return {
      content: JSON.parse(response.body).content?.[0]?.text || '',
      role: 'assistant',
      usage: {}
    };
  }

  async _checkHealth() {
    return !!this.apiKey;
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
          try { resolve(JSON.parse(data)); }
          catch { reject(new Error('Invalid JSON')); }
        });
      });
      req.on('error', reject);
      req.setTimeout(this.config.timeout, () => { req.destroy(); reject(new Error('Timeout')); });
      if (body) req.write(JSON.stringify(body));
      req.end();
    });
  }
}

export class AI21SummarizeProvider extends Provider {
  constructor(config) {
    super({
      ...config,
      type: 'cloud',
      baseUrl: config.baseUrl || 'https://api.ai21.com/studio/v1',
      models: config.models || [
        { id: 'j2-mid', name: 'Jurassic-2 Mid', maxTokens: 8192, contextWindow: 204800 },
        { id: 'j2-ultra', name: 'Jurassic-2 Ultra', maxTokens: 8192, contextWindow: 204800 }
      ]
    });
  }

  async _executeChat(messages, options) {
    const body = {
      messages,
      temperature: options.temperature || 0.7,
      max_tokens: options.maxTokens || 2048
    };

    const response = await this._request('POST', '/chat/completions', body);

    return {
      content: response.choices[0].message.content,
      role: response.choices[0].message.role,
      finishReason: response.choices[0].finish_reason,
      usage: response.usage
    };
  }

  async _checkHealth() {
    return !!this.apiKey;
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
          try { resolve(JSON.parse(data)); }
          catch { reject(new Error('Invalid JSON')); }
        });
      });
      req.on('error', reject);
      req.setTimeout(this.config.timeout, () => { req.destroy(); reject(new Error('Timeout')); });
      if (body) req.write(JSON.stringify(body));
      req.end();
    });
  }
}

export class AlephAlphaProvider extends Provider {
  constructor(config) {
    super({
      ...config,
      type: 'cloud',
      baseUrl: config.baseUrl || 'https://api.aleph-alpha.com/v1',
      models: config.models || [
        { id: 'llama-3-70b-instruct', name: 'Luminous Supreme', maxTokens: 2048, contextWindow: 2048 },
        { id: 'llama-3-8b-instruct', name: 'Luminous Base', maxTokens: 2048, contextWindow: 2048 }
      ]
    });
  }

  async _executeChat(messages, options) {
    const body = {
      model: options.model,
      messages,
      temperature: options.temperature || 0.7,
      max_tokens: options.maxTokens || 1024
    };

    const response = await this._request('POST', '/chat', body);

    return {
      content: response.completions?.[0]?.completion?.content || '',
      role: 'assistant',
      usage: response.usage ? { totalTokens: response.usage.total_tokens } : {}
    };
  }

  async _checkHealth() {
    return !!this.apiKey;
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
          try { resolve(JSON.parse(data)); }
          catch { reject(new Error('Invalid JSON')); }
        });
      });
      req.on('error', reject);
      req.setTimeout(this.config.timeout, () => { req.destroy(); reject(new Error('Timeout')); });
      if (body) req.write(JSON.stringify(body));
      req.end();
    });
  }
}

export class MosaicMLProvider extends Provider {
  constructor(config) {
    super({
      ...config,
      type: 'cloud',
      baseUrl: config.baseUrl || 'https://api.mosaicml.cloud/v1',
      models: config.models || [
        { id: 'mistral-7b', name: 'Mistral 7B', maxTokens: 4096, contextWindow: 8192 },
        { id: 'llama2-70b', name: 'Llama 2 70B', maxTokens: 4096, contextWindow: 4096 }
      ]
    });
  }

  async _executeChat(messages, options) {
    const body = {
      model: options.model,
      messages,
      temperature: options.temperature || 0.7,
      max_tokens: options.maxTokens || 1024
    };

    const response = await this._request('POST', '/chat/completions', body);

    return {
      content: response.choices[0].message.content,
      role: response.choices[0].message.role,
      finishReason: response.choices[0].finish_reason,
      usage: response.usage
    };
  }

  async _checkHealth() {
    return !!this.apiKey;
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
          try { resolve(JSON.parse(data)); }
          catch { reject(new Error('Invalid JSON')); }
        });
      });
      req.on('error', reject);
      req.setTimeout(this.config.timeout, () => { req.destroy(); reject(new Error('Timeout')); });
      if (body) req.write(JSON.stringify(body));
      req.end();
    });
  }
}

export class OpenRouterProvider extends Provider {
  constructor(config) {
    super({
      ...config,
      type: 'cloud',
      baseUrl: config.baseUrl || 'https://openrouter.ai/api/v1',
      models: config.models || [
        { id: 'openai/gpt-4', name: 'GPT-4', maxTokens: 8192, contextWindow: 8192 },
        { id: 'anthropic/claude-3-opus', name: 'Claude 3 Opus', maxTokens: 4096, contextWindow: 200000 },
        { id: 'meta-llama/llama-3-70b-instruct', name: 'Llama 3 70B', maxTokens: 8192, contextWindow: 8192 }
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
      usage: response.usage
    };
  }

  async _checkHealth() {
    return !!this.apiKey;
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
        'Authorization': `Bearer ${this.apiKey}`,
        'HTTP-Referer': 'https://nexus.local',
        'X-Title': 'NEXUS Platform'
      }
    };

    return new Promise((resolve, reject) => {
      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try { resolve(JSON.parse(data)); }
          catch { reject(new Error('Invalid JSON')); }
        });
      });
      req.on('error', reject);
      req.setTimeout(this.config.timeout, () => { req.destroy(); reject(new Error('Timeout')); });
      if (body) req.write(JSON.stringify(body));
      req.end();
    });
  }
}

export class CloudflareWorkersProvider extends Provider {
  constructor(config) {
    super({
      ...config,
      type: 'cloud',
      baseUrl: config.baseUrl || `https://api.cloudflare.com/client/v4/accounts/${config.accountId}/ai`,
      models: config.models || [
        { id: '@cf/meta/llama-3-8b-instruct-hf', name: 'Llama 3 8B HF', maxTokens: 4096, contextWindow: 8192 },
        { id: '@cf/mistral/mistral-7b-instruct-v0.1', name: 'Mistral 7B', maxTokens: 4096, contextWindow: 8192 },
        { id: '@cf/thebloke/llama-2-7b-chat-awq', name: 'Llama 2 7B', maxTokens: 4096, contextWindow: 4096 }
      ]
    });
  }

  async _executeChat(messages, options) {
    const body = { messages };

    const response = await this._request('POST', `/v1/run/${options.model}`, body);

    return {
      content: response.result?.response || '',
      role: 'assistant',
      usage: {}
    };
  }

  async _checkHealth() {
    try {
      await this._request('GET', '/models');
      return true;
    } catch { return false; }
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
          try { resolve(JSON.parse(data)); }
          catch { reject(new Error('Invalid JSON')); }
        });
      });
      req.on('error', reject);
      req.setTimeout(this.config.timeout, () => { req.destroy(); reject(new Error('Timeout')); });
      if (body) req.write(JSON.stringify(body));
      req.end();
    });
  }
}

export class LeptonProvider extends Provider {
  constructor(config) {
    super({
      ...config,
      type: 'cloud',
      baseUrl: config.baseUrl || 'https://auto.lepton.ai/api/v1',
      models: config.models || [
        { id: 'llama-3-70b', name: 'Llama 3 70B', maxTokens: 8192, contextWindow: 8192 },
        { id: 'llama-3-8b', name: 'Llama 3 8B', maxTokens: 8192, contextWindow: 8192 }
      ]
    });
  }

  async _executeChat(messages, options) {
    const body = {
      model: options.model,
      messages,
      temperature: options.temperature || 0.7,
      max_tokens: options.maxTokens || 1024
    };

    const response = await this._request('POST', '/chat/completions', body);

    return {
      content: response.choices[0].message.content,
      role: response.choices[0].message.role,
      finishReason: response.choices[0].finish_reason,
      usage: response.usage
    };
  }

  async _checkHealth() {
    return !!this.apiKey;
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
          try { resolve(JSON.parse(data)); }
          catch { reject(new Error('Invalid JSON')); }
        });
      });
      req.on('error', reject);
      req.setTimeout(this.config.timeout, () => { req.destroy(); reject(new Error('Timeout')); });
      if (body) req.write(JSON.stringify(body));
      req.end();
    });
  }
}

export class HyperbolicProvider extends Provider {
  constructor(config) {
    super({
      ...config,
      type: 'cloud',
      baseUrl: config.baseUrl || 'https://api.hyperbolic.xyz/v1',
      models: config.models || [
        { id: 'meta-llama/Llama-3-70b-chat-hf', name: 'Llama 3 70B', maxTokens: 8192, contextWindow: 8192 },
        { id: 'meta-llama/Llama-3-8b-chat-hf', name: 'Llama 3 8B', maxTokens: 8192, contextWindow: 8192 }
      ]
    });
  }

  async _executeChat(messages, options) {
    const body = {
      model: options.model,
      messages,
      temperature: options.temperature || 0.7,
      max_tokens: options.maxTokens || 1024
    };

    const response = await this._request('POST', '/chat/completions', body);

    return {
      content: response.choices[0].message.content,
      role: response.choices[0].message.role,
      finishReason: response.choices[0].finish_reason,
      usage: response.usage
    };
  }

  async _checkHealth() {
    return !!this.apiKey;
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
          try { resolve(JSON.parse(data)); }
          catch { reject(new Error('Invalid JSON')); }
        });
      });
      req.on('error', reject);
      req.setTimeout(this.config.timeout, () => { req.destroy(); reject(new Error('Timeout')); });
      if (body) req.write(JSON.stringify(body));
      req.end();
    });
  }
}

export class VoyageAIProvider extends Provider {
  constructor(config) {
    super({
      ...config,
      type: 'cloud',
      baseUrl: config.baseUrl || 'https://api.voyageai.com/v1',
      models: config.models || [
        { id: 'voyage-2', name: 'Voyage 2', maxTokens: 4096, contextWindow: 4096 },
        { id: 'voyage-lite-2', name: 'Voyage Lite 2', maxTokens: 4096, contextWindow: 4096 }
      ]
    });
  }

  async _executeChat(messages, options) {
    const body = {
      model: options.model,
      messages,
      temperature: options.temperature || 0.7,
      max_tokens: options.maxTokens || 1024
    };

    const response = await this._request('POST', '/chat/completions', body);

    return {
      content: response.choices[0].message.content,
      role: response.choices[0].message.role,
      finishReason: response.choices[0].finish_reason,
      usage: response.usage
    };
  }

  async _checkHealth() {
    return !!this.apiKey;
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
          try { resolve(JSON.parse(data)); }
          catch { reject(new Error('Invalid JSON')); }
        });
      });
      req.on('error', reject);
      req.setTimeout(this.config.timeout, () => { req.destroy(); reject(new Error('Timeout')); });
      if (body) req.write(JSON.stringify(body));
      req.end();
    });
  }
}

export class MistralLargeProvider extends Provider {
  constructor(config) {
    super({
      ...config,
      type: 'cloud',
      baseUrl: config.baseUrl || 'https://api.mistral.ai/v1',
      models: config.models || [
        { id: 'mistral-large-latest', name: 'Mistral Large', maxTokens: 32768, contextWindow: 128000 },
        { id: 'mistral-medium-latest', name: 'Mistral Medium', maxTokens: 32768, contextWindow: 32000 },
        { id: 'mistral-small-latest', name: 'Mistral Small', maxTokens: 32768, contextWindow: 32000 }
      ]
    });
  }

  async _executeChat(messages, options) {
    const body = {
      model: options.model,
      messages,
      temperature: options.temperature || 0.7,
      max_tokens: options.maxTokens || 1024
    };

    const response = await this._request('POST', '/chat/completions', body);

    return {
      content: response.choices[0].message.content,
      role: response.choices[0].message.role,
      finishReason: response.choices[0].finish_reason,
      usage: response.usage
    };
  }

  async _checkHealth() {
    try {
      await this._request('GET', '/models');
      return true;
    } catch { return false; }
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
          try { resolve(JSON.parse(data)); }
          catch { reject(new Error('Invalid JSON')); }
        });
      });
      req.on('error', reject);
      req.setTimeout(this.config.timeout, () => { req.destroy(); reject(new Error('Timeout')); });
      if (body) req.write(JSON.stringify(body));
      req.end();
    });
  }
}

export class NovitaAIProvider extends Provider {
  constructor(config) {
    super({
      ...config,
      type: 'cloud',
      baseUrl: config.baseUrl || 'https://api.novita.ai/v3.5',
      models: config.models || [
        { id: 'llama-3-70b', name: 'Llama 3 70B', maxTokens: 8192, contextWindow: 8192 },
        { id: 'qwen-72b', name: 'Qwen 72B', maxTokens: 8192, contextWindow: 8192 }
      ]
    });
  }

  async _executeChat(messages, options) {
    const body = {
      model: options.model,
      messages,
      temperature: options.temperature || 0.7,
      max_tokens: options.maxTokens || 1024
    };

    const response = await this._request('POST', '/chat/completions', body);

    return {
      content: response.choices[0].message.content,
      role: response.choices[0].message.role,
      finishReason: response.choices[0].finish_reason,
      usage: response.usage
    };
  }

  async _checkHealth() {
    return !!this.apiKey;
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
          try { resolve(JSON.parse(data)); }
          catch { reject(new Error('Invalid JSON')); }
        });
      });
      req.on('error', reject);
      req.setTimeout(this.config.timeout, () => { req.destroy(); reject(new Error('Timeout')); });
      if (body) req.write(JSON.stringify(body));
      req.end();
    });
  }
}

export class AbacusAIProvider extends Provider {
  constructor(config) {
    super({
      ...config,
      type: 'cloud',
      baseUrl: config.baseUrl || 'https://api.wolphram.com/v0',
      models: config.models || [
        { id: 'llama-3-70b', name: 'Llama 3 70B', maxTokens: 8192, contextWindow: 8192 },
        { id: 'mixtral-8x7b', name: 'Mixtral 8x7B', maxTokens: 32768, contextWindow: 32768 }
      ]
    });
  }

  async _executeChat(messages, options) {
    const body = {
      model: options.model,
      messages,
      temperature: options.temperature || 0.7,
      max_tokens: options.maxTokens || 1024
    };

    const response = await this._request('POST', '/chat/completions', body);

    return {
      content: response.choices[0].message.content,
      role: response.choices[0].message.role,
      finishReason: response.choices[0].finish_reason,
      usage: response.usage
    };
  }

  async _checkHealth() {
    return !!this.apiKey;
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
          try { resolve(JSON.parse(data)); }
          catch { reject(new Error('Invalid JSON')); }
        });
      });
      req.on('error', reject);
      req.setTimeout(this.config.timeout, () => { req.destroy(); reject(new Error('Timeout')); });
      if (body) req.write(JSON.stringify(body));
      req.end();
    });
  }
}

export default {
  AzureOpenAIProvider,
  VertexAIProvider,
  AWSBedrockProvider,
  AI21SummarizeProvider,
  AlephAlphaProvider,
  MosaicMLProvider,
  OpenRouterProvider,
  CloudflareWorkersProvider,
  LeptonProvider,
  HyperbolicProvider,
  VoyageAIProvider,
  MistralLargeProvider,
  NovitaAIProvider,
  AbacusAIProvider
};
