#!/usr/bin/env node

import { EventEmitter } from 'events';

// ═══════════════════════════════════════════════════════════════════════════
// EMAIL INTEGRATION
// SMTP sending, IMAP receiving, templates, attachments
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Email address
 */
export class EmailAddress {
  constructor(name, address) {
    this.name = name || null;
    this.address = address;
  }

  toString() {
    return this.name ? `"${this.name}" <${this.address}>` : this.address;
  }

  static parse(str) {
    const match = str.match(/(?:"?([^"]*)"?\s*)?<?([^<@\s]+@[^@\s>]+)>?/);
    if (match) {
      return new EmailAddress(match[1] || null, match[2]);
    }
    return new EmailAddress(null, str.trim());
  }
}

/**
 * Email attachment
 */
export class EmailAttachment {
  constructor(options) {
    this.filename = options.filename;
    this.content = options.content; // Buffer or base64 string
    this.contentType = options.contentType || 'application/octet-stream';
    this.size = options.size || (Buffer.isBuffer(this.content) ? this.content.length : 0);
    this.encoding = options.encoding || 'base64';
  }

  toJSON() {
    return {
      filename: this.filename,
      content: Buffer.isBuffer(this.content) 
        ? this.content.toString('base64') 
        : this.content,
      contentType: this.contentType,
      encoding: this.encoding
    };
  }
}

/**
 * Email message
 */
export class Email {
  constructor(options = {}) {
    this.id = options.id || this._generateId();
    this.from = options.from ? EmailAddress.parse(options.from) : null;
    this.to = this._parseAddresses(options.to);
    this.cc = this._parseAddresses(options.cc);
    this.bcc = this._parseAddresses(options.bcc);
    this.replyTo = options.replyTo ? EmailAddress.parse(options.replyTo) : null;
    this.subject = options.subject || '';
    this.text = options.text || null;
    this.html = options.html || null;
    this.attachments = options.attachments || [];
    this.headers = options.headers || {};
    this.date = options.date || new Date();
    this.inReplyTo = options.inReplyTo || null;
    this.references = options.references || [];
  }

  _generateId() {
    return `<${Date.now()}.${Math.random().toString(36).substr(2)}@nexus.local>`;
  }

  _parseAddresses(addresses) {
    if (!addresses) return [];
    if (Array.isArray(addresses)) {
      return addresses.map(a => typeof a === 'string' ? EmailAddress.parse(a) : a);
    }
    return [EmailAddress.parse(addresses)];
  }

  /**
   * Add attachment
   */
  addAttachment(options) {
    const attachment = new EmailAttachment(options);
    this.attachments.push(attachment);
    return this;
  }

  /**
   * Set HTML body
   */
  setHTML(html) {
    this.html = html;
    return this;
  }

  /**
   * Set text body
   */
  setText(text) {
    this.text = text;
    return this;
  }

  /**
   * To JSON for API
   */
  toJSON() {
    return {
      from: this.from?.toString(),
      to: this.to.map(a => a.toString()),
      cc: this.cc.map(a => a.toString()),
      bcc: this.bcc.map(a => a.toString()),
      subject: this.subject,
      text: this.text,
      html: this.html,
      attachments: this.attachments.map(a => a.toJSON()),
      headers: this.headers,
      date: this.date.toISOString()
    };
  }
}

/**
 * SMTP Client (simplified - real implementation would use nodemailer)
 */
export class SMTPClient extends EventEmitter {
  constructor(options = {}) {
    super();

    this.host = options.host || process.env.SMTP_HOST || 'localhost';
    this.port = options.port || process.env.SMTP_PORT || 587;
    this.secure = options.secure || false;
    this.auth = options.auth || {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    };

    this.connected = false;
    this.pool = [];
  }

  /**
   * Send email
   */
  async send(email) {
    // Simulate sending - real implementation would use nodemailer or smtp-client
    const result = {
      messageId: email.id || `<${Date.now()}@${this.host}>`,
      accepted: email.to.map(a => a.toString()),
      rejected: [],
      timestamp: Date.now()
    };

    this.emit('sent', { messageId: result.messageId, to: email.to });
    return result;
  }

  /**
   * Send multiple emails
   */
  async sendMany(emails) {
    const results = [];
    for (const email of emails) {
      results.push(await this.send(email));
    }
    return results;
  }

  /**
   * Verify connection
   */
  async verify() {
    // Simulate verification
    return {
      success: true,
      host: this.host,
      port: this.port
    };
  }
}

/**
 * IMAP Client (simplified)
 */
export class IMAPClient extends EventEmitter {
  constructor(options = {}) {
    super();

    this.host = options.host || process.env.IMAP_HOST || 'localhost';
    this.port = options.port || process.env.IMAP_PORT || 993;
    this.auth = options.auth || {
      user: process.env.IMAP_USER,
      pass: process.env.IMAP_PASS
    };

    this.connected = false;
  }

  /**
   * Connect to IMAP server
   */
  async connect() {
    this.connected = true;
    this.emit('connected');
    return this;
  }

  /**
   * Disconnect
   */
  async disconnect() {
    this.connected = false;
    this.emit('disconnected');
    return this;
  }

  /**
   * List mailboxes
   */
  async listMailboxes() {
    return [
      { name: 'INBOX', path: 'INBOX', flags: ['\\HasNoChildren'] },
      { name: 'Sent', path: 'Sent', flags: ['\\HasNoChildren'] },
      { name: 'Drafts', path: 'Drafts', flags: ['\\HasNoChildren'] },
      { name: 'Trash', path: 'Trash', flags: ['\\HasNoChildren'] }
    ];
  }

  /**
   * List messages in mailbox
   */
  async listMessages(mailbox = 'INBOX', options = {}) {
    const { limit = 50, unseen = false } = options;

    // Simulate message list
    return [];
  }

  /**
   * Fetch message
   */
  async fetchMessage(messageId) {
    // Simulate fetching
    return null;
  }
}

/**
 * Email Template
 */
export class EmailTemplate {
  constructor(config) {
    this.id = config.id;
    this.name = config.name;
    this.subject = config.subject || '';
    this.htmlTemplate = config.html || '';
    this.textTemplate = config.text || '';
    this.variables = config.variables || [];
  }

  /**
   * Render template with variables
   */
  render(variables = {}) {
    let subject = this.subject;
    let html = this.htmlTemplate;
    let text = this.textTemplate;

    for (const [key, value] of Object.entries(variables)) {
      const placeholder = `{{${key}}}`;
      subject = subject.replace(new RegExp(placeholder, 'g'), value);
      html = html.replace(new RegExp(placeholder, 'g'), value);
      text = text.replace(new RegExp(placeholder, 'g'), value);
    }

    return { subject, html, text };
  }
}

/**
 * Email Manager
 */
export class EmailManager extends EventEmitter {
  constructor(options = {}) {
    super();

    this.smtp = options.smtp ? new SMTPClient(options.smtp) : null;
    this.imap = options.imap ? new IMAPClient(options.imap) : null;

    // Templates
    this.templates = new Map();

    // Queue
    this.queue = [];
    this.sending = false;
    this.concurrency = options.concurrency || 5;

    // Stats
    this.stats = {
      sent: 0,
      failed: 0,
      queued: 0
    };
  }

  /**
   * Register template
   */
  registerTemplate(template) {
    this.templates.set(template.id, template);
    return template;
  }

  /**
   * Create email from template
   */
  createFromTemplate(templateId, to, variables = {}) {
    const template = this.templates.get(templateId);
    if (!template) throw new Error(`Template not found: ${templateId}`);

    const rendered = template.render(variables);

    return new Email({
      to,
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text
    });
  }

  /**
   * Send email
   */
  async send(email) {
    if (!this.smtp) {
      throw new Error('SMTP client not configured');
    }

    this.stats.queued++;

    return new Promise((resolve, reject) => {
      this.queue.push({ email, resolve, reject });
      this._processQueue();
    });
  }

  /**
   * Process send queue
   */
  async _processQueue() {
    if (this.sending || this.queue.length === 0) return;

    this.sending = true;

    while (this.queue.length > 0) {
      const batch = this.queue.splice(0, this.concurrency);

      await Promise.allSettled(
        batch.map(async ({ email, resolve, reject }) => {
          try {
            const result = await this.smtp.send(email);
            this.stats.sent++;
            this.stats.queued--;
            this.emit('sent', { messageId: result.messageId, to: email.to });
            resolve(result);
          } catch (error) {
            this.stats.failed++;
            this.emit('error', { error, email });
            reject(error);
          }
        })
      );
    }

    this.sending = false;
  }

  /**
   * Send bulk emails
   */
  async sendBulk(emails) {
    const results = [];
    for (const email of emails) {
      results.push(await this.send(email));
    }
    return results;
  }

  /**
   * Start listening for incoming emails
   */
  async startListening(options = {}) {
    if (!this.imap) {
      throw new Error('IMAP client not configured');
    }

    await this.imap.connect();

    this.imap.on('new', (message) => {
      this.emit('received', message);
    });

    return this;
  }

  /**
   * Get stats
   */
  getStats() {
    return {
      ...this.stats,
      queueSize: this.queue.length,
      templates: this.templates.size
    };
  }
}

// Export singleton
let manager = null;

export function getEmailManager(options) {
  if (!manager) {
    manager = new EmailManager(options);
  }
  return manager;
}

export default {
  EmailManager,
  SMTPClient,
  IMAPClient,
  Email,
  EmailAddress,
  EmailAttachment,
  EmailTemplate,
  getEmailManager
};