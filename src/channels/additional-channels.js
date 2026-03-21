import { EventEmitter } from 'events';
import { Channel, MessageType, ChannelState } from './channel-system.js';

export class EmailChannel extends Channel {
  constructor(config) {
    super({
      ...config,
      type: 'email'
    });

    this.smtpConfig = config.smtp || {};
    this.imapConfig = config.imap || {};
    this.email = config.email;
    this.password = config.password;
    this.pollInterval = config.pollInterval || 60000;
    this.pollTimer = null;
  }

  async _initialize() {
    if (!this.email || !this.password) {
      throw new Error('Email credentials are required');
    }

    this.registerHandler(MessageType.TEXT, async (message, session) => {
      this.emit('email:received', { message, session });
    });

    if (this.imapConfig.enabled) {
      this._startPolling();
    }
  }

  _startPolling() {
    this.pollTimer = setInterval(async () => {
      await this._checkInbox();
    }, this.pollInterval);
  }

  async _checkInbox() {
    console.log(`[EmailChannel] Checking inbox for ${this.email}`);
    this.stats.messagesReceived++;
  }

  async _send(target, message, options = {}) {
    const content = typeof message === 'string' ? message : message.content;

    const emailData = {
      from: this.email,
      to: target,
      subject: options.subject || 'NEXUS Message',
      text: content,
      html: options.html || `<p>${content}</p>`
    };

    console.log(`[EmailChannel] Sending email to ${target}`);
    this.stats.messagesSent++;
    return emailData;
  }

  async _cleanup() {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  }
}

export class SMSChannel extends Channel {
  constructor(config) {
    super({
      ...config,
      type: 'sms'
    });

    this.twilioAccountSid = config.twilioAccountSid;
    this.twilioAuthToken = config.twilioAuthToken;
    this.twilioPhoneNumber = config.twilioPhoneNumber;
    this.fromNumber = config.fromNumber || this.twilioPhoneNumber;
  }

  async _initialize() {
    if (!this.twilioAccountSid || !this.twilioAuthToken || !this.twilioPhoneNumber) {
      throw new Error('Twilio credentials are required');
    }

    this.registerHandler(MessageType.TEXT, async (message, session) => {
      this.emit('sms:received', { message, session });
    });
  }

  async _send(target, message, options = {}) {
    const content = typeof message === 'string' ? message : message.content;

    const auth = Buffer.from(`${this.twilioAccountSid}:${this.twilioAuthToken}`).toString('base64');

    const response = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${this.twilioAccountSid}/Messages.json`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${auth}`,
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams({
          To: target,
          From: this.fromNumber,
          Body: content
        })
      }
    );

    const result = await response.json();

    if (!response.ok) {
      throw new Error(`Twilio error: ${result.message || response.status}`);
    }

    this.stats.messagesSent++;
    return result;
  }

  async _cleanup() {}
}

export class MatrixChannel extends Channel {
  constructor(config) {
    super({
      ...config,
      type: 'matrix'
    });

    this.homeserverUrl = config.homeserverUrl || 'https://matrix.org';
    this.userId = config.userId;
    this.accessToken = config.accessToken;
    this.roomId = config.roomId;
    this.syncToken = null;
    this.syncInterval = config.syncInterval || 30000;
    this.syncTimer = null;
  }

  async _initialize() {
    if (!this.userId || !this.accessToken) {
      throw new Error('Matrix credentials are required');
    }

    this.registerHandler(MessageType.TEXT, async (message, session) => {
      this.emit('matrix:message', { message, session });
    });

    this._startSync();
  }

  _startSync() {
    this.syncTimer = setInterval(async () => {
      await this._sync();
    }, this.syncInterval);

    this._sync();
  }

  async _sync() {
    const url = new URL(`${this.homeserverUrl}/_matrix/client/r0/sync`);
    url.searchParams.set('timeout', this.syncInterval.toString());
    if (this.syncToken) {
      url.searchParams.set('since', this.syncToken);
    }

    const response = await fetch(url.toString(), {
      headers: {
        'Authorization': `Bearer ${this.accessToken}`
      }
    });

    if (response.ok) {
      const data = await response.json();
      this.syncToken = data.next_batch;

      if (data.rooms?.join?.[this.roomId]?.timeline?.events) {
        for (const event of data.rooms.join[this.roomId].timeline.events) {
          if (event.type === 'm.room.message') {
            this._handleMatrixMessage(event);
          }
        }
      }
    }

    this.stats.messagesReceived++;
  }

  _handleMatrixMessage(event) {
    const session = this.createSession({
      id: `matrix_${event.sender}`,
      userId: event.sender,
      metadata: { roomId: this.roomId }
    });

    this.handleMessage({
      type: MessageType.TEXT,
      content: event.content.body
    }, session);
  }

  async _send(target, message, options = {}) {
    const content = typeof message === 'string' ? message : message.content;
    const roomId = target || this.roomId;

    const response = await fetch(
      `${this.homeserverUrl}/_matrix/client/r0/rooms/${encodeURIComponent(roomId)}/send/m.room.message/${Date.now()}`,
      {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          msgtype: 'm.text',
          body: content
        })
      }
    );

    const result = await response.json();

    if (!response.ok) {
      throw new Error(`Matrix error: ${result.error || response.status}`);
    }

    this.stats.messagesSent++;
    return result;
  }

  async _cleanup() {
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
      this.syncTimer = null;
    }
  }
}

export class IRCChannel extends Channel {
  constructor(config) {
    super({
      ...config,
      type: 'irc'
    });

    this.server = config.server;
    this.port = config.port || 6667;
    this.nickname = config.nickname;
    this.username = config.username || config.nickname;
    this.realname = config.realname || config.nickname;
    this.channels = config.channels || [];
    this.secure = config.secure || false;
    this.socket = null;
    this.buffer = '';
  }

  async _initialize() {
    if (!this.server || !this.nickname) {
      throw new Error('IRC server and nickname are required');
    }

    this.registerHandler(MessageType.TEXT, async (message, session) => {
      this.emit('irc:message', { message, session });
    });

    await this._connect();
  }

  async _connect() {
    const protocol = this.secure ? 'tls' : 'tcp';
    console.log(`[IRCChannel] Connecting to ${this.server}:${this.port}`);

    this._sendRaw(`NICK ${this.nickname}`);
    this._sendRaw(`USER ${this.username} 0 * :${this.realname}`);
  }

  _sendRaw(command) {
    console.log(`[IRCChannel] >>> ${command}`);
  }

  _handleRawMessage(raw) {
    const parts = raw.split(' ');
    const prefix = parts[0].startsWith(':') ? parts[0].slice(1) : null;
    const command = parts[1];
    const params = parts.slice(3).join(' ').replace(/^:/, '');

    switch (command) {
      case 'PRIVMSG':
        const [target, message] = params.match(/^([^:]+):(.+)$/)?.slice(1) || [null, params];
        if (message) {
          this._handleMessage({ target, message, prefix });
        }
        break;
      case 'PING':
        this._sendRaw(`PONG ${params}`);
        break;
      case '001':
        for (const channel of this.channels) {
          this._sendRaw(`JOIN ${channel}`);
        }
        break;
    }
  }

  _handleMessage(data) {
    const session = this.createSession({
      id: `irc_${data.prefix}`,
      userId: data.prefix,
      metadata: { target: data.target }
    });

    this.handleMessage({
      type: MessageType.TEXT,
      content: data.message
    }, session);

    this.stats.messagesReceived++;
  }

  async _send(target, message, options = {}) {
    const content = typeof message === 'string' ? message : message.content;

    if (target.startsWith('#')) {
      this._sendRaw(`PRIVMSG ${target} :${content}`);
    } else {
      this._sendRaw(`PRIVMSG ${target} :${content}`);
    }

    this.stats.messagesSent++;
    return { sent: true };
  }

  async _cleanup() {
    if (this.socket) {
      this._sendRaw('QUIT :Server shutdown');
      this.socket = null;
    }
  }
}

export class XMPPChannel extends Channel {
  constructor(config) {
    super({
      ...config,
      type: 'xmpp'
    });

    this.jid = config.jid;
    this.password = config.password;
    this.server = config.server || this.jid.split('@')[1];
    this.resource = config.resource || 'nexus';
    this.port = config.port || 5222;
  }

  async _initialize() {
    if (!this.jid || !this.password) {
      throw new Error('XMPP JID and password are required');
    }

    this.registerHandler(MessageType.TEXT, async (message, session) => {
      this.emit('xmpp:message', { message, session });
    });

    console.log(`[XMPPChannel] Connecting as ${this.jid}/${this.resource}`);
  }

  async _send(target, message, options = {}) {
    const content = typeof message === 'string' ? message : message.content;

    const stanza = `<message to="${target}" type="chat">
      <body>${content}</body>
    </message>`;

    console.log(`[XMPPChannel] Sending to ${target}`);
    this.stats.messagesSent++;
    return { sent: true, stanza };
  }

  async _cleanup() {
    console.log('[XMPPChannel] Disconnecting');
  }
}

export class NtfyChannel extends Channel {
  constructor(config) {
    super({
      ...config,
      type: 'ntfy'
    });

    this.serverUrl = config.serverUrl || 'https://ntfy.sh';
    this.topic = config.topic;
    this.authToken = config.authToken;
  }

  async _initialize() {
    if (!this.topic) {
      throw new Error('Ntfy topic is required');
    }

    this.registerHandler(MessageType.NOTIFICATION, async (message, session) => {
      this.emit('ntfy:notification', { message, session });
    });
  }

  async _send(target, message, options = {}) {
    const content = typeof message === 'string' ? message : message.content;

    const headers = {
      'Content-Type': 'text/plain'
    };

    if (this.authToken) {
      headers['Authorization'] = `Bearer ${this.authToken}`;
    }

    if (options.priority) {
      headers['X-Priority'] = options.priority.toString();
    }

    if (options.tags) {
      headers['X-Tags'] = options.tags;
    }

    const response = await fetch(`${this.serverUrl}/${this.topic}`, {
      method: 'POST',
      headers,
      body: content
    });

    if (!response.ok) {
      throw new Error(`Ntfy error: ${response.status}`);
    }

    this.stats.messagesSent++;
    return { success: true };
  }

  async _cleanup() {}
}

export class PushoverChannel extends Channel {
  constructor(config) {
    super({
      ...config,
      type: 'pushover'
    });

    this.apiToken = config.apiToken;
    this.userKey = config.userKey;
  }

  async _initialize() {
    if (!this.apiToken || !this.userKey) {
      throw new Error('Pushover API token and user key are required');
    }

    this.registerHandler(MessageType.NOTIFICATION, async (message, session) => {
      this.emit('pushover:notification', { message, session });
    });
  }

  async _send(target, message, options = {}) {
    const content = typeof message === 'string' ? message : message.content;

    const response = await fetch('https://api.pushover.net/1/messages.json', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        token: this.apiToken,
        user: target || this.userKey,
        message: content,
        title: options.title || 'NEXUS',
        priority: options.priority || 0,
        sound: options.sound || 'default'
      })
    });

    const result = await response.json();

    if (result.status !== 1) {
      throw new Error(`Pushover error: ${result.errors?.join(', ')}`);
    }

    this.stats.messagesSent++;
    return result;
  }

  async _cleanup() {}
}

export class SignalChannel extends Channel {
  constructor(config) {
    super({
      ...config,
      type: 'signal'
    });

    this.signalCliPath = config.signalCliPath || 'signal-cli';
    this.number = config.number;
    this.recipientName = config.recipientName;
  }

  async _initialize() {
    if (!this.number) {
      throw new Error('Signal number is required');
    }

    this.registerHandler(MessageType.TEXT, async (message, session) => {
      this.emit('signal:message', { message, session });
    });

    console.log(`[SignalChannel] Initialized for ${this.number}`);
  }

  async _send(target, message, options = {}) {
    const content = typeof message === 'string' ? message : message.content;

    const args = [
      '-u', this.number,
      'send',
      '-m', content,
      target
    ];

    console.log(`[SignalChannel] Sending to ${target}`);
    this.stats.messagesSent++;
    return { sent: true, command: args.join(' ') };
  }

  async _cleanup() {}
}

export class WebRTCChannel extends Channel {
  constructor(config) {
    super({
      ...config,
      type: 'webrtc'
    });

    this.peerId = config.peerId || `nexus_${Date.now()}`;
    this.stunServers = config.stunServers || [
      'stun:stun.l.google.com:19302',
      'stun:stun1.l.google.com:19302'
    ];
    this.turnServers = config.turnServers || [];
    this.connections = new Map();
    this.dataChannels = new Map();
  }

  async _initialize() {
    this.registerHandler(MessageType.TEXT, async (message, session) => {
      this.emit('webrtc:message', { message, session });
    });

    this.registerHandler('voice', async (message, session) => {
      this.emit('webrtc:voice', { message, session });
    });

    console.log(`[WebRTCChannel] Peer ID: ${this.peerId}`);
  }

  async createOffer(targetPeerId) {
    const pc = new RTCPeerConnection({
      iceServers: [
        ...this.stunServers.map(url => ({ urls: url })),
        ...this.turnServers
      ]
    });

    const dataChannel = pc.createDataChannel('nexus');

    dataChannel.onmessage = (event) => {
      this._handleDataMessage(event.data, targetPeerId);
    };

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    this.connections.set(targetPeerId, pc);
    this.dataChannels.set(targetPeerId, dataChannel);

    return { offer, sdp: offer.sdp };
  }

  async handleOffer(offer, fromPeerId) {
    const pc = new RTCPeerConnection({
      iceServers: [
        ...this.stunServers.map(url => ({ urls: url })),
        ...this.turnServers
      ]
    });

    await pc.setRemoteDescription(offer);

    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);

    pc.ondatachannel = (event) => {
      this.dataChannels.set(fromPeerId, event.channel);
      event.channel.onmessage = (ev) => {
        this._handleDataMessage(ev.data, fromPeerId);
      };
    };

    this.connections.set(fromPeerId, pc);

    return { answer, sdp: answer.sdp };
  }

  async handleAnswer(answer, fromPeerId) {
    const pc = this.connections.get(fromPeerId);
    if (pc) {
      await pc.setRemoteDescription(answer);
    }
  }

  _handleDataMessage(data, fromPeerId) {
    const session = this.createSession({
      id: `webrtc_${fromPeerId}`,
      userId: fromPeerId
    });

    this.handleMessage({
      type: MessageType.TEXT,
      content: data
    }, session);

    this.stats.messagesReceived++;
  }

  async _send(target, message, options = {}) {
    const content = typeof message === 'string' ? message : message.content;
    const dataChannel = this.dataChannels.get(target);

    if (!dataChannel || dataChannel.readyState !== 'open') {
      throw new Error('Data channel not ready');
    }

    dataChannel.send(content);
    this.stats.messagesSent++;
    return { sent: true };
  }

  async _cleanup() {
    for (const pc of this.connections.values()) {
      pc.close();
    }
    this.connections.clear();
    this.dataChannels.clear();
  }
}

export class WebmentionChannel extends Channel {
  constructor(config) {
    super({
      ...config,
      type: 'webmention'
    });

    this.endpoint = config.endpoint;
    this.source = config.source;
  }

  async _initialize() {
    this.registerHandler(MessageType.TEXT, async (message, session) => {
      this.emit('webmention:received', { message, session });
    });

    console.log(`[WebmentionChannel] Source: ${this.source}`);
  }

  async _send(target, message, options = {}) {
    const content = typeof message === 'string' ? message : message.content;

    const response = await fetch(target, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        source: this.source,
        target: options.targetUrl || target,
        content
      })
    });

    if (!response.ok) {
      throw new Error(`Webmention error: ${response.status}`);
    }

    this.stats.messagesSent++;
    return { success: true };
  }

  async _cleanup() {}
}

// ═══════════════════════════════════════════════════════════════════════════
// WEBHOOK CHANNEL
// ═══════════════════════════════════════════════════════════════════════════

export class WebhookChannel extends Channel {
  constructor(config) {
    super({ ...config, type: 'webhook' });
    this.endpoints = new Map();
    this.secret = config.secret;
    this.headers = config.headers || {};
    this.timeout = config.timeout || 10000;
    this.retryAttempts = config.retryAttempts || 3;
  }

  async _initialize() {
    this.registerHandler(MessageType.TEXT, async (message, session) => {
      const target = this.endpoints.get(session.id) || this.endpoints.get('default');
      if (target) await this._sendWebhook(target, message);
    });
  }

  registerEndpoint(name, url, options = {}) {
    this.endpoints.set(name, { url, headers: options.headers || {}, secret: options.secret || this.secret });
    return this;
  }

  removeEndpoint(name) {
    this.endpoints.delete(name);
    return this;
  }

  async _send(target, message, options = {}) {
    const endpoint = typeof target === 'string'
      ? this.endpoints.get(target) || { url: target, headers: {}, secret: this.secret }
      : target;

    await this._sendWebhook(endpoint, message);
  }

  async _sendWebhook(endpoint, message, attempt = 1) {
    try {
      const body = JSON.stringify({
        event: 'message',
        timestamp: Date.now(),
        message: typeof message === 'string' ? message : message.content || JSON.stringify(message)
      });

      const headers = { 'Content-Type': 'application/json', ...this.headers, ...endpoint.headers };

      if (endpoint.secret) {
        const crypto = await import('crypto');
        const sig = crypto.createHmac('sha256', endpoint.secret).update(body).digest('hex');
        headers['X-Webhook-Signature'] = `sha256=${sig}`;
      }

      const response = await fetch(endpoint.url, {
        method: 'POST',
        headers,
        body,
        signal: AbortSignal.timeout(this.timeout)
      });

      if (!response.ok && attempt < this.retryAttempts) {
        await new Promise(r => setTimeout(r, 1000 * attempt));
        return this._sendWebhook(endpoint, message, attempt + 1);
      }

      this.stats.messagesSent++;
      return { success: response.ok, status: response.status };
    } catch (error) {
      if (attempt < this.retryAttempts) {
        await new Promise(r => setTimeout(r, 1000 * attempt));
        return this._sendWebhook(endpoint, message, attempt + 1);
      }
      throw error;
    }
  }

  async _cleanup() {
    this.endpoints.clear();
  }
}

export const additionalChannels = [
  EmailChannel,
  SMSChannel,
  MatrixChannel,
  IRCChannel,
  XMPPChannel,
  NtfyChannel,
  PushoverChannel,
  SignalChannel,
  WebRTCChannel,
  WebmentionChannel,
  WebhookChannel
];

export default additionalChannels;
