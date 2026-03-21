#!/usr/bin/env node

import { EventEmitter } from 'events';
import { WebSocketServer, WebSocket } from 'ws';
import { createServer } from 'http';
import express from 'express';

// ═══════════════════════════════════════════════════════════════════════════
// COMPREHENSIVE CHANNEL SYSTEM
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Channel states
 */
export const ChannelState = {
  INITIALIZING: 'INITIALIZING',
  ACTIVE: 'ACTIVE',
  PAUSED: 'PAUSED',
  ERROR: 'ERROR',
  DISABLED: 'DISABLED'
};

/**
 * Message types
 */
export const MessageType = {
  TEXT: 'text',
  COMMAND: 'command',
  SYSTEM: 'system',
  TASK: 'task',
  RESULT: 'result',
  ERROR: 'error',
  NOTIFICATION: 'notification',
  FILE: 'file',
  IMAGE: 'image',
  AUDIO: 'audio',
  VIDEO: 'video',
  LOCATION: 'location',
  CONTACT: 'contact',
  STICKER: 'sticker',
  REACTION: 'reaction',
  THREAD: 'thread',
  TYPING: 'typing',
  PRESENCE: 'presence',
  ACK: 'ack',
  PING: 'ping',
  PONG: 'pong'
};

/**
 * Core Channel class - Base for all communication channels
 */
export class Channel extends EventEmitter {
  constructor(config) {
    super();

    this.id = config.id;
    this.name = config.name;
    this.type = config.type; // 'websocket', 'http', 'cli', 'slack', 'discord', 'telegram'
    this.enabled = config.enabled !== false;
    this.state = ChannelState.INITIALIZING;

    // Authentication
    this.auth = {
      required: config.auth?.required || false,
      type: config.auth?.type || 'token', // 'token', 'basic', 'oauth'
      validate: config.auth?.validate || null
    };

    // Sessions
    this.sessions = new Map();

    // Message handlers
    this.handlers = new Map();

    // Configuration
    this.config = {
      maxMessageSize: config.maxMessageSize || 1024 * 1024, // 1MB
      maxSessions: config.maxSessions || 1000,
      sessionTimeout: config.sessionTimeout || 3600000, // 1 hour
      ...config.config
    };

    // Statistics
    this.stats = {
      messagesSent: 0,
      messagesReceived: 0,
      activeSessions: 0,
      totalSessions: 0,
      errors: 0
    };
  }

  /**
   * Initialize the channel
   */
  async initialize() {
    try {
      await this._initialize();
      this.state = ChannelState.ACTIVE;
      this.emit('initialized', { channel: this.id });
    } catch (error) {
      this.state = ChannelState.ERROR;
      this.emit('error', { channel: this.id, error: error.message });
      throw error;
    }
  }

  /**
   * Channel-specific initialization
   */
  async _initialize() {
    // Override in subclass
  }

  /**
   * Register a message handler
   */
  registerHandler(type, handler) {
    if (!this.handlers.has(type)) {
      this.handlers.set(type, []);
    }
    this.handlers.get(type).push(handler);
  }

  /**
   * Handle incoming message
   */
  async handleMessage(message, session) {
    this.stats.messagesReceived += 1;

    // Process through handlers
    const handlers = this.handlers.get(message.type) || [];
    const defaultHandlers = this.handlers.get('*') || [];
    const allHandlers = [...handlers, ...defaultHandlers];

    for (const handler of allHandlers) {
      try {
        await handler(message, session);
      } catch (error) {
        this.emit('handler:error', { channel: this.id, error: error.message });
      }
    }

    this.emit('message:received', { channel: this.id, message, session });
  }

  /**
   * Send a message
   */
  async send(target, message, options = {}) {
    if (this.state !== ChannelState.ACTIVE) {
      throw new Error(`Channel ${this.name} is not active`);
    }

    const formattedMessage = this._formatMessage(message, options);

    try {
      await this._send(target, formattedMessage, options);
      this.stats.messagesSent += 1;
      this.emit('message:sent', { channel: this.id, target, message: formattedMessage });
    } catch (error) {
      this.stats.errors += 1;
      this.emit('send:error', { channel: this.id, target, error: error.message });
      throw error;
    }
  }

  /**
   * Send message - to be implemented by subclass
   */
  async _send(target, message, options) {
    throw new Error('_send must be implemented by subclass');
  }

  /**
   * Format message for channel
   */
  _formatMessage(message, options) {
    return {
      id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: options.type || MessageType.TEXT,
      content: typeof message === 'string' ? message : message.content,
      metadata: options.metadata || {},
      timestamp: Date.now(),
      channel: this.id
    };
  }

  /**
   * Create a session
   */
  createSession(sessionConfig) {
    const session = {
      id: sessionConfig.id || `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      channel: this.id,
      userId: sessionConfig.userId,
      metadata: sessionConfig.metadata || {},
      createdAt: Date.now(),
      lastActivity: Date.now(),
      messageCount: 0
    };

    this.sessions.set(session.id, session);
    this.stats.activeSessions = this.sessions.size;
    this.stats.totalSessions += 1;

    this.emit('session:created', { channel: this.id, session: session.id });
    return session;
  }

  /**
   * Get a session
   */
  getSession(sessionId) {
    return this.sessions.get(sessionId);
  }

  /**
   * Update session activity
   */
  updateSession(sessionId) {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.lastActivity = Date.now();
      session.messageCount += 1;
    }
    return session;
  }

  /**
   * End a session
   */
  endSession(sessionId) {
    const session = this.sessions.get(sessionId);
    if (session) {
      this.sessions.delete(sessionId);
      this.stats.activeSessions = this.sessions.size;
      this.emit('session:ended', { channel: this.id, session: sessionId });
    }
  }

  /**
   * Clean up expired sessions
   */
  cleanupSessions() {
    const now = Date.now();
    for (const [id, session] of this.sessions) {
      if (now - session.lastActivity > this.config.sessionTimeout) {
        this.endSession(id);
      }
    }
  }

  /**
   * Broadcast to all sessions
   */
  async broadcast(message, options = {}) {
    const promises = [];
    for (const [sessionId] of this.sessions) {
      promises.push(this.send(sessionId, message, options));
    }
    return Promise.allSettled(promises);
  }

  /**
   * Get channel status
   */
  getStatus() {
    return {
      id: this.id,
      name: this.name,
      type: this.type,
      state: this.state,
      enabled: this.enabled,
      stats: this.stats,
      sessions: this.sessions.size
    };
  }

  /**
   * Pause the channel
   */
  pause() {
    this.state = ChannelState.PAUSED;
    this.emit('paused', { channel: this.id });
  }

  /**
   * Resume the channel
   */
  resume() {
    if (this.state === ChannelState.PAUSED) {
      this.state = ChannelState.ACTIVE;
      this.emit('resumed', { channel: this.id });
    }
  }

  /**
   * Stop the channel
   */
  async stop() {
    this.state = ChannelState.DISABLED;
    this.enabled = false;

    // End all sessions
    for (const [sessionId] of this.sessions) {
      this.endSession(sessionId);
    }

    await this._cleanup();
    this.emit('stopped', { channel: this.id });
  }

  /**
   * Cleanup - to be implemented by subclass
   */
  async _cleanup() {
    // Override in subclass
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// WEBSOCKET CHANNEL
// ═══════════════════════════════════════════════════════════════════════════

export class WebSocketChannel extends Channel {
  constructor(config) {
    super({
      ...config,
      type: 'websocket'
    });

    this.server = null;
    this.wss = null;
    this.connections = new Map();
  }

  async _initialize() {
    const port = this.config.port || 8080;

    // Create HTTP server if not provided
    if (!this.config.server) {
      this.server = createServer();
    } else {
      this.server = this.config.server;
    }

    // Create WebSocket server
    this.wss = new WebSocketServer({
      server: this.server,
      path: this.config.path || '/ws',
      maxPayload: this.config.maxMessageSize
    });

    // Handle connections
    this.wss.on('connection', (ws, req) => {
      this._handleConnection(ws, req);
    });

    // Start server if we created it
    if (!this.config.server) {
      await new Promise((resolve) => {
        this.server.listen(port, () => {
          resolve();
        });
      });
    }

    // Cleanup interval
    setInterval(() => this.cleanupSessions(), 60000);
  }

  _handleConnection(ws, req) {
    const connectionId = `conn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Create session for this connection
    const session = this.createSession({
      id: connectionId,
      userId: req.headers['x-user-id'] || 'anonymous',
      metadata: {
        ip: req.socket.remoteAddress,
        userAgent: req.headers['user-agent']
      }
    });

    // Store connection
    this.connections.set(connectionId, { ws, session });

    // Handle messages
    ws.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString());
        this.updateSession(connectionId);
        this.handleMessage(message, session);
      } catch (error) {
        ws.send(JSON.stringify({
          type: 'error',
          error: 'Invalid message format'
        }));
      }
    });

    // Handle close
    ws.on('close', () => {
      this.connections.delete(connectionId);
      this.endSession(connectionId);
      this.emit('connection:closed', { channel: this.id, connectionId });
    });

    // Handle errors
    ws.on('error', (error) => {
      this.emit('connection:error', { channel: this.id, connectionId, error: error.message });
    });

    // Send welcome message
    ws.send(JSON.stringify({
      type: 'system',
      content: 'Connected to NEXUS',
      sessionId: connectionId
    }));

    this.emit('connection:opened', { channel: this.id, connectionId });
  }

  async _send(target, message, options) {
    const connection = this.connections.get(target);
    if (!connection) {
      throw new Error(`Connection not found: ${target}`);
    }

    const { ws } = connection;

    if (ws.readyState !== WebSocket.OPEN) {
      throw new Error('WebSocket not open');
    }

    ws.send(JSON.stringify(message));
  }

  async _cleanup() {
    // Close all connections
    for (const [id, { ws }] of this.connections) {
      ws.close(1000, 'Server shutting down');
    }
    this.connections.clear();

    // Close WebSocket server
    if (this.wss) {
      await new Promise((resolve) => {
        this.wss.close(resolve);
      });
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// HTTP/REST CHANNEL
// ═══════════════════════════════════════════════════════════════════════════

export class HTTPChannel extends Channel {
  constructor(config) {
    super({
      ...config,
      type: 'http'
    });

    this.app = null;
    this.server = null;
  }

  async _initialize() {
    const port = this.config.port || 3000;

    this.app = express();
    this.app.use(express.json({ limit: '1mb' }));

    // Request ID middleware
    this.app.use((req, res, next) => {
      req.requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      res.setHeader('X-Request-ID', req.requestId);
      next();
    });

    // Health endpoint
    this.app.get('/health', (req, res) => {
      res.json({ status: 'ok', channel: this.id });
    });

    // Message endpoint
    this.app.post('/message', async (req, res) => {
      try {
        const message = req.body;
        const session = this.createSession({
          userId: req.headers['x-user-id'] || 'anonymous',
          metadata: { ip: req.ip }
        });

        await this.handleMessage(message, session);

        res.json({
          success: true,
          sessionId: session.id,
          requestId: req.requestId
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: error.message,
          requestId: req.requestId
        });
      }
    });

    // Create server
    this.server = this.app;

    // Listen if port specified
    if (port && !this.config.server) {
      const httpServer = createServer(this.app);
      await new Promise((resolve) => {
        httpServer.listen(port, () => {
          this.server = httpServer;
          resolve();
        });
      });
    }
  }

  async _send(target, message, options) {
    // HTTP is request/response, so "sending" means responding to a request
    // This would be used for webhooks or callbacks
    const url = target;
    const urlObj = new URL(url);

    // Dynamic import based on protocol
    let transport;
    if (urlObj.protocol === 'https:') {
      transport = await import('https');
    } else {
      transport = await import('http');
    }

    return new Promise((resolve, reject) => {
      const req = transport.default.request(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...options.headers
        }
      }, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          resolve({ status: res.statusCode, data });
        });
      });

      req.on('error', reject);
      req.write(JSON.stringify(message));
      req.end();
    });
  }

  async _cleanup() {
    if (this.server && this.server.close) {
      await new Promise((resolve) => {
        this.server.close(resolve);
      });
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// CLI CHANNEL
// ═══════════════════════════════════════════════════════════════════════════

export class CLIChannel extends Channel {
  constructor(config) {
    super({
      ...config,
      type: 'cli'
    });

    this.readline = null;
    this.session = null;
  }

  async _initialize() {
    // CLI runs in current terminal
    this.session = this.createSession({
      id: 'cli_terminal',
      userId: 'local',
      metadata: { type: 'terminal' }
    });

    // Register default handlers
    this.registerHandler(MessageType.COMMAND, async (message, session) => {
      if (message.content === '/exit') {
        this.emit('exit', { channel: this.id });
      }
    });
  }

  async _send(target, message, options) {
    // Output to console
    const output = typeof message === 'string' ? message : JSON.stringify(message, null, 2);
    console.log(output);
  }

  /**
   * Read input from CLI
   */
  async readInput(prompt = '> ') {
    const readline = await import('readline');

    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    return new Promise((resolve) => {
      rl.question(prompt, (answer) => {
        rl.close();
        resolve(answer);
      });
    });
  }

  async _cleanup() {
    // Nothing to clean up for CLI
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// SLACK CHANNEL
// ═══════════════════════════════════════════════════════════════════════════

export class SlackChannel extends Channel {
  constructor(config) {
    super({
      ...config,
      type: 'slack'
    });

    this.token = config.token;
    this.appToken = config.appToken;
    this.signingSecret = config.signingSecret;
  }

  async _initialize() {
    if (!this.token) {
      throw new Error('Slack token is required');
    }

    // Slack integration would use @slack/bolt or @slack/web-api
    // This is a simplified implementation
    this.registerHandler(MessageType.TEXT, async (message, session) => {
      // Handle incoming Slack messages
      this.emit('slack:message', { message, session });
    });
  }

  async _send(target, message, options = {}) {
    const content = typeof message === 'string' ? message : message.content;

    // Use Slack API to send message
    const response = await fetch('https://slack.com/api/chat.postMessage', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.token}`
      },
      body: JSON.stringify({
        channel: target,
        text: content,
        ...options.slackOptions
      })
    });

    const result = await response.json();

    if (!result.ok) {
      throw new Error(`Slack API error: ${result.error}`);
    }

    return result;
  }

  async _cleanup() {
    // Cleanup Slack connections
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// DISCORD CHANNEL
// ═══════════════════════════════════════════════════════════════════════════

export class DiscordChannel extends Channel {
  constructor(config) {
    super({
      ...config,
      type: 'discord'
    });

    this.token = config.token;
    this.clientId = config.clientId;
    this.guildId = config.guildId;
    this.webhookUrl = config.webhookUrl;
    this.ws = null;
    this.heartbeatInterval = null;
    this.sequenceNumber = null;
    this.sessionId = null;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
  }

  async _initialize() {
    if (!this.token) {
      throw new Error('Discord bot token is required');
    }

    // Get gateway URL and connect
    await this._connectGateway();

    // Register message handlers
    this.registerHandler(MessageType.TEXT, async (message, session) => {
      this.emit('discord:message', { message, session });
    });

    this.registerHandler(MessageType.COMMAND, async (message, session) => {
      this.emit('discord:command', { message, session });
    });
  }

  async _connectGateway() {
    try {
      // Get gateway URL from Discord API
      const response = await fetch('https://discord.com/api/v10/gateway/bot', {
        headers: {
          'Authorization': `Bot ${this.token}`
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to get gateway: ${response.status}`);
      }

      const data = await response.json();
      const gatewayUrl = data.url;

      // Connect to WebSocket
      await this._connectWebSocket(gatewayUrl);
    } catch (error) {
      console.error('Discord gateway connection error:', error);
      throw error;
    }
  }

  async _connectWebSocket(gatewayUrl) {
    return new Promise((resolve, reject) => {
      // Dynamic import of ws
      import('ws').then(({ WebSocket }) => {
        this.ws = new WebSocket(`${gatewayUrl}?v=10&encoding=json`);

        this.ws.on('open', () => {
          this.reconnectAttempts = 0;
          this.stats.activeSessions++;
          resolve();
        });

        this.ws.on('message', (data) => {
          try {
            const payload = JSON.parse(data.toString());
            this._handleGatewayEvent(payload);
          } catch (error) {
            console.error('Discord message parse error:', error);
          }
        });

        this.ws.on('close', (code, reason) => {
          this.stats.activeSessions = Math.max(0, this.stats.activeSessions - 1);
          this._handleDisconnect(code, reason);
        });

        this.ws.on('error', (error) => {
          this.stats.errors++;
          this.emit('error', { channel: this.id, error: error.message });
        });
      }).catch(reject);
    });
  }

  _handleGatewayEvent(payload) {
    const { op, d, s, t } = payload;

    switch (op) {
      case 10: // Hello
        this._startHeartbeat(d.heartbeat_interval);
        // Identify after heartbeat setup
        this._identify();
        break;

      case 11: // Heartbeat ACK
        break;

      case 0: // Dispatch
        this.sequenceNumber = s;
        this._handleDispatch(t, d);
        break;

      case 7: // Reconnect
        this._reconnect();
        break;

      case 9: // Invalid Session
        this._identify();
        break;
    }
  }

  _startHeartbeat(interval) {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }

    this.heartbeatInterval = setInterval(() => {
      this._sendGatewayOp(1, this.sequenceNumber);
    }, interval);
  }

  _identify() {
    const payload = {
      token: this.token,
      intents: 512 + 1 + 4096, // GUILDS + GUILD_MESSAGES + MESSAGE_CONTENT
      properties: {
        os: 'linux',
        browser: 'nexus-platform',
        device: 'nexus'
      }
    };

    this._sendGatewayOp(2, payload);
  }

  _sendGatewayOp(op, d) {
    if (this.ws && this.ws.readyState === 1) {
      this.ws.send(JSON.stringify({ op, d }));
    }
  }

  _handleDispatch(eventType, data) {
    switch (eventType) {
      case 'MESSAGE_CREATE':
        this._handleMessageCreate(data);
        break;
      case 'READY':
        this.sessionId = data.session_id;
        this.emit('ready', { user: data.user });
        break;
    }
  }

  _handleMessageCreate(data) {
    const message = {
      id: data.id,
      content: data.content,
      author: {
        id: data.author.id,
        username: data.author.username,
        discriminator: data.author.discriminator
      },
      channel: {
        id: data.channel_id
      },
      guild: {
        id: data.guild_id
      },
      timestamp: new Date(data.timestamp).getTime()
    };

    const session = this.createSession({
      id: `discord_${data.author.id}_${data.channel_id}`,
      userId: data.author.id,
      metadata: {
        channel: data.channel_id,
        guild: data.guild_id
      }
    });

    this.handleMessage({
      type: data.content.startsWith('!') ? MessageType.COMMAND : MessageType.TEXT,
      content: data.content,
      raw: message
    }, session);

    this.stats.messagesReceived++;
  }

  _handleDisconnect(code, reason) {
    console.log(`Discord disconnected: ${code} - ${reason}`);

    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }

    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
      this.reconnectAttempts++;

      setTimeout(() => {
        this._connectGateway();
      }, delay);
    } else {
      this.emit('fatal:error', { channel: this.id, error: 'Max reconnect attempts reached' });
    }
  }

  _reconnect() {
    if (this.ws) {
      this.ws.close();
    }
    this._connectGateway();
  }

  async _send(target, message, options = {}) {
    const content = typeof message === 'string' ? message : message.content;

    // Use Discord REST API to send message
    const response = await fetch(`https://discord.com/api/v10/channels/${target}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bot ${this.token}`
      },
      body: JSON.stringify({
        content: content,
        ...options.discordOptions
      })
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(`Discord API error: ${result.message || response.status}`);
    }

    this.stats.messagesSent++;
    return result;
  }

  async sendEmbed(channelId, embed, options = {}) {
    const response = await fetch(`https://discord.com/api/v10/channels/${channelId}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bot ${this.token}`
      },
      body: JSON.stringify({
        embeds: [embed],
        ...options.discordOptions
      })
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(`Discord API error: ${result.message || response.status}`);
    }

    this.stats.messagesSent++;
    return result;
  }

  async _cleanup() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }

    if (this.ws) {
      this.ws.close(1000, 'Server shutdown');
      this.ws = null;
    }

    this.stats.activeSessions = 0;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// TELEGRAM CHANNEL
// ═══════════════════════════════════════════════════════════════════════════

export class TelegramChannel extends Channel {
  constructor(config) {
    super({
      ...config,
      type: 'telegram'
    });

    this.token = config.token;
    this.webhookUrl = config.webhookUrl;
    this.polling = config.polling !== false;
    this.pollingInterval = config.pollingInterval || 1000;
    this.offset = 0;
    this.pollingTimer = null;
  }

  async _initialize() {
    if (!this.token) {
      throw new Error('Telegram bot token is required');
    }

    // Verify token and get bot info
    const botInfo = await this._getBotInfo();
    this.botUsername = botInfo.username;
    this.botId = botInfo.id;

    // Start polling or set up webhook
    if (this.polling) {
      await this._startPolling();
    }

    // Register message handlers
    this.registerHandler(MessageType.TEXT, async (message, session) => {
      this.emit('telegram:message', { message, session });
    });

    this.registerHandler(MessageType.COMMAND, async (message, session) => {
      this.emit('telegram:command', { message, session });
    });
  }

  async _getBotInfo() {
    const response = await fetch(`https://api.telegram.org/bot${this.token}/getMe`);

    if (!response.ok) {
      throw new Error(`Failed to get bot info: ${response.status}`);
    }

    const data = await response.json();

    if (!data.ok) {
      throw new Error(`Telegram API error: ${data.description}`);
    }

    return data.result;
  }

  async _startPolling() {
    // Delete any pending updates
    await fetch(`https://api.telegram.org/bot${this.token}/deleteWebhook`);

    // Start polling
    this._poll();
  }

  async _poll() {
    try {
      const response = await fetch(
        `https://api.telegram.org/bot${this.token}/getUpdates?offset=${this.offset}&timeout=30`
      );

      if (!response.ok) {
        console.error('Telegram polling error:', response.status);
        return;
      }

      const data = await response.json();

      if (!data.ok) {
        console.error('Telegram API error:', data.description);
        return;
      }

      // Process updates
      for (const update of data.result) {
        this.offset = update.update_id + 1;
        this._handleUpdate(update);
      }
    } catch (error) {
      console.error('Telegram polling error:', error);
    }

    // Continue polling
    if (this.polling) {
      this.pollingTimer = setTimeout(() => this._poll(), this.pollingInterval);
    }
  }

  _handleUpdate(update) {
    // Handle message
    if (update.message) {
      this._handleMessage(update.message);
    }

    // Handle callback query (inline keyboard)
    if (update.callback_query) {
      this._handleCallbackQuery(update.callback_query);
    }

    // Handle edited message
    if (update.edited_message) {
      this._handleMessage(update.edited_message, true);
    }
  }

  _handleMessage(message, isEdited = false) {
    const session = this.createSession({
      id: `telegram_${message.chat.id}_${message.from.id}`,
      userId: message.from.id.toString(),
      metadata: {
        chat: message.chat.id,
        chatType: message.chat.type,
        username: message.from.username
      }
    });

    let content = message.text || message.caption || '';

    // Check if it's a command
    let type = MessageType.TEXT;
    if (content.startsWith('/')) {
      type = MessageType.COMMAND;
      content = content.slice(1).split(' ')[0]; // Extract command name
    }

    this.handleMessage({
      type,
      content,
      raw: message,
      isEdited
    }, session);

    this.stats.messagesReceived++;
  }

  _handleCallbackQuery(callbackQuery) {
    const session = this.createSession({
      id: `telegram_cb_${callbackQuery.from.id}`,
      userId: callbackQuery.from.id.toString(),
      metadata: {
        callbackId: callbackQuery.id,
        message: callbackQuery.message?.message_id
      }
    });

    this.handleMessage({
      type: MessageType.COMMAND,
      content: callbackQuery.data,
      raw: callbackQuery
    }, session);
  }

  async _send(target, message, options = {}) {
    const content = typeof message === 'string' ? message : message.content;

    const params = {
      chat_id: target,
      text: content,
      parse_mode: options.parseMode || 'HTML',
      ...options.telegramOptions
    };

    const response = await fetch(`https://api.telegram.org/bot${this.token}/sendMessage`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(params)
    });

    const result = await response.json();

    if (!result.ok) {
      throw new Error(`Telegram API error: ${result.description}`);
    }

    this.stats.messagesSent++;
    return result.result;
  }

  async sendPhoto(chatId, photo, options = {}) {
    const params = {
      chat_id: chatId,
      photo: photo,
      ...options.telegramOptions
    };

    const response = await fetch(`https://api.telegram.org/bot${this.token}/sendPhoto`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(params)
    });

    const result = await response.json();

    if (!result.ok) {
      throw new Error(`Telegram API error: ${result.description}`);
    }

    this.stats.messagesSent++;
    return result.result;
  }

  async sendDocument(chatId, document, options = {}) {
    const params = {
      chat_id: chatId,
      document: document,
      ...options.telegramOptions
    };

    const response = await fetch(`https://api.telegram.org/bot${this.token}/sendDocument`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(params)
    });

    const result = await response.json();

    if (!result.ok) {
      throw new Error(`Telegram API error: ${result.description}`);
    }

    this.stats.messagesSent++;
    return result.result;
  }

  async sendKeyboard(chatId, text, keyboard, options = {}) {
    const params = {
      chat_id: chatId,
      text: text,
      reply_markup: {
        keyboard: keyboard,
        one_time_keyboard: options.oneTime || false,
        resize_keyboard: options.resize || true
      },
      ...options.telegramOptions
    };

    const response = await fetch(`https://api.telegram.org/bot${this.token}/sendMessage`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(params)
    });

    const result = await response.json();

    if (!result.ok) {
      throw new Error(`Telegram API error: ${result.description}`);
    }

    this.stats.messagesSent++;
    return result.result;
  }

  async answerCallbackQuery(callbackQueryId, text = '', options = {}) {
    const params = {
      callback_query_id: callbackQueryId,
      text: text,
      show_alert: options.alert || false
    };

    const response = await fetch(`https://api.telegram.org/bot${this.token}/answerCallbackQuery`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(params)
    });

    const result = await response.json();
    return result.ok;
  }

  async _cleanup() {
    this.polling = false;

    if (this.pollingTimer) {
      clearTimeout(this.pollingTimer);
      this.pollingTimer = null;
    }

    // Set webhook if configured, otherwise delete it
    if (this.webhookUrl) {
      await fetch(`https://api.telegram.org/bot${this.token}/setWebhook?url=${this.webhookUrl}`);
    } else {
      await fetch(`https://api.telegram.org/bot${this.token}/deleteWebhook`);
    }

    this.stats.activeSessions = 0;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// CHANNEL MANAGER - Routes messages between channels
// ═══════════════════════════════════════════════════════════════════════════

export class ChannelManager extends EventEmitter {
  constructor() {
    super();

    this.channels = new Map();
    this.routes = new Map(); // Route patterns to channels
    this.bridge = new Map(); // Channel bridges
  }

  /**
   * Register a channel
   */
  async register(channel) {
    if (!(channel instanceof Channel)) {
      throw new Error('Must be a Channel instance');
    }

    this.channels.set(channel.id, channel);

    // Forward events
    channel.on('message:received', (data) => this.emit('message:received', data));
    channel.on('message:sent', (data) => this.emit('message:sent', data));
    channel.on('error', (data) => this.emit('channel:error', data));

    // Initialize
    await channel.initialize();

    this.emit('channel:registered', { channel: channel.id });
    return this;
  }

  /**
   * Unregister a channel
   */
  async unregister(channelId) {
    const channel = this.channels.get(channelId);
    if (channel) {
      await channel.stop();
      this.channels.delete(channelId);
      this.emit('channel:unregistered', { channel: channelId });
    }
  }

  /**
   * Get a channel
   */
  get(channelId) {
    return this.channels.get(channelId);
  }

  /**
   * Get all channels
   */
  getAll() {
    return Array.from(this.channels.values());
  }

  /**
   * Get active channels
   */
  getActive() {
    return this.getAll().filter(c => c.state === ChannelState.ACTIVE);
  }

  /**
   * Add a route pattern
   */
  addRoute(pattern, channelId) {
    this.routes.set(pattern, channelId);
  }

  /**
   * Route a message to appropriate channel
   */
  async route(message) {
    // Find matching route
    let targetChannel = null;

    for (const [pattern, channelId] of this.routes) {
      if (message.type === pattern || message.channel === pattern) {
        targetChannel = this.channels.get(channelId);
        break;
      }
    }

    if (!targetChannel) {
      // Default to first active channel
      const active = this.getActive();
      if (active.length > 0) {
        targetChannel = active[0];
      }
    }

    if (!targetChannel) {
      throw new Error('No available channel for routing');
    }

    return targetChannel.send(message.target || 'default', message);
  }

  /**
   * Bridge two channels
   */
  bridgeChannels(channel1Id, channel2Id, options = {}) {
    const channel1 = this.channels.get(channel1Id);
    const channel2 = this.channels.get(channel2Id);

    if (!channel1 || !channel2) {
      throw new Error('Both channels must exist');
    }

    const bridgeId = `bridge_${channel1Id}_${channel2Id}`;

    // Forward messages between channels
    channel1.on('message:received', async (data) => {
      if (options.bidirectional !== false) {
        await channel2.send('bridge', data.message);
      }
    });

    channel2.on('message:received', async (data) => {
      if (options.bidirectional) {
        await channel1.send('bridge', data.message);
      }
    });

    this.bridge.set(bridgeId, { channel1, channel2, options });
    return bridgeId;
  }

  /**
   * Broadcast to all channels
   */
  async broadcast(message, options = {}) {
    const promises = [];

    for (const channel of this.channels.values()) {
      if (channel.state === ChannelState.ACTIVE) {
        promises.push(channel.broadcast(message, options));
      }
    }

    return Promise.allSettled(promises);
  }

  /**
   * Get manager status
   */
  getStatus() {
    const channels = this.getAll();

    return {
      total: channels.length,
      active: channels.filter(c => c.state === ChannelState.ACTIVE).length,
      paused: channels.filter(c => c.state === ChannelState.PAUSED).length,
      error: channels.filter(c => c.state === ChannelState.ERROR).length,
      bridges: this.bridge.size,
      routes: this.routes.size,
      channels: channels.map(c => c.getStatus())
    };
  }

  /**
   * Health check all channels
   */
  async healthCheck() {
    const results = [];

    for (const channel of this.channels.values()) {
      results.push({
        channel: channel.id,
        state: channel.state,
        enabled: channel.enabled,
        stats: channel.stats
      });
    }

    return results;
  }

  /**
   * Stop all channels
   */
  async stopAll() {
    const promises = [];

    for (const channel of this.channels.values()) {
      promises.push(channel.stop());
    }

    await Promise.allSettled(promises);
    this.emit('all:stopped');
  }

  /**
   * Broadcast to channels of a specific type
   */
  async broadcastToType(type, message, options = {}) {
    const targets = this.getAll().filter(c => c.type === type && c.state === ChannelState.ACTIVE);
    const results = await Promise.allSettled(
      targets.map(c => c.send(options.target || 'default', message))
    );
    return { sent: results.filter(r => r.status === 'fulfilled').length, total: targets.length };
  }

  /**
   * Send to a specific channel by ID
   */
  async sendTo(channelId, target, message) {
    const channel = this.channels.get(channelId);
    if (!channel) throw new Error(`Channel not found: ${channelId}`);
    return channel.send(target, message);
  }

  /**
   * Get channels by type
   */
  getByType(type) {
    return this.getAll().filter(c => c.type === type);
  }

  /**
   * Enable/disable a channel
   */
  setEnabled(channelId, enabled) {
    const channel = this.channels.get(channelId);
    if (channel) channel.enabled = enabled;
    return this;
  }

  /**
   * Remove a route
   */
  removeRoute(pattern) {
    this.routes.delete(pattern);
  }

  /**
   * Get all route patterns
   */
  getRoutes() {
    return Object.fromEntries(this.routes.entries());
  }
}

// Export singleton
let manager = null;

export function getChannelManager() {
  if (!manager) {
    manager = new ChannelManager();
  }
  return manager;
}

export default {
  Channel,
  ChannelState,
  MessageType,
  WebSocketChannel,
  HTTPChannel,
  CLIChannel,
  SlackChannel,
  DiscordChannel,
  TelegramChannel,
  ChannelManager,
  getChannelManager
};