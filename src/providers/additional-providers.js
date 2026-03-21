#!/usr/bin/env node

import { EventEmitter } from 'events';
import https from 'https';
import http from 'http';
import { Provider } from './provider-system.js';

// ═══════════════════════════════════════════════════════════════════════════
// ADDITIONAL LLM PROVIDERS (16 MORE)
// ═══════════════════════════════════════════════════════════════════════════

export class GoogleAIProvider extends Provider {
  constructor(config) {
    super({
      ...config,
      type: 'cloud',
      baseUrl: config.baseUrl || 'https://generativelanguage.googleapis.com/v1beta',
      models: config.models || [
        { id: 'gemini-pro', name: 'Gemini Pro', maxTokens: 30720, contextWindow: 30720 },
        { id: 'gemini-pro-vision', name: 'Gemini Pro Vision', maxTokens: 12288, contextWindow: 12288 },
        { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro', maxTokens: 1048576, contextWindow: 1048576 },
        { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash', maxTokens: 1048576, contextWindow: 1048576 }
      ]
    });
  }

  async _executeChat(messages, options) {
    const contents = messages.map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }]
    }));

    const body = {
      contents,
      generationConfig: {
        temperature: options.temperature || 0.9,
        maxOutputTokens: options.maxTokens || 2048
      }
    };

    const response = await this._request('POST', `/models/${options.model}:generateContent?key=${this.apiKey}`, body);

    return {
      content: response.candidates[0].content.parts[0].text,
      role: 'assistant',
      finishReason: response.candidates[0].finishReason,
      usage: {
        promptTokens: response.usageMetadata?.promptTokenCount || 0,
        completionTokens: response.usageMetadata?.candidatesTokenCount || 0,
        totalTokens: response.usageMetadata?.totalTokenCount || 0
      }
    };
  }

  async _checkHealth() {
    try {
      await this._request('GET', `/models?key=${this.apiKey}`);
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
      path: url.pathname + url.search,
      method,
      headers: { 'Content-Type': 'application/json' }
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

export class MistralProvider extends Provider {
  constructor(config) {
    super({
      ...config,
      type: 'cloud',
      baseUrl: config.baseUrl || 'https://api.mistral.ai/v1',
      models: config.models || [
        { id: 'mistral-large-latest', name: 'Mistral Large', maxTokens: 32768, contextWindow: 32768 },
        { id: 'mistral-medium-latest', name: 'Mistral Medium', maxTokens: 32768, contextWindow: 32768 },
        { id: 'mistral-small-latest', name: 'Mistral Small', maxTokens: 32768, contextWindow: 32768 },
        { id: 'mixtral-8x7b-32768', name: 'Mixtral 8x7B', maxTokens: 32768, contextWindow: 32768 }
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

export class CohereProvider extends Provider {
  constructor(config) {
    super({
      ...config,
      type: 'cloud',
      baseUrl: config.baseUrl || 'https://api.cohere.ai/v1',
      models: config.models || [
        { id: 'command-r-plus', name: 'Command R+', maxTokens: 4096, contextWindow: 128000 },
        { id: 'command-r', name: 'Command R', maxTokens: 4096, contextWindow: 128000 },
        { id: 'command', name: 'Command', maxTokens: 4096, contextWindow: 4096 }
      ]
    });
  }

  async _executeChat(messages, options) {
    const body = {
      model: options.model,
      message: messages[messages.length - 1]?.content || '',
      chat_history: messages.slice(0, -1).map(m => ({ role: m.role, message: m.content })),
      temperature: options.temperature || 0.7,
      max_tokens: options.maxTokens || 4096
    };

    const response = await this._request('POST', '/chat', body);

    return {
      content: response.text,
      role: 'assistant',
      finishReason: response.finish_reason,
      usage: response.meta?.tokens ? { totalTokens: response.meta.tokens } : {}
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
        'Authorization': `Bearer ${this.apiKey}`,
        'Cohere-Version': '2024-05-29'
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

export class AI21Provider extends Provider {
  constructor(config) {
    super({
      ...config,
      type: 'cloud',
      baseUrl: config.baseUrl || 'https://api.ai21.com/studio/v1',
      models: config.models || [
        { id: 'jamba-large', name: 'Jamba Large', maxTokens: 8192, contextWindow: 256000 },
        { id: 'jamba-instruct', name: 'Jamba Instruct', maxTokens: 4096, contextWindow: 256000 }
      ]
    });
  }

  async _executeChat(messages, options) {
    const body = {
      model: options.model,
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

export class MetaProvider extends Provider {
  constructor(config) {
    super({
      ...config,
      type: 'cloud',
      baseUrl: config.baseUrl || 'https://api.together.xyz/v1',
      models: config.models || [
        { id: 'meta-llama/Llama-3-70b-chat-hf', name: 'Llama 3 70B', maxTokens: 8192, contextWindow: 8192 },
        { id: 'meta-llama/Llama-3-8b-chat-hf', name: 'Llama 3 8B', maxTokens: 8192, contextWindow: 8192 },
        { id: 'meta-llama/Llama-2-70b-chat-hf', name: 'Llama 2 70B', maxTokens: 4096, contextWindow: 4096 }
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

export class HuggingFaceProvider extends Provider {
  constructor(config) {
    super({
      ...config,
      type: 'cloud',
      baseUrl: config.baseUrl || 'https://api-inference.huggingface.co/models',
      models: config.models || [
        { id: 'meta-llama/Llama-3-70b-chat-hf', name: 'Llama 3 70B', maxTokens: 4096, contextWindow: 8192 },
        { id: 'mistralai/Mistral-7B-Instruct-v0.2', name: 'Mistral 7B', maxTokens: 4096, contextWindow: 8192 },
        { id: 'codellama/CodeLlama-34b-Instruct-hf', name: 'CodeLlama 34B', maxTokens: 4096, contextWindow: 16384 }
      ]
    });
  }

  async _executeChat(messages, options) {
    const body = {
      inputs: messages.map(m => `${m.role}: ${m.content}`).join('\n'),
      parameters: {
        temperature: options.temperature || 0.7,
        max_new_tokens: options.maxTokens || 256
      }
    };

    const response = await this._request('POST', `/${options.model}`, body);

    return {
      content: Array.isArray(response) ? response[0]?.generated_text : response.generated_text,
      role: 'assistant',
      usage: {}
    };
  }

  async _checkHealth() {
    try {
      await this._request('GET', '/meta-llama/Llama-3-70b-chat-hf');
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

export class ReplicateProvider extends Provider {
  constructor(config) {
    super({
      ...config,
      type: 'cloud',
      baseUrl: config.baseUrl || 'https://api.replicate.com/v1',
      models: config.models || [
        { id: 'meta/meta-llama-3-70b-instruct', name: 'Llama 3 70B', maxTokens: 8192, contextWindow: 8192 },
        { id: 'mistralai/mistral-7b-instruct-v0.2', name: 'Mistral 7B', maxTokens: 4096, contextWindow: 8192 }
      ]
    });
  }

  async _executeChat(messages, options) {
    const body = {
      version: options.model,
      input: {
        prompt: messages.map(m => m.content).join('\n'),
        temperature: options.temperature || 0.7,
        max_new_tokens: options.maxTokens || 1024
      }
    };

    const response = await this._request('POST', '/predictions', body);
    return {
      content: response.output?.join('') || '',
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
        'Authorization': `Token ${this.apiKey}`
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

export class PerplexityProvider extends Provider {
  constructor(config) {
    super({
      ...config,
      type: 'cloud',
      baseUrl: config.baseUrl || 'https://api.perplexity.ai',
      models: config.models || [
        { id: 'llama-3-sonar-large-32k-online', name: 'Sonar Large Online', maxTokens: 4096, contextWindow: 32000 },
        { id: 'llama-3-sonar-small-32k-online', name: 'Sonar Small Online', maxTokens: 4096, contextWindow: 32000 },
        { id: 'llama-3-70b-instruct', name: 'Llama 3 70B', maxTokens: 8192, contextWindow: 8192 }
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
    try {
      await this._request('POST', '/chat/completions', {
        model: 'llama-3-sonar-small-32k-online',
        messages: [{ role: 'user', content: 'ping' }]
      });
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

export class GroqProvider extends Provider {
  constructor(config) {
    super({
      ...config,
      type: 'cloud',
      baseUrl: config.baseUrl || 'https://api.groq.com/openai/v1',
      models: config.models || [
        { id: 'mixtral-8x7b-32768', name: 'Mixtral 8x7B', maxTokens: 32768, contextWindow: 32768 },
        { id: 'llama2-70b-4096', name: 'Llama 2 70B', maxTokens: 4096, contextWindow: 4096 },
        { id: 'gemma-7b-it', name: 'Gemma 7B', maxTokens: 8192, contextWindow: 8192 }
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

export class DeepSeekProvider extends Provider {
  constructor(config) {
    super({
      ...config,
      type: 'cloud',
      baseUrl: config.baseUrl || 'https://api.deepseek.com/v1',
      models: config.models || [
        { id: 'deepseek-chat', name: 'DeepSeek Chat', maxTokens: 4096, contextWindow: 64000 },
        { id: 'deepseek-coder', name: 'DeepSeek Coder', maxTokens: 4096, contextWindow: 64000 }
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

export class FireworksProvider extends Provider {
  constructor(config) {
    super({
      ...config,
      type: 'cloud',
      baseUrl: config.baseUrl || 'https://api.fireworks.ai/inference/v1',
      models: config.models || [
        { id: 'accounts/fireworks/models/llama-v3-70b-instruct', name: 'Llama 3 70B', maxTokens: 8192, contextWindow: 8192 },
        { id: 'accounts/fireworks/models/mixtral-8x7b-instruct', name: 'Mixtral 8x7B', maxTokens: 32768, contextWindow: 32768 }
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

export class TogetherProvider extends Provider {
  constructor(config) {
    super({
      ...config,
      type: 'cloud',
      baseUrl: config.baseUrl || 'https://api.together.xyz/v1',
      models: config.models || [
        { id: 'togethercomputer/llama-2-70b-chat', name: 'Llama 2 70B', maxTokens: 4096, contextWindow: 4096 },
        { id: 'togethercomputer/m2-megatronb12-8b21k', name: 'M2 8B', maxTokens: 4096, contextWindow: 8192 }
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

export class AnyscaleProvider extends Provider {
  constructor(config) {
    super({
      ...config,
      type: 'cloud',
      baseUrl: config.baseUrl || 'https://api.endpoints.anyscale.com/v1',
      models: config.models || [
        { id: 'meta-llama/Llama-2-70b-chat-hf', name: 'Llama 2 70B', maxTokens: 4096, contextWindow: 4096 },
        { id: 'mistralai/Mistral-7B-Instruct-v0.1', name: 'Mistral 7B', maxTokens: 4096, contextWindow: 8192 }
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

export class CloudflareProvider extends Provider {
  constructor(config) {
    super({
      ...config,
      type: 'cloud',
      baseUrl: config.baseUrl || `https://api.cloudflare.com/client/v4/accounts/${config.accountId}/ai`,
      models: config.models || [
        { id: '@cf/meta/llama-3-8b-instruct', name: 'Llama 3 8B', maxTokens: 4096, contextWindow: 8192 },
        { id: '@cf/mistral/mistral-7b-instruct-v0.1', name: 'Mistral 7B', maxTokens: 4096, contextWindow: 8192 }
      ]
    });
  }

  async _executeChat(messages, options) {
    const body = {
      messages,
      stream: false
    };

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

export class StabilityAIProvider extends Provider {
  constructor(config) {
    super({
      ...config,
      type: 'cloud',
      baseUrl: config.baseUrl || 'https://api.stability.ai/v1',
      models: config.models || [
        { id: 'stable-diffusion-xl-1024-v1-0', name: 'SDXL 1024', maxTokens: 1024, contextWindow: 1024, type: 'image' },
        { id: 'stable-diffusion-v1-6', name: 'SD v1.6', maxTokens: 1024, contextWindow: 1024, type: 'image' }
      ]
    });
  }

  async _executeChat(messages, options) {
    const lastMessage = messages[messages.length - 1]?.content || '';
    
    const body = {
      text_prompts: [{ text: lastMessage }],
      cfg_scale: 7,
      steps: 30,
      width: 1024,
      height: 1024
    };

    const response = await this._request('POST', '/generation/stable-diffusion-xl-1024-v1-0/text-to-image', body);

    return {
      content: response.artifacts?.[0]?.base64 || '',
      role: 'assistant',
      finishReason: 'stop',
      usage: {},
      isImage: true
    };
  }

  async _checkHealth() {
    try {
      await this._request('GET', '/user/balance');
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

// ═══════════════════════════════════════════════════════════════════════════
// NEW PROVIDERS - xAI, Cerebras, SambaNova, SiliconFlow
// ═══════════════════════════════════════════════════════════════════════════

export class XAIProvider extends Provider {
  constructor(config) {
    super({ ...config, name: 'xAI', type: 'cloud' });
    this.baseUrl = config.baseUrl || 'https://api.x.ai/v1';
    this.registerModel({ id: 'grok-2', name: 'Grok 2', maxTokens: 131072, costPerToken: 0.00001 });
    this.registerModel({ id: 'grok-2-mini', name: 'Grok 2 Mini', maxTokens: 131072, costPerToken: 0.000003 });
  }

  async _executeChat(messages, options) {
    const body = { model: options.model || 'grok-2', messages: messages.map(m => ({ role: m.role, content: m.content })), temperature: options.temperature || 0.7, max_tokens: options.maxTokens || 4096, stream: false };
    const response = await this._request('POST', '/chat/completions', body);
    return { content: response.choices?.[0]?.message?.content || '', role: 'assistant', finishReason: response.choices?.[0]?.finish_reason || 'stop', usage: response.usage || {} };
  }

  async _checkHealth() { try { await this._request('GET', '/models'); return true; } catch { return false; } }

  async _request(method, path, body = null) {
    const url = new URL(path, this.baseUrl);
    return new Promise((resolve, reject) => {
      const req = https.request({ hostname: url.hostname, port: 443, path: url.pathname, method, headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${this.apiKey}` } }, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => { try { resolve(JSON.parse(data)); } catch { reject(new Error('Invalid JSON')); } });
      });
      req.on('error', reject);
      req.setTimeout(this.config.timeout, () => { req.destroy(); reject(new Error('Timeout')); });
      if (body) req.write(JSON.stringify(body));
      req.end();
    });
  }
}

export class CerebrasProvider extends Provider {
  constructor(config) {
    super({ ...config, name: 'Cerebras', type: 'cloud' });
    this.baseUrl = config.baseUrl || 'https://api.cerebras.ai/v1';
    this.registerModel({ id: 'llama3.1-70b', name: 'Llama 3.1 70B', maxTokens: 8192, costPerToken: 0.000006 });
    this.registerModel({ id: 'llama3.1-8b', name: 'Llama 3.1 8B', maxTokens: 8192, costPerToken: 0.000001 });
  }

  async _executeChat(messages, options) {
    const body = { model: options.model || 'llama3.1-70b', messages: messages.map(m => ({ role: m.role, content: m.content })), temperature: options.temperature || 0.7, max_tokens: options.maxTokens || 4096 };
    const response = await this._request('POST', '/chat/completions', body);
    return { content: response.choices?.[0]?.message?.content || '', role: 'assistant', finishReason: response.choices?.[0]?.finish_reason || 'stop', usage: response.usage || {} };
  }

  async _checkHealth() { try { await this._request('GET', '/models'); return true; } catch { return false; } }

  async _request(method, path, body = null) {
    const url = new URL(path, this.baseUrl);
    return new Promise((resolve, reject) => {
      const req = https.request({ hostname: url.hostname, port: 443, path: url.pathname, method, headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${this.apiKey}` } }, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => { try { resolve(JSON.parse(data)); } catch { reject(new Error('Invalid JSON')); } });
      });
      req.on('error', reject);
      req.setTimeout(this.config.timeout, () => { req.destroy(); reject(new Error('Timeout')); });
      if (body) req.write(JSON.stringify(body));
      req.end();
    });
  }
}

export class SambaNovaProvider extends Provider {
  constructor(config) {
    super({ ...config, name: 'SambaNova', type: 'cloud' });
    this.baseUrl = config.baseUrl || 'https://api.sambanova.ai/v1';
    this.registerModel({ id: 'llama3.1-405b', name: 'Llama 3.1 405B', maxTokens: 8192, costPerToken: 0.00001 });
    this.registerModel({ id: 'llama3.1-70b', name: 'Llama 3.1 70B', maxTokens: 8192, costPerToken: 0.000004 });
  }

  async _executeChat(messages, options) {
    const body = { model: options.model || 'llama3.1-70b', messages: messages.map(m => ({ role: m.role, content: m.content })), temperature: options.temperature || 0.7, max_tokens: options.maxTokens || 4096 };
    const response = await this._request('POST', '/chat/completions', body);
    return { content: response.choices?.[0]?.message?.content || '', role: 'assistant', finishReason: response.choices?.[0]?.finish_reason || 'stop', usage: response.usage || {} };
  }

  async _checkHealth() { try { await this._request('GET', '/models'); return true; } catch { return false; } }

  async _request(method, path, body = null) {
    const url = new URL(path, this.baseUrl);
    return new Promise((resolve, reject) => {
      const req = https.request({ hostname: url.hostname, port: 443, path: url.pathname, method, headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${this.apiKey}` } }, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => { try { resolve(JSON.parse(data)); } catch { reject(new Error('Invalid JSON')); } });
      });
      req.on('error', reject);
      req.setTimeout(this.config.timeout, () => { req.destroy(); reject(new Error('Timeout')); });
      if (body) req.write(JSON.stringify(body));
      req.end();
    });
  }
}

export class SiliconFlowProvider extends Provider {
  constructor(config) {
    super({ ...config, name: 'SiliconFlow', type: 'cloud' });
    this.baseUrl = config.baseUrl || 'https://api.siliconflow.cn/v1';
    this.registerModel({ id: 'qwen2.5-72b', name: 'Qwen 2.5 72B', maxTokens: 32768, costPerToken: 0.000002 });
    this.registerModel({ id: 'llama3.1-70b', name: 'Llama 3.1 70B', maxTokens: 32768, costPerToken: 0.000002 });
    this.registerModel({ id: 'deepseek-v2.5', name: 'DeepSeek V2.5', maxTokens: 32768, costPerToken: 0.000002 });
  }

  async _executeChat(messages, options) {
    const body = { model: options.model || 'qwen2.5-72b', messages: messages.map(m => ({ role: m.role, content: m.content })), temperature: options.temperature || 0.7, max_tokens: options.maxTokens || 4096 };
    const response = await this._request('POST', '/chat/completions', body);
    return { content: response.choices?.[0]?.message?.content || '', role: 'assistant', finishReason: response.choices?.[0]?.finish_reason || 'stop', usage: response.usage || {} };
  }

  async _checkHealth() { try { await this._request('GET', '/models'); return true; } catch { return false; } }

  async _request(method, path, body = null) {
    const url = new URL(path, this.baseUrl);
    return new Promise((resolve, reject) => {
      const req = https.request({ hostname: url.hostname, port: 443, path: url.pathname, method, headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${this.apiKey}` } }, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => { try { resolve(JSON.parse(data)); } catch { reject(new Error('Invalid JSON')); } });
      });
      req.on('error', reject);
      req.setTimeout(this.config.timeout, () => { req.destroy(); reject(new Error('Timeout')); });
      if (body) req.write(JSON.stringify(body));
      req.end();
    });
  }
}

export default {
  GoogleAIProvider,
  MistralProvider,
  CohereProvider,
  AI21Provider,
  MetaProvider,
  HuggingFaceProvider,
  ReplicateProvider,
  PerplexityProvider,
  GroqProvider,
  DeepSeekProvider,
  FireworksProvider,
  TogetherProvider,
  AnyscaleProvider,
  CloudflareProvider,
  StabilityAIProvider,
  XAIProvider,
  CerebrasProvider,
  SambaNovaProvider,
  SiliconFlowProvider
};
