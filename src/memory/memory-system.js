#!/usr/bin/env node

import { EventEmitter } from 'events';
import crypto from 'crypto';
import Database from 'better-sqlite3';

// ═══════════════════════════════════════════════════════════════════════════
// ADVANCED MEMORY SYSTEM
// Vector embeddings, semantic search, episodic memory, working memory
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Memory types
 */
export const MemoryType = {
  EPISODIC: 'episodic',      // Events, experiences
  SEMANTIC: 'semantic',      // Facts, knowledge
  PROCEDURAL: 'procedural',  // How-to, skills
  WORKING: 'working',        // Current context
  LONG_TERM: 'long_term'     // Persistent knowledge
};

/**
 * Simple vector operations (no external dependencies)
 */
class VectorStore {
  constructor() {
    this.vectors = new Map();
    this.metadata = new Map();
  }

  /**
   * Simple text to vector conversion (TF-IDF inspired)
   */
  textToVector(text, dimensions = 128) {
    const words = text.toLowerCase().split(/\s+/);
    const vector = new Array(dimensions).fill(0);

    words.forEach((word, i) => {
      // Simple hash-based vectorization
      const hash = this._hashString(word);
      const idx = hash % dimensions;
      vector[idx] += 1;

      // Add some distribution
      for (let j = 1; j <= 3; j++) {
        vector[(idx + j * 7) % dimensions] += 0.5;
        vector[(idx - j * 7 + dimensions) % dimensions] += 0.5;
      }
    });

    // Normalize
    const magnitude = Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0));
    if (magnitude > 0) {
      for (let i = 0; i < dimensions; i++) {
        vector[i] /= magnitude;
      }
    }

    return vector;
  }

  _hashString(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash);
  }

  /**
   * Cosine similarity between two vectors
   */
  cosineSimilarity(a, b) {
    if (a.length !== b.length) return 0;

    let dotProduct = 0;
    let magnitudeA = 0;
    let magnitudeB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      magnitudeA += a[i] * a[i];
      magnitudeB += b[i] * b[i];
    }

    const magnitude = Math.sqrt(magnitudeA) * Math.sqrt(magnitudeB);
    return magnitude === 0 ? 0 : dotProduct / magnitude;
  }

  /**
   * Add vector to store
   */
  add(id, text, metadata = {}) {
    const vector = this.textToVector(text);
    this.vectors.set(id, vector);
    this.metadata.set(id, { text, ...metadata, createdAt: Date.now() });
    return id;
  }

  /**
   * Search for similar vectors
   */
  search(query, limit = 10, threshold = 0.3) {
    const queryVector = this.textToVector(query);
    const results = [];

    for (const [id, vector] of this.vectors) {
      const similarity = this.cosineSimilarity(queryVector, vector);
      if (similarity >= threshold) {
        results.push({
          id,
          similarity,
          ...this.metadata.get(id)
        });
      }
    }

    return results
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, limit);
  }

  /**
   * Remove vector
   */
  remove(id) {
    this.vectors.delete(id);
    this.metadata.delete(id);
  }

  /**
   * Get all vectors count
   */
  get size() {
    return this.vectors.size;
  }
}

/**
 * Memory Entry
 */
class MemoryEntry {
  constructor(config) {
    this.id = config.id || `mem_${crypto.randomBytes(8).toString('hex')}`;
    this.type = config.type || MemoryType.EPISODIC;
    this.content = config.content;
    this.agentId = config.agentId;
    this.sessionId = config.sessionId;
    this.importance = config.importance || 0.5; // 0-1
    this.tags = config.tags || [];
    this.context = config.context || {};
    this.metadata = config.metadata || {};
    this.createdAt = Date.now();
    this.lastAccessed = Date.now();
    this.accessCount = 0;
    this.expiresAt = config.expiresAt || null;
  }

  /**
   * Access the memory (updates access stats)
   */
  access() {
    this.lastAccessed = Date.now();
    this.accessCount += 1;
    return this;
  }

  /**
   * Check if memory is expired
   */
  isExpired() {
    if (!this.expiresAt) return false;
    return Date.now() > this.expiresAt;
  }

  /**
   * Calculate relevance score
   */
  getRelevance() {
    const age = Date.now() - this.createdAt;
    const ageHours = age / (1000 * 60 * 60);

    // Decay factor: importance * recency * frequency
    const recencyFactor = Math.exp(-ageHours / 24); // Half-life of 24 hours
    const frequencyFactor = Math.min(1, Math.log10(this.accessCount + 1) / 2);

    return this.importance * recencyFactor * (0.5 + 0.5 * frequencyFactor);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// EPISODIC MEMORY - Events and experiences
// ═══════════════════════════════════════════════════════════════════════════

export class EpisodicMemory {
  constructor() {
    this.episodes = new Map();
    this.timeline = [];
  }

  /**
   * Record an episode
   */
  record(episode) {
    const entry = new MemoryEntry({
      type: MemoryType.EPISODIC,
      content: episode.description || episode.content,
      agentId: episode.agentId,
      sessionId: episode.sessionId,
      importance: episode.importance || 0.5,
      tags: episode.tags || [],
      context: {
        action: episode.action,
        outcome: episode.outcome,
        ...episode.context
      }
    });

    this.episodes.set(entry.id, entry);
    this.timeline.push({
      id: entry.id,
      timestamp: entry.createdAt,
      summary: entry.content.substring(0, 100)
    });

    // Sort timeline
    this.timeline.sort((a, b) => b.timestamp - a.timestamp);

    // Keep only last 10000 episodes in memory
    if (this.timeline.length > 10000) {
      const toRemove = this.timeline.splice(10000);
      toRemove.forEach(e => this.episodes.delete(e.id));
    }

    return entry;
  }

  /**
   * Recall episodes by query
   */
  recall(query, options = {}) {
    const { limit = 10, agentId, sessionId, since } = options;

    let episodes = Array.from(this.episodes.values());

    // Filter by agent
    if (agentId) {
      episodes = episodes.filter(e => e.agentId === agentId);
    }

    // Filter by session
    if (sessionId) {
      episodes = episodes.filter(e => e.sessionId === sessionId);
    }

    // Filter by time
    if (since) {
      const sinceTime = typeof since === 'number' ? since : Date.now() - since;
      episodes = episodes.filter(e => e.createdAt >= sinceTime);
    }

    // Simple text search (could be enhanced with vector search)
    if (query) {
      const queryLower = query.toLowerCase();
      episodes = episodes.filter(e =>
        e.content.toLowerCase().includes(queryLower) ||
        e.tags.some(t => t.toLowerCase().includes(queryLower))
      );
    }

    // Sort by relevance
    episodes.sort((a, b) => b.getRelevance() - a.getRelevance());

    return episodes.slice(0, limit).map(e => e.access());
  }

  /**
   * Get recent episodes
   */
  getRecent(count = 20) {
    return this.timeline.slice(0, count).map(t => this.episodes.get(t.id)).filter(Boolean);
  }

  /**
   * Get timeline for a period
   */
  getTimeline(startTime, endTime) {
    return this.timeline
      .filter(t => t.timestamp >= startTime && t.timestamp <= endTime)
      .map(t => this.episodes.get(t.id))
      .filter(Boolean);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// SEMANTIC MEMORY - Facts and knowledge
// ═══════════════════════════════════════════════════════════════════════════

export class SemanticMemory {
  constructor() {
    this.facts = new Map();
    this.vectorStore = new VectorStore();
    this.concepts = new Map(); // Related concepts
  }

  /**
   * Store a fact
   */
  store(fact) {
    const entry = new MemoryEntry({
      type: MemoryType.SEMANTIC,
      content: fact.content || fact.fact,
      agentId: fact.agentId,
      importance: fact.importance || 0.6,
      tags: fact.tags || [],
      context: {
        source: fact.source,
        confidence: fact.confidence || 1.0,
        ...fact.context
      }
    });

    this.facts.set(entry.id, entry);
    this.vectorStore.add(entry.id, entry.content, {
      type: 'fact',
      tags: entry.tags
    });

    // Update concept graph
    this._updateConcepts(entry);

    return entry;
  }

  /**
   * Update concept relationships
   */
  _updateConcepts(entry) {
    const words = entry.content.toLowerCase().split(/\s+/);
    const concepts = words.filter(w => w.length > 4); // Simple: long words are concepts

    for (const concept of concepts) {
      if (!this.concepts.has(concept)) {
        this.concepts.set(concept, new Set());
      }
      this.concepts.get(concept).add(entry.id);

      // Link related concepts
      for (const other of concepts) {
        if (other !== concept) {
          if (!this.concepts.has(concept)) {
            this.concepts.set(concept, new Set());
          }
          // Store association strength
        }
      }
    }
  }

  /**
   * Search facts by semantic similarity
   */
  search(query, options = {}) {
    const { limit = 10, threshold = 0.3, tags } = options;

    let results = this.vectorStore.search(query, limit * 2, threshold);

    // Filter by tags
    if (tags && tags.length > 0) {
      results = results.filter(r =>
        tags.some(tag => r.tags?.includes(tag))
      );
    }

    // Add full entry data
    return results.map(r => {
      const entry = this.facts.get(r.id);
      if (entry) {
        entry.access();
        return { ...entry, similarity: r.similarity };
      }
      return null;
    }).filter(Boolean).slice(0, limit);
  }

  /**
   * Get facts by tag
   */
  getByTag(tag) {
    return Array.from(this.facts.values())
      .filter(f => f.tags.includes(tag))
      .sort((a, b) => b.getRelevance() - a.getRelevance());
  }

  /**
   * Get related facts
   */
  getRelated(factId, limit = 5) {
    const fact = this.facts.get(factId);
    if (!fact) return [];

    const content = fact.content;
    return this.vectorStore.search(content, limit + 1)
      .filter(r => r.id !== factId)
      .map(r => this.facts.get(r.id))
      .filter(Boolean);
  }

  /**
   * Consolidate similar facts
   */
  consolidate() {
    const facts = Array.from(this.facts.values());
    const duplicates = [];

    for (let i = 0; i < facts.length; i++) {
      for (let j = i + 1; j < facts.length; j++) {
        const sim = this.vectorStore.cosineSimilarity(
          this.vectorStore.textToVector(facts[i].content),
          this.vectorStore.textToVector(facts[j].content)
        );

        if (sim > 0.9) {
          duplicates.push({ keep: facts[i], merge: facts[j], similarity: sim });
        }
      }
    }

    // Merge duplicates
    for (const dup of duplicates) {
      // Combine tags
      dup.keep.tags = [...new Set([...dup.keep.tags, ...dup.merge.tags])];
      dup.keep.importance = Math.max(dup.keep.importance, dup.merge.importance);
      this.facts.delete(dup.merge.id);
      this.vectorStore.remove(dup.merge.id);
    }

    return duplicates.length;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// WORKING MEMORY - Current context and attention
// ═══════════════════════════════════════════════════════════════════════════

export class WorkingMemory {
  constructor(maxSize = 100) {
    this.maxSize = maxSize;
    this.slots = new Map(); // Named slots for different context types
    this.attention = []; // Attention queue (most recent first)
    this.focus = null; // Current focus
  }

  /**
   * Store in a named slot
   */
  setSlot(name, value, metadata = {}) {
    this.slots.set(name, {
      value,
      metadata,
      updatedAt: Date.now()
    });
    return this;
  }

  /**
   * Get from a named slot
   */
  getSlot(name) {
    const slot = this.slots.get(name);
    return slot ? slot.value : null;
  }

  /**
   * Add to attention queue
   */
  attend(item, priority = 0.5) {
    this.attention.unshift({
      id: `att_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      content: item,
      priority,
      timestamp: Date.now()
    });

    // Keep within size limit
    if (this.attention.length > this.maxSize) {
      this.attention = this.attention.slice(0, this.maxSize);
    }

    return this;
  }

  /**
   * Get current attention items
   */
  getAttention(count = 10) {
    return this.attention.slice(0, count);
  }

  /**
   * Set current focus
   */
  setFocus(focus) {
    this.focus = {
      content: focus,
      setAt: Date.now()
    };
    this.attend(`Focus: ${focus}`, 0.9);
    return this;
  }

  /**
   * Get current focus
   */
  getFocus() {
    return this.focus;
  }

  /**
   * Clear working memory
   */
  clear() {
    this.slots.clear();
    this.attention = [];
    this.focus = null;
    return this;
  }

  /**
   * Get summary of current context
   */
  getContext() {
    const slotValues = {};
    for (const [name, slot] of this.slots) {
      slotValues[name] = slot.value;
    }

    return {
      focus: this.focus?.content || null,
      slots: slotValues,
      recentAttention: this.attention.slice(0, 5).map(a => a.content)
    };
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// PROCEDURAL MEMORY - Skills and how-to knowledge
// ═══════════════════════════════════════════════════════════════════════════

export class ProceduralMemory {
  constructor() {
    this.procedures = new Map();
    this.patterns = new Map();
  }

  /**
   * Store a procedure
   */
  store(procedure) {
    const id = procedure.id || `proc_${crypto.randomBytes(8).toString('hex')}`;

    this.procedures.set(id, {
      id,
      name: procedure.name,
      description: procedure.description,
      steps: procedure.steps || [],
      triggers: procedure.triggers || [],
      successCount: 0,
      failureCount: 0,
      avgDuration: 0,
      createdAt: Date.now()
    });

    return id;
  }

  /**
   * Find matching procedures
   */
  findMatching(context) {
    const matches = [];

    for (const [id, proc] of this.procedures) {
      const score = this._calculateMatchScore(proc, context);
      if (score > 0.3) {
        matches.push({ ...proc, matchScore: score });
      }
    }

    return matches.sort((a, b) => b.matchScore - a.matchScore);
  }

  /**
   * Calculate match score
   */
  _calculateMatchScore(procedure, context) {
    let score = 0;
    const contextStr = JSON.stringify(context).toLowerCase();

    for (const trigger of procedure.triggers) {
      if (contextStr.includes(trigger.toLowerCase())) {
        score += 0.3;
      }
    }

    // Success rate factor
    const total = procedure.successCount + procedure.failureCount;
    if (total > 0) {
      score *= (procedure.successCount / total);
    }

    return Math.min(1, score);
  }

  /**
   * Record procedure execution
   */
  recordExecution(procedureId, success, duration) {
    const proc = this.procedures.get(procedureId);
    if (!proc) return;

    if (success) {
      proc.successCount++;
    } else {
      proc.failureCount++;
    }

    // Update average duration
    const total = proc.successCount + proc.failureCount;
    proc.avgDuration = ((proc.avgDuration * (total - 1)) + duration) / total;
  }

  /**
   * Get most successful procedures
   */
  getBest(limit = 10) {
    return Array.from(this.procedures.values())
      .map(p => ({
        ...p,
        successRate: p.successCount / (p.successCount + p.failureCount) || 0
      }))
      .sort((a, b) => b.successRate - a.successRate)
      .slice(0, limit);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// MEMORY MANAGER - Unified memory interface
// ═══════════════════════════════════════════════════════════════════════════

export class MemoryManager extends EventEmitter {
  constructor(options = {}) {
    super();

    this.dbPath = options.dbPath || ':memory:';
    this.db = null;

    // Memory stores
    this.episodic = new EpisodicMemory();
    this.semantic = new SemanticMemory();
    this.working = new WorkingMemory(options.workingMemorySize || 100);
    this.procedural = new ProceduralMemory();

    // Global vector store
    this.vectorStore = new VectorStore();

    // Memory consolidation
    this.consolidationInterval = options.consolidationInterval || 300000; // 5 minutes
    this._startConsolidation();
  }

  /**
   * Initialize persistent storage
   */
  async initialize() {
    this.db = new Database(this.dbPath);
    this.db.pragma('journal_mode = WAL');

    // Create tables
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS memories (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        content TEXT NOT NULL,
        agent_id TEXT,
        session_id TEXT,
        importance REAL DEFAULT 0.5,
        tags TEXT,
        context TEXT,
        created_at INTEGER,
        last_accessed INTEGER,
        access_count INTEGER DEFAULT 0,
        expires_at INTEGER
      );

      CREATE INDEX IF NOT EXISTS idx_memories_type ON memories(type);
      CREATE INDEX IF NOT EXISTS idx_memories_agent ON memories(agent_id);
      CREATE INDEX IF NOT EXISTS idx_memories_session ON memories(session_id);
      CREATE INDEX IF NOT EXISTS idx_memories_created ON memories(created_at);
    `);

    // Load memories from disk
    this._loadFromDisk();

    return this;
  }

  /**
   * Load memories from disk
   */
  _loadFromDisk() {
    if (!this.db) return;

    const rows = this.db.prepare('SELECT * FROM memories ORDER BY created_at DESC LIMIT 10000').all();

    for (const row of rows) {
      const tags = row.tags ? JSON.parse(row.tags) : [];
      const context = row.context ? JSON.parse(row.context) : {};

      const entry = new MemoryEntry({
        id: row.id,
        type: row.type,
        content: row.content,
        agentId: row.agent_id,
        sessionId: row.session_id,
        importance: row.importance,
        tags,
        context
      });

      entry.lastAccessed = row.last_accessed;
      entry.accessCount = row.access_count;

      // Add to appropriate store
      switch (row.type) {
        case MemoryType.EPISODIC:
          this.episodic.episodes.set(entry.id, entry);
          break;
        case MemoryType.SEMANTIC:
          this.semantic.facts.set(entry.id, entry);
          this.semantic.vectorStore.add(entry.id, entry.content);
          break;
        case MemoryType.PROCEDURAL:
          // Procedural handled separately
          break;
      }

      this.vectorStore.add(entry.id, entry.content);
    }
  }

  /**
   * Save memory to disk
   */
  _saveToDisk(entry) {
    if (!this.db) return;

    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO memories (id, type, content, agent_id, session_id, importance, tags, context, created_at, last_accessed, access_count, expires_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      entry.id,
      entry.type,
      entry.content,
      entry.agentId,
      entry.sessionId,
      entry.importance,
      JSON.stringify(entry.tags),
      JSON.stringify(entry.context),
      entry.createdAt,
      entry.lastAccessed,
      entry.accessCount,
      entry.expiresAt
    );
  }

  /**
   * Remember something
   */
  remember(content, options = {}) {
    const type = options.type || MemoryType.SEMANTIC;

    const entry = new MemoryEntry({
      type,
      content,
      agentId: options.agentId,
      sessionId: options.sessionId,
      importance: options.importance || 0.5,
      tags: options.tags || [],
      context: options.context || {}
    });

    // Add to appropriate store
    switch (type) {
      case MemoryType.EPISODIC:
        this.episodic.record({
          description: content,
          agentId: options.agentId,
          sessionId: options.sessionId,
          importance: options.importance,
          tags: options.tags,
          context: options.context
        });
        break;

      case MemoryType.SEMANTIC:
        this.semantic.store({
          content,
          agentId: options.agentId,
          importance: options.importance,
          tags: options.tags,
          source: options.source
        });
        break;

      case MemoryType.PROCEDURAL:
        this.procedural.store({
          name: options.name,
          description: content,
          steps: options.steps,
          triggers: options.triggers
        });
        break;
    }

    // Add to global vector store
    this.vectorStore.add(entry.id, entry.content);

    // Save to disk
    this._saveToDisk(entry);

    // Update working memory
    this.working.attend(content, options.importance || 0.5);

    this.emit('memory:created', { type, entry });
    return entry;
  }

  /**
   * Recall memories
   */
  recall(query, options = {}) {
    const { type, limit = 10, agentId, sessionId } = options;

    switch (type) {
      case MemoryType.EPISODIC:
        return this.episodic.recall(query, { limit, agentId, sessionId });

      case MemoryType.SEMANTIC:
        return this.semantic.search(query, { limit });

      case MemoryType.PROCEDURAL:
        return this.procedural.findMatching(query);

      default:
        // Search all memories
        const vectorResults = this.vectorStore.search(query, limit);
        return vectorResults.map(r => {
          const episodic = this.episodic.episodes.get(r.id);
          if (episodic) return episodic;
          const semantic = this.semantic.facts.get(r.id);
          if (semantic) return semantic;
          return null;
        }).filter(Boolean);
    }
  }

  /**
   * Get context for current task
   */
  getContext(options = {}) {
    const { agentId, sessionId, taskDescription } = options;

    // Get working memory context
    const workingContext = this.working.getContext();

    // Get relevant memories
    const relevantMemories = taskDescription
      ? this.recall(taskDescription, { limit: 5, agentId })
      : [];

    // Get recent episodes
    const recentEpisodes = this.episodic.getRecent(5);

    return {
      working: workingContext,
      relevant: relevantMemories,
      recent: recentEpisodes,
      focus: this.working.getFocus()
    };
  }

  /**
   * Set current focus
   */
  setFocus(focus) {
    this.working.setFocus(focus);
  }

  /**
   * Start periodic consolidation
   */
  _startConsolidation() {
    setInterval(() => {
      this.consolidate();
    }, this.consolidationInterval);
  }

  /**
   * Consolidate memories
   */
  consolidate() {
    // Consolidate semantic duplicates
    const mergedCount = this.semantic.consolidate();

    // Save all modified memories to disk
    if (this.db) {
      for (const entry of this.semantic.facts.values()) {
        this._saveToDisk(entry);
      }
      for (const entry of this.episodic.episodes.values()) {
        this._saveToDisk(entry);
      }
    }

    this.emit('memory:consolidated', { mergedCount });
    return { mergedCount };
  }

  /**
   * Get memory statistics
   */
  getStats() {
    return {
      episodic: this.episodic.episodes.size,
      semantic: this.semantic.facts.size,
      procedural: this.procedural.procedures.size,
      working: {
        slots: this.working.slots.size,
        attention: this.working.attention.length
      },
      vectorStore: this.vectorStore.size
    };
  }

  /**
   * Clear all memories
   */
  clear() {
    this.episodic = new EpisodicMemory();
    this.semantic = new SemanticMemory();
    this.working = new WorkingMemory();
    this.procedural = new ProceduralMemory();
    this.vectorStore = new VectorStore();

    if (this.db) {
      this.db.exec('DELETE FROM memories');
    }

    this.emit('memory:cleared');
  }

  /**
   * Export memories
   */
  export() {
    return {
      episodic: Array.from(this.episodic.episodes.values()),
      semantic: Array.from(this.semantic.facts.values()),
      procedural: Array.from(this.procedural.procedures.values()),
      exportedAt: Date.now()
    };
  }

  /**
   * Import data
   */
  import(data) {
    if (data.episodic) {
      for (const mem of data.episodic) {
        this.episodic.store(mem);
      }
    }

    if (data.semantic) {
      for (const fact of data.semantic) {
        this.semantic.store(fact);
      }
    }

    if (data.procedural) {
      for (const proc of data.procedural) {
        this.procedural.store(proc);
      }
    }

    this.emit('memory:imported', { count: (data.episodic?.length || 0) + (data.semantic?.length || 0) });
  }

  /**
   * Batch remember multiple entries
   */
  rememberBatch(entries) {
    const results = [];
    for (const entry of entries) {
      results.push(this.remember(entry.content, entry.options || {}));
    }
    return results;
  }

  /**
   * Search across all memory types
   */
  searchAll(query, options = {}) {
    const results = {
      episodic: this.episodic.recall(query, options),
      semantic: this.semantic.search(query, options),
      procedural: this.procedural.findMatching({ query, ...options })
    };

    // Combine and sort by relevance
    const combined = [
      ...results.episodic.map(r => ({ ...r, source: 'episodic' })),
      ...results.semantic.map(r => ({ ...r, source: 'semantic' })),
      ...results.procedural.map(r => ({ ...r, source: 'procedural' }))
    ].sort((a, b) => (b.relevance || 0) - (a.relevance || 0));

    return combined.slice(0, options.limit || 20);
  }

  /**
   * Get memory summary for a topic
   */
  summarize(topic, options = {}) {
    const memories = this.searchAll(topic, { limit: options.limit || 50 });
    const byType = { episodic: 0, semantic: 0, procedural: 0 };
    let totalRelevance = 0;

    for (const m of memories) {
      byType[m.source]++;
      totalRelevance += m.relevance || 0;
    }

    return {
      topic,
      totalMemories: memories.length,
      byType,
      avgRelevance: memories.length > 0 ? (totalRelevance / memories.length).toFixed(3) : 0,
      topMemories: memories.slice(0, 5).map(m => ({ content: m.content, source: m.source, relevance: m.relevance }))
    };
  }

  /**
   * Get memory health stats
   */
  getHealth() {
    return {
      episodic: { total: this.episodic.episodes.size },
      semantic: this.semantic.getStats(),
      working: { slots: this.working.slots.size, attentionItems: this.working.attentionQueue.length },
      totalMemories: this.episodic.episodes.size + this.semantic.facts.size,
      vectorStore: { documents: this.semantic.vectorStore.documents.length, dimension: 128 },
      consolidationRunning: this.consolidationRunning,
      healthy: !this.consolidationRunning
    };
  }

  /**
   * Get memory summary for a topic
   */
  summarize(topic, options = {}) {
    const memories = this.searchAll(topic, { limit: options.limit || 50 });
    const byType = { episodic: 0, semantic: 0, procedural: 0 };
    let totalRelevance = 0;

    for (const m of memories) {
      byType[m.source]++;
      totalRelevance += m.relevance || 0;
    }

    return {
      topic,
      totalMemories: memories.length,
      byType,
      avgRelevance: memories.length > 0 ? (totalRelevance / memories.length).toFixed(3) : 0,
      topMemories: memories.slice(0, 5).map(m => ({ content: m.content, source: m.source, relevance: m.relevance }))
    };
  }

  /**
   * Forget memories matching criteria
   */
  forget(criteria = {}) {
    let count = 0;

    if (criteria.tag) {
      count += this.semantic.forgetByTag(criteria.tag);
      count += this.episodic.forgetByTag?.(criteria.tag) || 0;
    }

    if (criteria.olderThan) {
      const cutoff = Date.now() - criteria.olderThan;
      count += this.semantic.forgetOlderThan?.(cutoff) || 0;
      count += this.episodic.forgetOlderThan?.(cutoff) || 0;
    }

    if (criteria.agentId) {
      count += this.episodic.forgetByAgent?.(criteria.agentId) || 0;
    }

    this.emit('memory:forgotten', { criteria, count });
    return count;
  }
}

// Export singleton
let manager = null;

export function getMemoryManager(options) {
  if (!manager) {
    manager = new MemoryManager(options);
  }
  return manager;
}

export default {
  MemoryManager,
  MemoryType,
  MemoryEntry,
  VectorStore,
  EpisodicMemory,
  SemanticMemory,
  WorkingMemory,
  ProceduralMemory,
  getMemoryManager
};