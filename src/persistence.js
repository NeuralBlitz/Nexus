#!/usr/bin/env node

import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.join(__dirname, '..');

// ═══════════════════════════════════════════════════════════════════════════
// TASK PERSISTENCE MODULE
// ═══════════════════════════════════════════════════════════════════════════

class TaskPersistence {
  constructor(dbPath = null) {
    this.dbPath = dbPath || path.join(rootDir, 'data', 'nexus.db');
    this.db = null;
    this.initialized = false;
  }

  /**
   * Initialize the database connection and create tables
   */
  async initialize() {
    // Ensure data directory exists
    const dir = path.dirname(this.dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    this.db = new Database(this.dbPath);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('foreign_keys = ON');

    // Create tables
    this.createTables();

    this.initialized = true;
    console.log(`[Persistence] Database initialized at ${this.dbPath}`);

    return this;
  }

  /**
   * Create required tables
   */
  createTables() {
    // Tasks table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS tasks (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        description TEXT,
        agent_id TEXT NOT NULL,
        agent_name TEXT,
        status TEXT DEFAULT 'pending',
        priority TEXT DEFAULT 'medium',
        result TEXT,
        error TEXT,
        metadata TEXT,
        created_at INTEGER DEFAULT (unixepoch()),
        started_at INTEGER,
        completed_at INTEGER,
        duration_ms INTEGER,
        xp_earned INTEGER DEFAULT 0
      );

      CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
      CREATE INDEX IF NOT EXISTS idx_tasks_agent ON tasks(agent_id);
      CREATE INDEX IF NOT EXISTS idx_tasks_created ON tasks(created_at);
    `);

    // Sessions table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        user_id TEXT,
        agent_id TEXT,
        channel TEXT DEFAULT 'cli',
        started_at INTEGER DEFAULT (unixepoch()),
        ended_at INTEGER,
        message_count INTEGER DEFAULT 0,
        metadata TEXT
      );
    `);

    // Agent history table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS agent_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        agent_id TEXT NOT NULL,
        event_type TEXT NOT NULL,
        event_data TEXT,
        timestamp INTEGER DEFAULT (unixepoch())
      );

      CREATE INDEX IF NOT EXISTS idx_agent_history_agent ON agent_history(agent_id);
      CREATE INDEX IF NOT EXISTS idx_agent_history_time ON agent_history(timestamp);
    `);

    // Workflows table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS workflows (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        steps TEXT NOT NULL,
        status TEXT DEFAULT 'pending',
        created_at INTEGER DEFAULT (unixepoch()),
        updated_at INTEGER DEFAULT (unixepoch())
      );
    `);

    // Workflow runs table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS workflow_runs (
        id TEXT PRIMARY KEY,
        workflow_id TEXT NOT NULL,
        status TEXT DEFAULT 'running',
        current_step INTEGER DEFAULT 0,
        started_at INTEGER DEFAULT (unixepoch()),
        completed_at INTEGER,
        result TEXT,
        error TEXT,
        FOREIGN KEY (workflow_id) REFERENCES workflows(id)
      );
    `);

    // Integration logs
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS integration_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        integration TEXT NOT NULL,
        event_type TEXT NOT NULL,
        payload TEXT,
        status TEXT DEFAULT 'success',
        error TEXT,
        timestamp INTEGER DEFAULT (unixepoch())
      );
    `);
  }

  // ═══════════════════════════════════════════════════════════════════════
  // TASK OPERATIONS
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Create a new task
   */
  createTask(task) {
    const stmt = this.db.prepare(`
      INSERT INTO tasks (id, title, description, agent_id, agent_name, priority, metadata)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    const id = task.id || `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    stmt.run(
      id,
      task.title,
      task.description || null,
      task.agentId,
      task.agentName || null,
      task.priority || 'medium',
      task.metadata ? JSON.stringify(task.metadata) : null
    );

    return { id, ...task };
  }

  /**
   * Get task by ID
   */
  getTask(id) {
    const stmt = this.db.prepare('SELECT * FROM tasks WHERE id = ?');
    const task = stmt.get(id);

    if (task && task.metadata) {
      task.metadata = JSON.parse(task.metadata);
    }

    return task;
  }

  /**
   * Update task status
   */
  updateTask(id, updates) {
    const fields = [];
    const values = [];

    if (updates.status) {
      fields.push('status = ?');
      values.push(updates.status);

      if (updates.status === 'running' && !updates.startedAt) {
        fields.push('started_at = ?');
        values.push(Math.floor(Date.now() / 1000));
      }

      if ((updates.status === 'completed' || updates.status === 'failed') && !updates.completedAt) {
        fields.push('completed_at = ?');
        const completedAt = Math.floor(Date.now() / 1000);
        values.push(completedAt);

        // Calculate duration if task was started
        const task = this.getTask(id);
        if (task && task.started_at) {
          const duration = (completedAt - task.started_at) * 1000;
          fields.push('duration_ms = ?');
          values.push(duration);
        }
      }
    }

    if (updates.result !== undefined) {
      fields.push('result = ?');
      values.push(typeof updates.result === 'string' ? updates.result : JSON.stringify(updates.result));
    }

    if (updates.error !== undefined) {
      fields.push('error = ?');
      values.push(updates.error);
    }

    if (updates.xpEarned !== undefined) {
      fields.push('xp_earned = ?');
      values.push(updates.xpEarned);
    }

    if (fields.length === 0) return false;

    values.push(id);
    const stmt = this.db.prepare(`UPDATE tasks SET ${fields.join(', ')} WHERE id = ?`);
    const result = stmt.run(...values);

    return result.changes > 0;
  }

  /**
   * Get recent tasks
   */
  getRecentTasks(options = {}) {
    const { limit = 50, offset = 0, status, agentId } = options;

    let query = 'SELECT * FROM tasks WHERE 1=1';
    const params = [];

    if (status) {
      query += ' AND status = ?';
      params.push(status);
    }

    if (agentId) {
      query += ' AND agent_id = ?';
      params.push(agentId);
    }

    query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const stmt = this.db.prepare(query);
    const tasks = stmt.all(...params);

    return tasks.map(task => {
      if (task.metadata) {
        task.metadata = JSON.parse(task.metadata);
      }
      return task;
    });
  }

  /**
   * Get task statistics
   */
  getTaskStats() {
    const total = this.db.prepare('SELECT COUNT(*) as count FROM tasks').get();
    const completed = this.db.prepare("SELECT COUNT(*) as count FROM tasks WHERE status = 'completed'").get();
    const failed = this.db.prepare("SELECT COUNT(*) as count FROM tasks WHERE status = 'failed'").get();
    const pending = this.db.prepare("SELECT COUNT(*) as count FROM tasks WHERE status = 'pending'").get();
    const running = this.db.prepare("SELECT COUNT(*) as count FROM tasks WHERE status = 'running'").get();

    const totalXp = this.db.prepare('SELECT COALESCE(SUM(xp_earned), 0) as total FROM tasks').get();
    const avgDuration = this.db.prepare('SELECT AVG(duration_ms) as avg FROM tasks WHERE duration_ms IS NOT NULL').get();

    return {
      total: total.count,
      completed: completed.count,
      failed: failed.count,
      pending: pending.count,
      running: running.count,
      totalXp: totalXp.total,
      averageDuration: avgDuration.avg || 0
    };
  }

  // ═══════════════════════════════════════════════════════════════════════
  // SESSION OPERATIONS
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Create a new session
   */
  createSession(session) {
    const stmt = this.db.prepare(`
      INSERT INTO sessions (id, user_id, agent_id, channel, metadata)
      VALUES (?, ?, ?, ?, ?)
    `);

    const id = session.id || `sess_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    stmt.run(
      id,
      session.userId || null,
      session.agentId || null,
      session.channel || 'cli',
      session.metadata ? JSON.stringify(session.metadata) : null
    );

    return { id };
  }

  /**
   * End a session
   */
  endSession(id, messageCount = 0) {
    const stmt = this.db.prepare(`
      UPDATE sessions SET ended_at = unixepoch(), message_count = ? WHERE id = ?
    `);
    return stmt.run(messageCount, id);
  }

  /**
   * Get active sessions
   */
  getActiveSessions() {
    const stmt = this.db.prepare('SELECT * FROM sessions WHERE ended_at IS NULL ORDER BY started_at DESC');
    return stmt.all();
  }

  // ═══════════════════════════════════════════════════════════════════════
  // AGENT HISTORY OPERATIONS
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Log agent event
   */
  logAgentEvent(agentId, eventType, eventData = null) {
    const stmt = this.db.prepare(`
      INSERT INTO agent_history (agent_id, event_type, event_data)
      VALUES (?, ?, ?)
    `);

    stmt.run(
      agentId,
      eventType,
      eventData ? JSON.stringify(eventData) : null
    );
  }

  /**
   * Get agent history
   */
  getAgentHistory(agentId, options = {}) {
    const { limit = 100, offset = 0 } = options;

    const stmt = this.db.prepare(`
      SELECT * FROM agent_history
      WHERE agent_id = ?
      ORDER BY timestamp DESC
      LIMIT ? OFFSET ?
    `);

    const history = stmt.all(agentId, limit, offset);

    return history.map(event => {
      if (event.event_data) {
        event.event_data = JSON.parse(event.event_data);
      }
      return event;
    });
  }

  /**
   * Get agent stats
   */
  getAgentStats(agentId) {
    const totalTasks = this.db.prepare(
      'SELECT COUNT(*) as count FROM tasks WHERE agent_id = ?'
    ).get(agentId);

    const completedTasks = this.db.prepare(
      "SELECT COUNT(*) as count FROM tasks WHERE agent_id = ? AND status = 'completed'"
    ).get(agentId);

    const totalXp = this.db.prepare(
      'SELECT COALESCE(SUM(xp_earned), 0) as total FROM tasks WHERE agent_id = ?'
    ).get(agentId);

    return {
      agentId,
      totalTasks: totalTasks.count,
      completedTasks: completedTasks.count,
      successRate: totalTasks.count > 0 ? (completedTasks.count / totalTasks.count * 100).toFixed(1) : 0,
      totalXp: totalXp.total
    };
  }

  // ═══════════════════════════════════════════════════════════════════════
  // WORKFLOW OPERATIONS
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Create a workflow
   */
  createWorkflow(workflow) {
    const stmt = this.db.prepare(`
      INSERT INTO workflows (id, name, description, steps)
      VALUES (?, ?, ?, ?)
    `);

    const id = workflow.id || `wf_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    stmt.run(
      id,
      workflow.name,
      workflow.description || null,
      JSON.stringify(workflow.steps)
    );

    return { id, ...workflow };
  }

  /**
   * Get workflow
   */
  getWorkflow(id) {
    const stmt = this.db.prepare('SELECT * FROM workflows WHERE id = ?');
    const workflow = stmt.get(id);

    if (workflow && workflow.steps) {
      workflow.steps = JSON.parse(workflow.steps);
    }

    return workflow;
  }

  /**
   * Create workflow run
   */
  createWorkflowRun(run) {
    const stmt = this.db.prepare(`
      INSERT INTO workflow_runs (id, workflow_id, current_step)
      VALUES (?, ?, ?)
    `);

    const id = run.id || `run_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    stmt.run(id, run.workflowId, run.currentStep || 0);

    return { id };
  }

  /**
   * Update workflow run
   */
  updateWorkflowRun(id, updates) {
    const fields = [];
    const values = [];

    if (updates.status) {
      fields.push('status = ?');
      values.push(updates.status);
    }

    if (updates.currentStep !== undefined) {
      fields.push('current_step = ?');
      values.push(updates.currentStep);
    }

    if (updates.result !== undefined) {
      fields.push('result = ?');
      values.push(typeof updates.result === 'string' ? updates.result : JSON.stringify(updates.result));
    }

    if (updates.error !== undefined) {
      fields.push('error = ?');
      values.push(updates.error);
    }

    if (updates.status === 'completed' || updates.status === 'failed') {
      fields.push('completed_at = ?');
      values.push(Math.floor(Date.now() / 1000));
    }

    if (fields.length === 0) return false;

    values.push(id);
    const stmt = this.db.prepare(`UPDATE workflow_runs SET ${fields.join(', ')} WHERE id = ?`);
    const result = stmt.run(...values);

    return result.changes > 0;
  }

  // ═══════════════════════════════════════════════════════════════════════
  // INTEGRATION LOGS
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Log integration event
   */
  logIntegrationEvent(integration, eventType, payload = null, status = 'success', error = null) {
    const stmt = this.db.prepare(`
      INSERT INTO integration_logs (integration, event_type, payload, status, error)
      VALUES (?, ?, ?, ?, ?)
    `);

    stmt.run(
      integration,
      eventType,
      payload ? JSON.stringify(payload) : null,
      status,
      error
    );
  }

  /**
   * Get integration logs
   */
  getIntegrationLogs(integration = null, limit = 100) {
    let query = 'SELECT * FROM integration_logs';
    const params = [];

    if (integration) {
      query += ' WHERE integration = ?';
      params.push(integration);
    }

    query += ' ORDER BY timestamp DESC LIMIT ?';
    params.push(limit);

    const stmt = this.db.prepare(query);
    const logs = stmt.all(...params);

    return logs.map(log => {
      if (log.payload) {
        log.payload = JSON.parse(log.payload);
      }
      return log;
    });
  }

  // ═══════════════════════════════════════════════════════════════════════
  // UTILITY METHODS
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Backup database
   */
  backup(backupPath) {
    const backup = this.db.backup(backupPath);
    return backup;
  }

  /**
   * Close database connection
   */
  close() {
    if (this.db) {
      this.db.close();
      this.initialized = false;
    }
  }

  /**
   * Get database info
   */
  getDatabaseInfo() {
    const tables = this.db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
    ).all();

    return {
      path: this.dbPath,
      tables: tables.map(t => t.name),
      size: fs.statSync(this.dbPath).size
    };
  }
}

// Export singleton instance
let instance = null;

export function getDatabase(dbPath = null) {
  if (!instance) {
    instance = new TaskPersistence(dbPath);
  }
  return instance;
}

export default TaskPersistence;