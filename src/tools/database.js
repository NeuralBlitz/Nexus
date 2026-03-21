#!/usr/bin/env node

import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

// ═══════════════════════════════════════════════════════════════════════════
// DATABASE INTEGRATION TOOL
// ═══════════════════════════════════════════════════════════════════════════

const SAFE_OPERATIONS = ['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'CREATE', 'CREATE TABLE',
  'DROP TABLE', 'ALTER TABLE', 'CREATE INDEX', 'PRAGMA', 'EXPLAIN'];

const DANGEROUS_PATTERNS = [
  /DROP\s+DATABASE/i,
  /DROP\s+SCHEMA/i,
  /TRUNCATE/i,
  /ALTER\s+.*ADD\s+CONSTRAINT/i,
  /GRANT\s+/i,
  /REVOKE\s+/i
];

class DatabaseTool {
  constructor(options = {}) {
    this.connections = new Map();
    this.defaultDb = options.defaultDb || ':memory:';
    this.verbose = options.verbose || false;
  }

  /**
   * Open a database connection
   */
  async connect(name = 'default', dbPath = this.defaultDb) {
    if (this.connections.has(name)) {
      return { success: true, name, message: 'Connection already exists' };
    }

    try {
      // Create directory if needed for file-based databases
      if (dbPath !== ':memory:' && dbPath.includes('/')) {
        const dir = path.dirname(dbPath);
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }
      }

      const db = new Database(dbPath);
      db.pragma('journal_mode = WAL');
      db.pragma('foreign_keys = ON');

      this.connections.set(name, db);

      if (this.verbose) {
        console.log(`[DB] Connected to ${dbPath} as "${name}"`);
      }

      return { success: true, name, path: dbPath };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Close a database connection
   */
  async disconnect(name = 'default') {
    const db = this.connections.get(name);
    if (!db) {
      return { success: false, error: 'Connection not found' };
    }

    try {
      db.close();
      this.connections.delete(name);
      return { success: true, name };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Get connection by name
   */
  getConnection(name = 'default') {
    const db = this.connections.get(name);
    if (!db) {
      throw new Error(`Database connection "${name}" not found`);
    }
    return db;
  }

  /**
   * Validate SQL query for safety
   */
  validateQuery(sql) {
    const trimmed = sql.trim();

    // Check for dangerous patterns
    for (const pattern of DANGEROUS_PATTERNS) {
      if (pattern.test(trimmed)) {
        return { valid: false, reason: 'Dangerous operation detected' };
      }
    }

    // Check if operation is whitelisted
    const operation = trimmed.split(/\s+/)[0].toUpperCase();
    if (!SAFE_OPERATIONS.includes(operation)) {
      return { valid: false, reason: `Operation "${operation}" not allowed` };
    }

    return { valid: true };
  }

  /**
   * Execute a query
   */
  async query(sql, params = [], options = {}) {
    const { conn = 'default', returnAll = true } = options;

    const validation = this.validateQuery(sql);
    if (!validation.valid) {
      throw new Error(`Invalid query: ${validation.reason}`);
    }

    const db = this.getConnection(conn);

    try {
      const startTime = Date.now();
      const stmt = db.prepare(sql);

      let result;
      if (sql.trim().toUpperCase().startsWith('SELECT') || sql.trim().toUpperCase().startsWith('EXPLAIN')) {
        result = returnAll ? stmt.all(params) : stmt.get(params);
      } else {
        const info = stmt.run(params);
        result = {
          changes: info.changes,
          lastInsertRowid: info.lastInsertRowid
        };
      }

      const duration = Date.now() - startTime;

      if (this.verbose) {
        console.log(`[DB] Query executed in ${duration}ms`);
      }

      return { success: true, result, duration };
    } catch (error) {
      return { success: false, error: error.message, sql };
    }
  }

  /**
   * Execute multiple queries in a transaction
   */
  async transaction(queries, options = {}) {
    const { conn = 'default' } = options;
    const db = this.getConnection(conn);

    const results = [];

    try {
      const result = db.transaction(() => {
        for (const { sql, params = [] } of queries) {
          const validation = this.validateQuery(sql);
          if (!validation.valid) {
            throw new Error(`Invalid query: ${validation.reason}`);
          }

          const stmt = db.prepare(sql);
          const info = stmt.run(params);
          results.push({
            changes: info.changes,
            lastInsertRowid: info.lastInsertRowid
          });
        }
      })();

      return { success: true, results };
    } catch (error) {
      return { success: false, error: error.message, results };
    }
  }

  /**
   * Create a table
   */
  async createTable(tableName, schema, options = {}) {
    const { conn = 'default', ifNotExists = true } = options;

    const condition = ifNotExists ? 'IF NOT EXISTS' : '';
    const sql = `CREATE TABLE ${condition} ${tableName} (${schema})`;

    return this.query(sql, [], { conn });
  }

  /**
   * Drop a table
   */
  async dropTable(tableName, options = {}) {
    const { conn = 'default', ifExists = true } = options;

    const condition = ifExists ? 'IF EXISTS' : '';
    const sql = `DROP TABLE ${condition} ${tableName}`;

    return this.query(sql, [], { conn });
  }

  /**
   * List all tables
   */
  async listTables(conn = 'default') {
    const sql = `SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name`;

    const result = await this.query(sql, [], { conn });
    return result.success ? result.result.map(row => row.name) : [];
  }

  /**
   * Get table schema
   */
  async getTableSchema(tableName, conn = 'default') {
    const sql = `PRAGMA table_info(${tableName})`;
    const result = await this.query(sql, [], { conn });
    return result.success ? result.result : null;
  }

  /**
   * Get table row count
   */
  async getRowCount(tableName, conn = 'default') {
    const sql = `SELECT COUNT(*) as count FROM ${tableName}`;
    const result = await this.query(sql, [], { conn });
    return result.success ? result.result[0].count : 0;
  }

  /**
   * Insert a row
   */
  async insert(tableName, data, options = {}) {
    const { conn = 'default', orIgnore = false } = options;

    const keys = Object.keys(data);
    const placeholders = keys.map(() => '?').join(', ');
    const values = Object.values(data);

    const orClause = orIgnore ? 'OR IGNORE' : '';
    const sql = `INSERT ${orClause} INTO ${tableName} (${keys.join(', ')}) VALUES (${placeholders})`;

    return this.query(sql, values, { conn });
  }

  /**
   * Insert multiple rows
   */
  async insertBatch(tableName, rows, options = {}) {
    const { conn = 'default' } = options;

    if (!rows.length) {
      return { success: false, error: 'No rows to insert' };
    }

    const keys = Object.keys(rows[0]);
    const placeholders = keys.map(() => '?').join(', ');
    const sql = `INSERT INTO ${tableName} (${keys.join(', ')}) VALUES (${placeholders})`;

    const queries = rows.map(row => ({
      sql,
      params: keys.map(key => row[key])
    }));

    return this.transaction(queries, { conn });
  }

  /**
   * Select rows
   */
  async select(tableName, options = {}) {
    const { conn = 'default', where, params = [], columns = '*', orderBy, limit, offset } = options;

    let sql = `SELECT ${columns} FROM ${tableName}`;

    if (where) {
      sql += ` WHERE ${where}`;
    }
    if (orderBy) {
      sql += ` ORDER BY ${orderBy}`;
    }
    if (limit) {
      sql += ` LIMIT ${limit}`;
    }
    if (offset) {
      sql += ` OFFSET ${offset}`;
    }

    const result = await this.query(sql, params, { conn });
    return result.success ? result.result : [];
  }

  /**
   * Update rows
   */
  async update(tableName, data, where, params = [], conn = 'default') {
    const setClauses = Object.keys(data).map(key => `${key} = ?`).join(', ');
    const values = [...Object.values(data), ...params];

    const sql = `UPDATE ${tableName} SET ${setClauses} WHERE ${where}`;
    return this.query(sql, values, { conn });
  }

  /**
   * Delete rows
   */
  async delete(tableName, where, params = [], conn = 'default') {
    const sql = `DELETE FROM ${tableName} WHERE ${where}`;
    return this.query(sql, params, { conn });
  }

  /**
   * Search table
   */
  async search(tableName, searchTerm, columns, options = {}) {
    const { conn = 'default', limit = 100 } = options;

    const likeClauses = columns.map(col => `${col} LIKE ?`).join(' OR ');
    const params = columns.map(() => `%${searchTerm}%`);

    const sql = `SELECT * FROM ${tableName} WHERE ${likeClauses} LIMIT ${limit}`;
    const result = await this.query(sql, params, { conn });

    return result.success ? result.result : [];
  }

  /**
   * Get database size
   */
  async getDatabaseSize(conn = 'default') {
    const sql = `SELECT page_count * page_size as size FROM pragma_page_count(), pragma_page_size()`;
    const result = await this.query(sql, [], { conn });

    if (result.success && result.result.length > 0) {
      const bytes = result.result[0].size;
      return {
        bytes,
        kb: Math.round(bytes / 1024),
        mb: Math.round(bytes / 1024 / 1024 * 100) / 100
      };
    }
    return null;
  }

  /**
   * Close all connections
   */
  async closeAll() {
    for (const [name, db] of this.connections) {
      try {
        db.close();
        if (this.verbose) {
          console.log(`[DB] Closed connection "${name}"`);
        }
      } catch (error) {
        console.error(`[DB] Error closing "${name}":`, error.message);
      }
    }
    this.connections.clear();
    return { success: true, closed: this.connections.size };
  }
}

// Export a default instance
export const database = new DatabaseTool();
export default DatabaseTool;