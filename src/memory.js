import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SESSIONS_DIR = path.join(__dirname, '..', 'data', 'sessions');
const MAX_MESSAGES = 100;
const SESSION_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours
const AUTO_SAVE_INTERVAL_MS = 30 * 1000; // 30 seconds

/**
 * Session class - Manages conversation history per client
 */
class Session {
  constructor(sessionId, agentId = 'default') {
    this.sessionId = sessionId;
    this.agentId = agentId;
    this.messages = [];
    this.metadata = {
      createdAt: Date.now(),
      lastAccessedAt: Date.now(),
      messageCount: 0,
      clientInfo: {}
    };
    this.unsavedChanges = false;
  }

  /**
   * Add a message to the session
   * @param {string} role - 'user' or 'assistant'
   * @param {string} content - Message content
   * @param {Object} metadata - Additional message metadata
   */
  addMessage(role, content, metadata = {}) {
    const message = {
      id: Date.now().toString(36) + Math.random().toString(36).substr(2),
      role,
      content,
      timestamp: Date.now(),
      metadata
    };

    this.messages.push(message);
    this.metadata.messageCount++;
    this.metadata.lastAccessedAt = Date.now();
    this.unsavedChanges = true;

    // Apply sliding window if exceeds max messages
    if (this.messages.length > MAX_MESSAGES) {
      this._truncateOldMessages();
    }

    return message;
  }

  /**
   * Get recent messages within context window
   * @param {number} limit - Maximum messages to return
   * @returns {Array} Recent messages
   */
  getRecentMessages(limit = MAX_MESSAGES) {
    this.metadata.lastAccessedAt = Date.now();
    return this.messages.slice(-limit);
  }

  /**
   * Get conversation context for AI model
   * @param {number} maxTokens - Approximate max tokens (rough estimate)
   * @returns {Array} Messages formatted for AI context
   */
  getContext(maxTokens = 4000) {
    const recentMessages = this.getRecentMessages();
    
    // Simple token estimation (words * 1.3)
    let totalTokens = 0;
    const contextMessages = [];
    
    for (let i = recentMessages.length - 1; i >= 0; i--) {
      const msg = recentMessages[i];
      const estimatedTokens = Math.ceil(msg.content.split(/\s+/).length * 1.3);
      
      if (totalTokens + estimatedTokens > maxTokens) break;
      
      contextMessages.unshift(msg);
      totalTokens += estimatedTokens;
    }
    
    return contextMessages;
  }

  /**
   * Truncate old messages while preserving recent context
   * @private
   */
  _truncateOldMessages() {
    if (this.messages.length > MAX_MESSAGES) {
      // Keep only the most recent MAX_MESSAGES
      this.messages = this.messages.slice(-MAX_MESSAGES);
    }
  }

  /**
   * Search messages by keyword
   * @param {string} keyword - Search term
   * @param {Object} options - Search options
   * @returns {Array} Matching messages
   */
  search(keyword, options = {}) {
    const { caseSensitive = false, limit = 20 } = options;
    const searchTerm = caseSensitive ? keyword : keyword.toLowerCase();
    
    return this.messages
      .filter(msg => {
        const content = caseSensitive ? msg.content : msg.content.toLowerCase();
        return content.includes(searchTerm);
      })
      .slice(-limit)
      .map(msg => ({
        ...msg,
        sessionId: this.sessionId,
        agentId: this.agentId
      }));
  }

  /**
   * Check if session is expired
   * @returns {boolean}
   */
  isExpired() {
    return Date.now() - this.metadata.lastAccessedAt > SESSION_EXPIRY_MS;
  }

  /**
   * Update client info
   * @param {Object} info - Client information
   */
  setClientInfo(info) {
    this.metadata.clientInfo = { ...this.metadata.clientInfo, ...info };
    this.unsavedChanges = true;
  }

  /**
   * Get session summary
   * @returns {Object}
   */
  toSummary() {
    return {
      sessionId: this.sessionId,
      agentId: this.agentId,
      messageCount: this.metadata.messageCount,
      createdAt: new Date(this.metadata.createdAt).toISOString(),
      lastAccessedAt: new Date(this.metadata.lastAccessedAt).toISOString(),
      isExpired: this.isExpired()
    };
  }

  /**
   * Serialize session for storage
   * @returns {Object}
   */
  toJSON() {
    return {
      sessionId: this.sessionId,
      agentId: this.agentId,
      messages: this.messages,
      metadata: this.metadata
    };
  }

  /**
   * Load session from saved data
   * @param {Object} data - Saved session data
   * @returns {Session}
   */
  static fromJSON(data) {
    const session = new Session(data.sessionId, data.agentId);
    session.messages = data.messages || [];
    session.metadata = { ...session.metadata, ...data.metadata };
    return session;
  }
}

/**
 * SessionManager - Manages all sessions with persistence
 */
class SessionManager {
  constructor() {
    this.sessions = new Map();
    this.autoSaveTimer = null;
    this._initialized = false;
  }

  /**
   * Initialize the session manager
   */
  async initialize() {
    if (this._initialized) return;
    
    // Ensure sessions directory exists
    try {
      await fs.mkdir(SESSIONS_DIR, { recursive: true });
    } catch (error) {
      console.error('Failed to create sessions directory:', error);
    }
    
    // Load existing sessions
    await this._loadAllSessions();
    
    // Start auto-save timer
    this._startAutoSave();
    
    // Start cleanup timer for expired sessions
    this._startCleanup();
    
    this._initialized = true;
    console.log(`Session manager initialized with ${this.sessions.size} sessions`);
  }

  /**
   * Get or create a session
   * @param {string} sessionId - Session identifier
   * @param {string} agentId - Agent identifier
   * @returns {Session}
   */
  async getSession(sessionId, agentId = 'default') {
    await this.initialize();
    
    const key = this._getSessionKey(sessionId, agentId);
    let session = this.sessions.get(key);
    
    if (!session || session.isExpired()) {
      session = new Session(sessionId, agentId);
      this.sessions.set(key, session);
    }
    
    session.metadata.lastAccessedAt = Date.now();
    return session;
  }

  /**
   * Create a new session
   * @param {string} agentId - Agent identifier
   * @param {Object} clientInfo - Client information
   * @returns {Session}
   */
  async createSession(agentId = 'default', clientInfo = {}) {
    await this.initialize();
    
    const sessionId = Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
    const session = new Session(sessionId, agentId);
    
    if (Object.keys(clientInfo).length > 0) {
      session.setClientInfo(clientInfo);
    }
    
    const key = this._getSessionKey(sessionId, agentId);
    this.sessions.set(key, session);
    
    return session;
  }

  /**
   * Delete a session
   * @param {string} sessionId 
   * @param {string} agentId 
   * @returns {boolean}
   */
  async deleteSession(sessionId, agentId = 'default') {
    const key = this._getSessionKey(sessionId, agentId);
    const deleted = this.sessions.delete(key);
    
    if (deleted) {
      // Delete from disk
      const filePath = this._getFilePath(sessionId, agentId);
      try {
        await fs.unlink(filePath);
      } catch (error) {
        // File might not exist, that's ok
      }
    }
    
    return deleted;
  }

  /**
   * Get all sessions (with optional filters)
   * @param {Object} filters - Filter options
   * @returns {Array} Session summaries
   */
  async getSessions(filters = {}) {
    await this.initialize();
    
    let sessions = Array.from(this.sessions.values());
    
    // Apply filters
    if (filters.agentId) {
      sessions = sessions.filter(s => s.agentId === filters.agentId);
    }
    
    if (filters.activeOnly) {
      sessions = sessions.filter(s => !s.isExpired());
    }
    
    // Sort by last accessed
    sessions.sort((a, b) => b.metadata.lastAccessedAt - a.metadata.lastAccessedAt);
    
    // Apply limit
    if (filters.limit) {
      sessions = sessions.slice(0, filters.limit);
    }
    
    return sessions.map(s => s.toSummary());
  }

  /**
   * Search across all sessions
   * @param {string} keyword - Search term
   * @param {Object} options - Search options
   * @returns {Array} Matching messages from all sessions
   */
  async searchAll(keyword, options = {}) {
    await this.initialize();
    
    const results = [];
    
    for (const session of this.sessions.values()) {
      const matches = session.search(keyword, options);
      results.push(...matches);
    }
    
    // Sort by timestamp (most recent first)
    results.sort((a, b) => b.timestamp - a.timestamp);
    
    if (options.limit) {
      return results.slice(0, options.limit);
    }
    
    return results;
  }

  /**
   * Save all sessions to disk
   */
  async saveAll() {
    const savePromises = [];
    
    for (const session of this.sessions.values()) {
      if (session.unsavedChanges) {
        savePromises.push(this._saveSession(session));
      }
    }
    
    await Promise.all(savePromises);
  }

  /**
   * Save a specific session
   * @param {Session} session 
   */
  async _saveSession(session) {
    const filePath = this._getFilePath(session.sessionId, session.agentId);
    const data = session.toJSON();
    
    try {
      await fs.mkdir(path.dirname(filePath), { recursive: true });
      await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf8');
      session.unsavedChanges = false;
    } catch (error) {
      console.error(`Failed to save session ${session.sessionId}:`, error);
    }
  }

  /**
   * Load a session from disk
   * @param {string} sessionId 
   * @param {string} agentId 
   * @returns {Session|null}
   */
  async _loadSession(sessionId, agentId) {
    const filePath = this._getFilePath(sessionId, agentId);
    
    try {
      const data = await fs.readFile(filePath, 'utf8');
      const sessionData = JSON.parse(data);
      return Session.fromJSON(sessionData);
    } catch (error) {
      return null;
    }
  }

  /**
   * Load all sessions from disk
   * @private
   */
  async _loadAllSessions() {
    try {
      const files = await fs.readdir(SESSIONS_DIR);
      const jsonFiles = files.filter(f => f.endsWith('.json'));
      
      for (const file of jsonFiles) {
        try {
          const filePath = path.join(SESSIONS_DIR, file);
          const data = await fs.readFile(filePath, 'utf8');
          const sessionData = JSON.parse(data);
          
          // Skip expired sessions
          const session = Session.fromJSON(sessionData);
          if (!session.isExpired()) {
            const key = this._getSessionKey(session.sessionId, session.agentId);
            this.sessions.set(key, session);
          } else {
            // Delete expired session file
            await fs.unlink(filePath).catch(() => {});
          }
        } catch (error) {
          console.error(`Failed to load session file ${file}:`, error);
        }
      }
    } catch (error) {
      // Directory might not exist yet
    }
  }

  /**
   * Start auto-save timer
   * @private
   */
  _startAutoSave() {
    if (this.autoSaveTimer) {
      clearInterval(this.autoSaveTimer);
    }
    
    this.autoSaveTimer = setInterval(async () => {
      try {
        await this.saveAll();
      } catch (error) {
        console.error('Auto-save failed:', error);
      }
    }, AUTO_SAVE_INTERVAL_MS);
  }

  /**
   * Start cleanup timer for expired sessions
   * @private
   */
  _startCleanup() {
    setInterval(async () => {
      const expiredSessions = [];
      
      for (const [key, session] of this.sessions.entries()) {
        if (session.isExpired()) {
          expiredSessions.push({ key, session });
        }
      }
      
      for (const { key, session } of expiredSessions) {
        this.sessions.delete(key);
        const filePath = this._getFilePath(session.sessionId, session.agentId);
        await fs.unlink(filePath).catch(() => {});
      }
      
      if (expiredSessions.length > 0) {
        console.log(`Cleaned up ${expiredSessions.length} expired sessions`);
      }
    }, 5 * 60 * 1000); // Check every 5 minutes
  }

  /**
   * Get file path for session
   * @private
   */
  _getFilePath(sessionId, agentId) {
    const filename = `${agentId}_${sessionId}.json`;
    return path.join(SESSIONS_DIR, filename);
  }

  /**
   * Get session key for Map
   * @private
   */
  _getSessionKey(sessionId, agentId) {
    return `${agentId}:${sessionId}`;
  }

  /**
   * Shutdown the session manager
   */
  async shutdown() {
    if (this.autoSaveTimer) {
      clearInterval(this.autoSaveTimer);
    }
    
    await this.saveAll();
    this._initialized = false;
    console.log('Session manager shutdown complete');
  }
}

// Singleton instance
const sessionManager = new SessionManager();

export { Session, SessionManager, sessionManager };
export default sessionManager;

/*
// Usage example:
import sessionManager from './memory.js';

// Create a new session for an agent
const session = await sessionManager.createSession('research-agent', {
  userId: 'user123',
  platform: 'web'
});

// Add messages
session.addMessage('user', 'What is quantum computing?');
session.addMessage('assistant', 'Quantum computing uses qubits...');

// Get context for AI model
const context = session.getContext(4000); // 4000 token limit

// Search across all sessions
const results = await sessionManager.searchAll('quantum');

// Auto-save happens every 30 seconds
// Sessions expire after 24 hours of inactivity
*/