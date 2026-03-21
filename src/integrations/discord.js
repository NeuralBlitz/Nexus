#!/usr/bin/env node

import { EventEmitter } from 'events';

// ═══════════════════════════════════════════════════════════════════════════
// DISCORD INTEGRATION
// Bot interactions, slash commands, embeds, reactions, threads
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Discord embed colors
 */
export const EmbedColor = {
  PRIMARY: 0x5865F2,
  SUCCESS: 0x57F287,
  WARNING: 0xFEE75C,
  DANGER: 0xED4245,
  INFO: 0x3498DB
};

/**
 * Discord Embed builder
 */
export class EmbedBuilder {
  constructor() {
    this.embed = {
      title: null,
      description: null,
      url: null,
      color: null,
      timestamp: null,
      footer: null,
      image: null,
      thumbnail: null,
      author: null,
      fields: []
    };
  }

  setTitle(title) {
    this.embed.title = title;
    return this;
  }

  setDescription(description) {
    this.embed.description = description;
    return this;
  }

  setColor(color) {
    this.embed.color = color;
    return this;
  }

  setURL(url) {
    this.embed.url = url;
    return this;
  }

  setTimestamp(timestamp = new Date()) {
    this.embed.timestamp = timestamp.toISOString();
    return this;
  }

  setFooter(text, iconURL = null) {
    this.embed.footer = { text, icon_url: iconURL };
    return this;
  }

  setAuthor(name, url = null, iconURL = null) {
    this.embed.author = { name, url, icon_url: iconURL };
    return this;
  }

  setImage(url) {
    this.embed.image = { url };
    return this;
  }

  setThumbnail(url) {
    this.embed.thumbnail = { url };
    return this;
  }

  addField(name, value, inline = false) {
    if (this.embed.fields.length >= 25) {
      throw new Error('Embeds can have at most 25 fields');
    }
    this.embed.fields.push({ name, value, inline });
    return this;
  }

  toJSON() {
    return this.embed;
  }
}

/**
 * Discord Message
 */
export class DiscordMessage {
  constructor(data) {
    this.id = data.id;
    this.content = data.content || '';
    this.author = data.author || null;
    this.channelId = data.channel_id;
    this.guildId = data.guild_id || null;
    this.timestamp = data.timestamp || Date.now();
    this.embeds = data.embeds || [];
    this.attachments = data.attachments || [];
    this.reactions = data.reactions || [];
    this.mentions = data.mentions || [];
    this.reference = data.message_reference || null;
  }

  /**
   * Check if message mentions the bot
   */
  mentionsBot(botId) {
    return this.mentions.some(m => m.id === botId);
  }

  /**
   * Check if message contains command
   */
  hasCommand(prefix = '/') {
    return this.content.startsWith(prefix);
  }

  /**
   * Parse command and arguments
   */
  parseCommand(prefix = '/') {
    if (!this.hasCommand(prefix)) return null;

    const content = this.content.slice(prefix.length);
    const parts = content.split(/\s+/);
    const command = parts[0].toLowerCase();
    const args = parts.slice(1);

    return { command, args, raw: content };
  }

  /**
   * To JSON
   */
  toJSON() {
    return {
      id: this.id,
      content: this.content,
      author: this.author,
      channel_id: this.channelId,
      timestamp: this.timestamp
    };
  }
}

/**
 * Discord Bot Client
 */
export class DiscordClient extends EventEmitter {
  constructor(options = {}) {
    super();

    this.token = options.token || process.env.DISCORD_BOT_TOKEN;
    this.applicationId = options.applicationId || process.env.DISCORD_APPLICATION_ID;
    this.publicKey = options.publicKey || process.env.DISCORD_PUBLIC_KEY;

    // State
    this.connected = false;
    this.user = null;
    this.guilds = new Map();
    this.channels = new Map();

    // Command handlers
    this.commands = new Map();
    this.commandHandlers = new Map();

    // Intents
    this.intents = options.intents || [
      'GUILDS',
      'GUILD_MESSAGES',
      'MESSAGE_CONTENT',
      'GUILD_MEMBERS',
      'DIRECT_MESSAGES'
    ];

    // Rate limiting
    this.rateLimits = new Map();
    this.globalRateLimit = { remaining: 50, resetAt: Date.now() + 1000 };
  }

  /**
   * Register a slash command
   */
  registerCommand(command) {
    this.commands.set(command.name, command);

    if (command.handler) {
      this.commandHandlers.set(command.name, command.handler);
    }

    return this;
  }

  /**
   * Register multiple commands
   */
  registerCommands(commands) {
    for (const command of commands) {
      this.registerCommand(command);
    }
    return this;
  }

  /**
   * Handle incoming interaction
   */
  async handleInteraction(interaction) {
    if (interaction.type === 1) { // PING
      return { type: 1 };
    }

    if (interaction.type === 2) { // APPLICATION_COMMAND
      const commandName = interaction.data.name;
      const handler = this.commandHandlers.get(commandName);

      if (handler) {
        try {
          const result = await handler(interaction);
          return result || this.acknowledge();
        } catch (error) {
          this.emit('error', { type: 'command', error, command: commandName });
          return this.createErrorResponse(error.message);
        }
      }
    }

    if (interaction.type === 3) { // MESSAGE_COMPONENT
      const customId = interaction.data.custom_id;
      this.emit('component', { customId, interaction });
    }

    return this.acknowledge();
  }

  /**
   * Create acknowledgment response
   */
  acknowledge() {
    return { type: 1 };
  }

  /**
   * Create message response
   */
  createMessageResponse(content, options = {}) {
    return {
      type: 4,
      data: {
        content,
        embeds: options.embeds,
        components: options.components,
        flags: options.ephemeral ? 64 : 0
      }
    };
  }

  /**
   * Create error response
   */
  createErrorResponse(error, ephemeral = true) {
    return {
      type: 4,
      data: {
        content: `❌ Error: ${error}`,
        flags: ephemeral ? 64 : 0
      }
    };
  }

  /**
   * Send message to channel
   */
  async sendMessage(channelId, content, options = {}) {
    const body = {
      content,
      embeds: options.embeds,
      components: options.components,
      tts: options.tts || false,
      flags: options.flags || 0
    };

    return this._request('POST', `/channels/${channelId}/messages`, body);
  }

  /**
   * Edit message
   */
  async editMessage(channelId, messageId, content, options = {}) {
    const body = {
      content,
      embeds: options.embeds,
      components: options.components
    };

    return this._request('PATCH', `/channels/${channelId}/messages/${messageId}`, body);
  }

  /**
   * Delete message
   */
  async deleteMessage(channelId, messageId) {
    return this._request('DELETE', `/channels/${channelId}/messages/${messageId}`);
  }

  /**
   * Add reaction to message
   */
  async addReaction(channelId, messageId, emoji) {
    const encodedEmoji = encodeURIComponent(emoji);
    return this._request('PUT', `/channels/${channelId}/messages/${messageId}/reactions/${encodedEmoji}/@me`);
  }

  /**
   * Send DM to user
   */
  async sendDM(userId, content, options = {}) {
    // Create DM channel
    const dmChannel = await this._request('POST', '/users/@me/channels', { recipient_id: userId });
    return this.sendMessage(dmChannel.id, content, options);
  }

  /**
   * List guild members
   */
  async listMembers(guildId, options = {}) {
    const { limit = 100, after = '0' } = options;
    return this._request('GET', `/guilds/${guildId}/members?limit=${limit}&after=${after}`);
  }

  /**
   * Get guild member
   */
  async getMember(guildId, userId) {
    return this._request('GET', `/guilds/${guildId}/members/${userId}`);
  }

  /**
   * List channels in guild
   */
  async listChannels(guildId) {
    return this._request('GET', `/guilds/${guildId}/channels`);
  }

  /**
   * Create channel
   */
  async createChannel(guildId, channel) {
    return this._request('POST', `/guilds/${guildId}/channels`, channel);
  }

  /**
   * Make API request
   */
  async _request(method, path, body = null) {
    const url = `https://discord.com/api/v10${path}`;

    const options = {
      method,
      headers: {
        'Authorization': `Bot ${this.token}`,
        'Content-Type': 'application/json'
      }
    };

    if (body) {
      options.body = JSON.stringify(body);
    }

    const response = await fetch(url, options);

    if (response.status === 204) {
      return null;
    }

    const data = await response.json();

    if (!response.ok) {
      throw new Error(`Discord API error: ${response.status} - ${data.message}`);
    }

    return data;
  }
}

/**
 * Discord Webhook Client
 */
export class DiscordWebhook {
  constructor(url) {
    this.url = url;
  }

  /**
   * Send message via webhook
   */
  async send(content, options = {}) {
    const body = {
      content,
      username: options.username,
      avatar_url: options.avatarUrl,
      embeds: options.embeds?.map(e => e.toJSON ? e.toJSON() : e),
      tts: options.tts || false
    };

    const response = await fetch(this.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      throw new Error(`Webhook error: ${response.status}`);
    }

    return response.json();
  }

  /**
   * Send embed via webhook
   */
  async sendEmbed(embed) {
    return this.send(null, { embeds: [embed.toJSON ? embed.toJSON() : embed] });
  }
}

/**
 * Discord Integration Manager
 */
export class DiscordIntegrationManager extends EventEmitter {
  constructor() {
    super();

    this.bots = new Map();
    this.webhooks = new Map();
    this.commandRouter = new Map();
  }

  /**
   * Create and register a bot
   */
  createBot(config) {
    const bot = new DiscordClient(config);
    this.bots.set(config.name || 'default', bot);

    bot.on('error', (error) => this.emit('error', { bot: config.name, error }));

    return bot;
  }

  /**
   * Get bot by name
   */
  getBot(name = 'default') {
    return this.bots.get(name);
  }

  /**
   * Register a webhook
   */
  registerWebhook(name, url) {
    const webhook = new DiscordWebhook(url);
    this.webhooks.set(name, webhook);
    return webhook;
  }

  /**
   * Send to webhook
   */
  async sendToWebhook(name, content, options = {}) {
    const webhook = this.webhooks.get(name);
    if (!webhook) throw new Error(`Webhook not found: ${name}`);
    return webhook.send(content, options);
  }

  /**
   * Get stats
   */
  getStats() {
    return {
      bots: this.bots.size,
      webhooks: this.webhooks.size,
      commands: Array.from(this.bots.values()).reduce((sum, bot) => sum + bot.commands.size, 0)
    };
  }
}

// Export singleton
let manager = null;

export function getDiscordManager() {
  if (!manager) {
    manager = new DiscordIntegrationManager();
  }
  return manager;
}

export default {
  DiscordClient,
  DiscordWebhook,
  DiscordIntegrationManager,
  EmbedBuilder,
  DiscordMessage,
  EmbedColor,
  getDiscordManager
};