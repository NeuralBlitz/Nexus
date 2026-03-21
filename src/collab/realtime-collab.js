#!/usr/bin/env node

import { EventEmitter } from 'events';
import crypto from 'crypto';
import { WebSocket } from 'ws';

// ═══════════════════════════════════════════════════════════════════════════
// REAL-TIME COLLABORATION
// Shared sessions, live cursors, collaborative editing, presence awareness
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Collaboration events
 */
export const CollabEvent = {
  USER_JOINED: 'user:joined',
  USER_LEFT: 'user:left',
  CURSOR_MOVE: 'cursor:move',
  SELECTION_CHANGE: 'selection:change',
  CONTENT_CHANGE: 'content:change',
  CHAT_MESSAGE: 'chat:message',
  TASK_ASSIGN: 'task:assign',
  TASK_UPDATE: 'task:update',
  PRESENCE_UPDATE: 'presence:update'
};

/**
 * User presence
 */
export class UserPresence {
  constructor(config) {
    this.id = config.id || `user_${crypto.randomBytes(6).toString('hex')}`;
    this.name = config.name || 'Anonymous';
    this.avatar = config.avatar || null;
    this.color = config.color || this._randomColor();
    this.status = 'online';
    this.lastSeen = Date.now();
    this.metadata = config.metadata || {};

    // Cursor position
    this.cursor = {
      x: 0,
      y: 0,
      line: 0,
      column: 0,
      file: null
    };

    // Selection
    this.selection = {
      start: null,
      end: null,
      file: null
    };
  }

  _randomColor() {
    const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F'];
    return colors[Math.floor(Math.random() * colors.length)];
  }

  /**
   * Update cursor position
   */
  updateCursor(position) {
    Object.assign(this.cursor, position);
    this.lastSeen = Date.now();
  }

  /**
   * Update selection
   */
  updateSelection(selection) {
    Object.assign(this.selection, selection);
    this.lastSeen = Date.now();
  }

  /**
   * Set status
   */
  setStatus(status) {
    this.status = status;
    this.lastSeen = Date.now();
  }

  /**
   * To JSON
   */
  toJSON() {
    return {
      id: this.id,
      name: this.name,
      avatar: this.avatar,
      color: this.color,
      status: this.status,
      cursor: this.cursor,
      selection: this.selection,
      lastSeen: this.lastSeen,
      metadata: this.metadata
    };
  }
}

/**
 * Collaborative Document
 */
export class CollabDocument extends EventEmitter {
  constructor(config) {
    super();

    this.id = config.id || `doc_${crypto.randomBytes(6).toString('hex')}`;
    this.name = config.name || 'Untitled';
    this.type = config.type || 'text'; // 'text', 'code', 'markdown'
    this.content = config.content || '';
    this.language = config.language || null;

    // Version history
    this.version = 1;
    this.history = [{
      version: 1,
      content: this.content,
      author: 'system',
      timestamp: Date.now()
    }];

    // Active users
    this.users = new Map();

    // Locks (for exclusive editing)
    this.locks = new Map();

    // Metadata
    this.createdAt = Date.now();
    this.updatedAt = Date.now();
    this.createdBy = config.createdBy || 'system';
  }

  /**
   * Add a user to the document
   */
  addUser(user) {
    this.users.set(user.id, user);
    this.emit(CollabEvent.USER_JOINED, { user: user.toJSON(), documentId: this.id });
    return this;
  }

  /**
   * Remove a user from the document
   */
  removeUser(userId) {
    const user = this.users.get(userId);
    if (user) {
      this.users.delete(userId);
      this.locks.delete(userId);
      this.emit(CollabEvent.USER_LEFT, { user: user.toJSON(), documentId: this.id });
    }
    return this;
  }

  /**
   * Update user cursor
   */
  updateCursor(userId, position) {
    const user = this.users.get(userId);
    if (user) {
      user.updateCursor(position);
      this.emit(CollabEvent.CURSOR_MOVE, {
        userId,
        position,
        documentId: this.id
      });
    }
    return this;
  }

  /**
   * Update user selection
   */
  updateSelection(userId, selection) {
    const user = this.users.get(userId);
    if (user) {
      user.updateSelection(selection);
      this.emit(CollabEvent.SELECTION_CHANGE, {
        userId,
        selection,
        documentId: this.id
      });
    }
    return this;
  }

  /**
   * Apply content change
   */
  applyChange(change, userId) {
    const { type, position, content, length } = change;

    let newContent = this.content;

    switch (type) {
      case 'insert':
        newContent = this.content.slice(0, position) + content + this.content.slice(position);
        break;
      case 'delete':
        newContent = this.content.slice(0, position) + this.content.slice(position + length);
        break;
      case 'replace':
        newContent = this.content.slice(0, position) + content + this.content.slice(position + length);
        break;
      case 'set':
        newContent = content;
        break;
    }

    // Update content
    const oldContent = this.content;
    this.content = newContent;
    this.version++;
    this.updatedAt = Date.now();

    // Add to history
    this.history.push({
      version: this.version,
      content: this.content,
      author: userId,
      timestamp: Date.now(),
      change
    });

    // Keep only last 100 history entries
    if (this.history.length > 100) {
      this.history = this.history.slice(-100);
    }

    this.emit(CollabEvent.CONTENT_CHANGE, {
      documentId: this.id,
      userId,
      version: this.version,
      change,
      oldContent,
      newContent: this.content
    });

    return this;
  }

  /**
   * Acquire lock
   */
  acquireLock(userId, section = 'full') {
    // Check if section is already locked by another user
    for (const [lockedBy, lockedSection] of this.locks) {
      if (lockedBy !== userId && (lockedSection === 'full' || lockedSection === section)) {
        return { success: false, lockedBy };
      }
    }

    this.locks.set(userId, section);
    return { success: true };
  }

  /**
   * Release lock
   */
  releaseLock(userId) {
    this.locks.delete(userId);
    return this;
  }

  /**
   * Get document state
   */
  getState() {
    return {
      id: this.id,
      name: this.name,
      type: this.type,
      content: this.content,
      language: this.language,
      version: this.version,
      users: Array.from(this.users.values()).map(u => u.toJSON()),
      locks: Object.fromEntries(this.locks),
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }

  /**
   * Get history
   */
  getHistory(limit = 50) {
    return this.history.slice(-limit);
  }

  /**
   * Restore version
   */
  restoreVersion(version) {
    const entry = this.history.find(h => h.version === version);
    if (!entry) return false;

    this.content = entry.content;
    this.version++;
    this.updatedAt = Date.now();

    this.history.push({
      version: this.version,
      content: this.content,
      author: 'system',
      timestamp: Date.now(),
      restoredFrom: version
    });

    return true;
  }
}

/**
 * Collaborative Session
 */
export class CollabSession extends EventEmitter {
  constructor(config) {
    super();

    this.id = config.id || `session_${crypto.randomBytes(6).toString('hex')}`;
    this.name = config.name || 'Unnamed Session';
    this.host = config.host; // User who created the session

    // Documents
    this.documents = new Map();

    // Users
    this.users = new Map();

    // Chat
    this.chatHistory = [];

    // Tasks
    this.tasks = new Map();

    // Created
    this.createdAt = Date.now();
    this.updatedAt = Date.now();
  }

  /**
   * Add a document to the session
   */
  addDocument(config) {
    const doc = new CollabDocument(config);

    // Forward document events
    doc.on(CollabEvent.CONTENT_CHANGE, (data) => this.emit(CollabEvent.CONTENT_CHANGE, data));
    doc.on(CollabEvent.CURSOR_MOVE, (data) => this.emit(CollabEvent.CURSOR_MOVE, data));
    doc.on(CollabEvent.SELECTION_CHANGE, (data) => this.emit(CollabEvent.SELECTION_CHANGE, data));

    this.documents.set(doc.id, doc);
    this.updatedAt = Date.now();
    return doc;
  }

  /**
   * Get a document
   */
  getDocument(docId) {
    return this.documents.get(docId);
  }

  /**
   * Join session
   */
  join(user) {
    this.users.set(user.id, user);

    // Notify others
    this.emit(CollabEvent.USER_JOINED, {
      sessionId: this.id,
      user: user.toJSON(),
      users: this.getActiveUsers()
    });

    this.updatedAt = Date.now();
    return this;
  }

  /**
   * Leave session
   */
  leave(userId) {
    const user = this.users.get(userId);
    if (user) {
      this.users.delete(userId);

      // Remove from all documents
      for (const doc of this.documents.values()) {
        doc.removeUser(userId);
      }

      this.emit(CollabEvent.USER_LEFT, {
        sessionId: this.id,
        user: user.toJSON(),
        users: this.getActiveUsers()
      });

      this.updatedAt = Date.now();
    }
    return this;
  }

  /**
   * Get active users
   */
  getActiveUsers() {
    return Array.from(this.users.values())
      .filter(u => u.status !== 'offline')
      .map(u => u.toJSON());
  }

  /**
   * Send chat message
   */
  sendChat(userId, message) {
    const user = this.users.get(userId);
    if (!user) return null;

    const chatMsg = {
      id: `msg_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`,
      userId,
      userName: user.name,
      userColor: user.color,
      message,
      timestamp: Date.now()
    };

    this.chatHistory.push(chatMsg);

    // Keep only last 1000 messages
    if (this.chatHistory.length > 1000) {
      this.chatHistory = this.chatHistory.slice(-1000);
    }

    this.emit(CollabEvent.CHAT_MESSAGE, {
      sessionId: this.id,
      ...chatMsg
    });

    return chatMsg;
  }

  /**
   * Get chat history
   */
  getChatHistory(limit = 100) {
    return this.chatHistory.slice(-limit);
  }

  /**
   * Assign task
   */
  assignTask(task, assigneeId) {
    const taskEntry = {
      id: `task_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`,
      ...task,
      assigneeId,
      status: 'pending',
      createdAt: Date.now()
    };

    this.tasks.set(taskEntry.id, taskEntry);

    this.emit(CollabEvent.TASK_ASSIGN, {
      sessionId: this.id,
      task: taskEntry
    });

    return taskEntry;
  }

  /**
   * Update task
   */
  updateTask(taskId, updates) {
    const task = this.tasks.get(taskId);
    if (!task) return null;

    Object.assign(task, updates, { updatedAt: Date.now() });

    this.emit(CollabEvent.TASK_UPDATE, {
      sessionId: this.id,
      task
    });

    return task;
  }

  /**
   * Get session state
   */
  getState() {
    return {
      id: this.id,
      name: this.name,
      host: this.host,
      users: this.getActiveUsers(),
      documents: Array.from(this.documents.values()).map(d => ({
        id: d.id,
        name: d.name,
        type: d.type,
        version: d.version,
        users: d.users.size
      })),
      taskCount: this.tasks.size,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }
}

/**
 * Collaboration Manager
 */
export class CollaborationManager extends EventEmitter {
  constructor() {
    super();

    this.sessions = new Map();
    this.users = new Map();
    this.documents = new Map();

    // WebSocket connections
    this.connections = new Map();
  }

  /**
   * Create a session
   */
  createSession(config) {
    const session = new CollabSession(config);
    this.sessions.set(session.id, session);

    // Forward events
    session.on('all', (event, data) => this.emit(event, { ...data, sessionId: session.id }));

    this.emit('session:created', { sessionId: session.id });
    return session;
  }

  /**
   * Get a session
   */
  getSession(sessionId) {
    return this.sessions.get(sessionId);
  }

  /**
   * Delete a session
   */
  deleteSession(sessionId) {
    const session = this.sessions.get(sessionId);
    if (session) {
      // Notify all users
      for (const user of session.users.values()) {
        session.leave(user.id);
      }
      this.sessions.delete(sessionId);
      this.emit('session:deleted', { sessionId });
    }
  }

  /**
   * Get all sessions
   */
  getAllSessions() {
    return Array.from(this.sessions.values()).map(s => s.getState());
  }

  /**
   * Register user
   */
  registerUser(userInfo) {
    const user = new UserPresence(userInfo);
    this.users.set(user.id, user);
    return user;
  }

  /**
   * Get user
   */
  getUser(userId) {
    return this.users.get(userId);
  }

  /**
   * Create a document
   */
  createDocument(config) {
    const doc = new CollabDocument(config);
    this.documents.set(doc.id, doc);

    // Forward events
    doc.on('all', (event, data) => this.emit(event, { ...data, documentId: doc.id }));

    return doc;
  }

  /**
   * Get a document
   */
  getDocument(docId) {
    return this.documents.get(docId);
  }

  /**
   * Handle WebSocket connection
   */
  handleConnection(ws, user) {
    const connectionId = `conn_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;

    this.connections.set(connectionId, { ws, user });

    // Handle messages
    ws.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString());
        this._handleMessage(connectionId, message);
      } catch (error) {
        ws.send(JSON.stringify({ type: 'error', error: 'Invalid message' }));
      }
    });

    // Handle disconnect
    ws.on('close', () => {
      this._handleDisconnect(connectionId);
    });

    return connectionId;
  }

  /**
   * Handle incoming message
   */
  _handleMessage(connectionId, message) {
    const connection = this.connections.get(connectionId);
    if (!connection) return;

    const { ws, user } = connection;

    switch (message.type) {
      case 'join_session':
        const session = this.getSession(message.sessionId);
        if (session) {
          session.join(user);
          ws.send(JSON.stringify({
            type: 'session:joined',
            session: session.getState()
          }));
        }
        break;

      case 'leave_session':
        const leaveSession = this.getSession(message.sessionId);
        if (leaveSession) {
          leaveSession.leave(user.id);
        }
        break;

      case 'cursor_update':
        if (message.documentId) {
          const doc = this.getDocument(message.documentId);
          if (doc) {
            const docUser = doc.users.get(user.id);
            if (docUser) {
              docUser.updateCursor(message.position);
            }
          }
        }
        break;

      case 'content_change':
        if (message.documentId) {
          const doc = this.getDocument(message.documentId);
          if (doc) {
            doc.applyChange(message.change, user.id);
          }
        }
        break;

      case 'chat':
        if (message.sessionId) {
          const chatSession = this.getSession(message.sessionId);
          if (chatSession) {
            chatSession.sendChat(user.id, message.content);
          }
        }
        break;

      default:
        ws.send(JSON.stringify({ type: 'error', error: 'Unknown message type' }));
    }
  }

  /**
   * Handle disconnect
   */
  _handleDisconnect(connectionId) {
    const connection = this.connections.get(connectionId);
    if (connection) {
      // Leave all sessions
      for (const session of this.sessions.values()) {
        if (session.users.has(connection.user.id)) {
          session.leave(connection.user.id);
        }
      }
      this.connections.delete(connectionId);
    }
  }

  /**
   * Broadcast to session
   */
  broadcast(sessionId, event, data) {
    const session = this.getSession(sessionId);
    if (!session) return;

    const message = JSON.stringify({ type: event, ...data });

    for (const [, conn] of this.connections) {
      if (session.users.has(conn.user.id) && conn.ws.readyState === WebSocket.OPEN) {
        conn.ws.send(message);
      }
    }
  }

  /**
   * Get stats
   */
  getStats() {
    return {
      sessions: this.sessions.size,
      users: this.users.size,
      documents: this.documents.size,
      connections: this.connections.size
    };
  }
}

// Export singleton
let manager = null;

export function getCollaborationManager() {
  if (!manager) {
    manager = new CollaborationManager();
  }
  return manager;
}

export default {
  CollaborationManager,
  CollabSession,
  CollabDocument,
  UserPresence,
  CollabEvent,
  getCollaborationManager
};