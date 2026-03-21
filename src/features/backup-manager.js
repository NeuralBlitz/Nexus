import { EventEmitter } from 'events';
import crypto from 'crypto';

export class BackupConfig {
  constructor(options = {}) {
    this.backupDir = options.backupDir || './backups';
    this.maxBackups = options.maxBackups || 10;
    this.compression = options.compression !== false;
    this.encryption = options.encryption;
    this.retentionDays = options.retentionDays || 30;
  }
}

export class BackupEntry {
  constructor(id, metadata = {}) {
    this.id = id;
    this.timestamp = Date.now();
    this.size = metadata.size || 0;
    this.type = metadata.type || 'full';
    this.checksum = metadata.checksum;
    this.source = metadata.source;
    this.status = 'pending';
  }
}

export class BackupManager extends EventEmitter {
  constructor(options = {}) {
    super();

    this.config = new BackupConfig(options);
    this.backups = new Map();
    this.sources = new Map();
    this.stats = {
      totalBackups: 0,
      successfulBackups: 0,
      failedBackups: 0,
      totalRestores: 0,
      lastBackup: null,
      lastRestore: null
    };
  }

  registerSource(name, source) {
    this.sources.set(name, source);
    this.emit('source:registered', { name });
  }

  async createBackup(options = {}) {
    const backupId = `backup_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    const entry = new BackupEntry(backupId, {
      type: options.type || 'full',
      source: options.source
    });

    this.backups.set(backupId, entry);
    this.stats.totalBackups++;

    try {
      const data = await this.gatherData(options.source);

      if (this.config.encryption) {
        data.content = this.encrypt(data.content, this.config.encryption);
        entry.encrypted = true;
      }

      entry.size = data.content.length;
      entry.checksum = this.calculateChecksum(data.content);
      entry.data = data;

      entry.status = 'completed';
      this.stats.successfulBackups++;
      this.stats.lastBackup = Date.now();

      this.pruneOldBackups();
      this.emit('backup:completed', entry);
    } catch (error) {
      entry.status = 'failed';
      entry.error = error.message;
      this.stats.failedBackups++;
      this.emit('backup:failed', { backupId, error: error.message });
    }

    return entry;
  }

  async gatherData(sourceName) {
    const content = {};
    const sources = sourceName ? [this.sources.get(sourceName)] : Array.from(this.sources.values());

    for (const source of sources) {
      if (source) {
        content[source.name] = await source.getData();
      }
    }

    return {
      timestamp: Date.now(),
      version: '1.0',
      content
    };
  }

  encrypt(data, key) {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(key, 'hex'), iv);
    let encrypted = cipher.update(data, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return { iv: iv.toString('hex'), data: encrypted };
  }

  decrypt(backup, key) {
    if (!backup.encrypted) return backup;

    const decipher = crypto.createDecipheriv(
      'aes-256-cbc',
      Buffer.from(key, 'hex'),
      Buffer.from(backup.iv, 'hex')
    );
    let decrypted = decipher.update(backup.data, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    backup.data = JSON.parse(decrypted);

    return backup;
  }

  calculateChecksum(data) {
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  verifyChecksum(entry) {
    const current = this.calculateChecksum(entry.data);
    return current === entry.checksum;
  }

  async restore(backupId, options = {}) {
    const entry = this.backups.get(backupId);
    if (!entry) {
      throw new Error(`Backup not found: ${backupId}`);
    }

    if (entry.status !== 'completed') {
      throw new Error(`Backup not completed: ${entry.status}`);
    }

    try {
      let data = entry.data;

      if (entry.encrypted) {
        if (!options.decryptionKey) {
          throw new Error('Decryption key required');
        }
        data = this.decrypt(entry, options.decryptionKey).data;
      }

      for (const [name, sourceData] of Object.entries(data.content)) {
        const source = this.sources.get(name);
        if (source) {
          await source.setData(sourceData);
        }
      }

      this.stats.totalRestores++;
      this.stats.lastRestore = Date.now();
      this.emit('restore:completed', { backupId });

      return { success: true };
    } catch (error) {
      this.emit('restore:failed', { backupId, error: error.message });
      throw error;
    }
  }

  listBackups(filters = {}) {
    let results = Array.from(this.backups.values());

    if (filters.type) {
      results = results.filter(b => b.type === filters.type);
    }
    if (filters.status) {
      results = results.filter(b => b.status === filters.status);
    }
    if (filters.source) {
      results = results.filter(b => b.source === filters.source);
    }

    return results
      .sort((a, b) => b.timestamp - a.timestamp)
      .map(b => ({
        id: b.id,
        timestamp: b.timestamp,
        size: b.size,
        type: b.type,
        checksum: b.checksum,
        status: b.status,
        source: b.source
      }));
  }

  getBackup(backupId) {
    return this.backups.get(backupId);
  }

  deleteBackup(backupId) {
    const deleted = this.backups.delete(backupId);
    if (deleted) {
      this.emit('backup:deleted', { backupId });
    }
    return deleted;
  }

  pruneOldBackups() {
    const cutoff = Date.now() - (this.config.retentionDays * 24 * 60 * 60 * 1000);
    const toDelete = [];

    for (const [id, backup] of this.backups) {
      if (backup.timestamp < cutoff) {
        toDelete.push(id);
      }
    }

    const sorted = Array.from(this.backups.values())
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(this.config.maxBackups);

    for (const backup of sorted) {
      toDelete.push(backup.id);
    }

    for (const id of toDelete) {
      this.backups.delete(id);
    }

    return toDelete.length;
  }

  getStats() {
    return {
      ...this.stats,
      totalBackupsStored: this.backups.size,
      maxBackups: this.config.maxBackups,
      retentionDays: this.config.retentionDays
    };
  }
}

export class DataSource {
  constructor(name, options = {}) {
    this.name = name;
    this.getData = options.getData || (() => ({}));
    this.setData = options.setData || (() => {});
  }
}

let backupManager = null;

export function getBackupManager(options = {}) {
  if (!backupManager) {
    backupManager = new BackupManager(options);
  }
  return backupManager;
}

export default { BackupManager, BackupEntry, BackupConfig, DataSource, getBackupManager };
