#!/usr/bin/env node

import { EventEmitter } from 'events';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

// ═══════════════════════════════════════════════════════════════════════════
// FILE UPLOAD HANDLER - Multi-modal file processing
// ═══════════════════════════════════════════════════════════════════════════

export class FileUploadHandler extends EventEmitter {
  constructor(config = {}) {
    super();

    this.uploadDir = config.uploadDir || path.join(process.cwd(), 'uploads');
    this.maxFileSize = config.maxFileSize || 50 * 1024 * 1024; // 50MB
    this.maxFiles = config.maxFiles || 10;
    this.allowedTypes = config.allowedTypes || [
      // Images
      'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml',
      // Documents
      'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/plain', 'text/csv', 'text/markdown',
      // Audio
      'audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/mp4',
      // Video
      'video/mp4', 'video/webm', 'video/ogg',
      // Archives
      'application/zip', 'application/gzip', 'application/x-tar'
    ];
    this.allowedExtensions = config.allowedExtensions || [
      '.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg',
      '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.txt', '.csv', '.md',
      '.mp3', '.wav', '.ogg', '.m4a',
      '.mp4', '.webm', '.ogg',
      '.zip', '.gz', '.tar'
    ];

    this.files = new Map();
    this.stats = {
      totalUploads: 0,
      totalSize: 0,
      byType: {}
    };

    // Ensure upload directory exists
    this._ensureUploadDir();
  }

  /**
   * Ensure upload directory exists
   */
  _ensureUploadDir() {
    if (!fs.existsSync(this.uploadDir)) {
      fs.mkdirSync(this.uploadDir, { recursive: true });
    }
  }

  /**
   * Validate file
   */
  validateFile(file) {
    const errors = [];

    // Check file size
    if (file.size > this.maxFileSize) {
      errors.push(`File size exceeds maximum (${this.formatSize(this.maxFileSize)})`);
    }

    // Check MIME type
    if (this.allowedTypes.length > 0 && !this.allowedTypes.includes(file.mimetype)) {
      errors.push(`File type not allowed: ${file.mimetype}`);
    }

    // Check extension
    const ext = path.extname(file.originalname).toLowerCase();
    if (this.allowedExtensions.length > 0 && !this.allowedExtensions.includes(ext)) {
      errors.push(`Extension not allowed: ${ext}`);
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Process uploaded file
   */
  async processFile(file, options = {}) {
    const validation = this.validateFile(file);
    if (!validation.valid) {
      throw new Error(validation.errors.join(', '));
    }

    const fileId = `file_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    const ext = path.extname(file.originalname).toLowerCase();
    const filename = `${fileId}${ext}`;
    const filepath = path.join(this.uploadDir, filename);

    // Determine storage type
    let storagePath = filepath;
    let storageType = 'local';

    if (options.memory) {
      // Store in memory
      storageType = 'memory';
      storagePath = null;
    } else {
      // Move file to storage
      if (file.path) {
        fs.renameSync(file.path, filepath);
      } else if (file.buffer) {
        fs.writeFileSync(filepath, file.buffer);
      }
    }

    // Create file record
    const fileRecord = {
      id: fileId,
      originalName: file.originalname,
      filename,
      mimetype: file.mimetype,
      size: file.size,
      storageType,
      storagePath: storagePath || null,
      uploadedAt: Date.now(),
      uploadedBy: options.userId || 'anonymous',
      metadata: options.metadata || {},
      analysis: null
    };

    // Store in memory
    this.files.set(fileId, fileRecord);

    // Update stats
    this.stats.totalUploads++;
    this.stats.totalSize += file.size;
    this.stats.byType[file.mimetype] = (this.stats.byType[file.mimetype] || 0) + 1;

    // Emit event
    this.emit('uploaded', fileRecord);

    return fileRecord;
  }

  /**
   * Get file by ID
   */
  getFile(fileId) {
    return this.files.get(fileId);
  }

  /**
   * Get file content
   */
  async getFileContent(fileId) {
    const file = this.files.get(fileId);
    if (!file) {
      throw new Error('File not found');
    }

    if (file.storageType === 'memory') {
      return file.buffer;
    }

    if (file.storagePath && fs.existsSync(file.storagePath)) {
      return fs.readFileSync(file.storagePath);
    }

    throw new Error('File content not available');
  }

  /**
   * Delete file
   */
  async deleteFile(fileId) {
    const file = this.files.get(fileId);
    if (!file) {
      return false;
    }

    // Delete from storage
    if (file.storageType === 'local' && file.storagePath) {
      try {
        fs.unlinkSync(file.storagePath);
      } catch (error) {
        // Ignore if file doesn't exist
      }
    }

    // Remove from memory
    this.files.delete(fileId);

    this.emit('deleted', { fileId });

    return true;
  }

  /**
   * List files
   */
  listFiles(filters = {}) {
    let files = Array.from(this.files.values());

    if (filters.mimetype) {
      files = files.filter(f => f.mimetype === filters.mimetype);
    }
    if (filters.uploadedBy) {
      files = files.filter(f => f.uploadedBy === filters.uploadedBy);
    }
    if (filters.since) {
      files = files.filter(f => f.uploadedAt >= new Date(filters.since).getTime());
    }

    return files
      .sort((a, b) => b.uploadedAt - a.uploadedAt)
      .slice(0, filters.limit || 100);
  }

  /**
   * Format file size
   */
  formatSize(bytes) {
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let i = 0;
    while (bytes >= 1024 && i < units.length - 1) {
      bytes /= 1024;
      i++;
    }
    return `${bytes.toFixed(2)} ${units[i]}`;
  }

  /**
   * Get file type category
   */
  getFileCategory(mimetype) {
    if (mimetype.startsWith('image/')) return 'image';
    if (mimetype.startsWith('video/')) return 'video';
    if (mimetype.startsWith('audio/')) return 'audio';
    if (mimetype.includes('pdf')) return 'document';
    if (mimetype.includes('word') || mimetype.includes('document')) return 'document';
    if (mimetype.includes('excel') || mimetype.includes('spreadsheet')) return 'spreadsheet';
    if (mimetype.startsWith('text/')) return 'text';
    if (mimetype.includes('zip') || mimetype.includes('tar') || mimetype.includes('gzip')) return 'archive';
    return 'other';
  }

  /**
   * Express middleware for multipart upload
   */
  middleware(options = {}) {
    return async (req, res, next) => {
      // Check content type
      const contentType = req.headers['content-type'] || '';
      
      if (!contentType.includes('multipart/form-data')) {
        return next();
      }

      // Parse multipart manually (simplified)
      // In production, use multer or formidable
      try {
        const files = [];
        const body = {};

        // For a real implementation, use a proper multipart parser
        // This is a placeholder that assumes file data is already parsed
        if (req.files) {
          for (const file of Array.isArray(req.files) ? req.files : Object.values(req.files)) {
            const processed = await this.processFile(file, {
              userId: req.auth?.userId || 'anonymous',
              metadata: options.metadata
            });
            files.push(processed);
          }
        }

        req.uploadedFiles = files;
        req.uploadBody = body;
        next();
      } catch (error) {
        res.status(400).json({ error: error.message });
      }
    };
  }

  /**
   * Get stats
   */
  getStats() {
    return {
      ...this.stats,
      totalSizeFormatted: this.formatSize(this.stats.totalSize),
      filesCount: this.files.size
    };
  }

  /**
   * Clean up old files
   */
  async cleanup(maxAge = 86400000) {
    const now = Date.now();
    const toDelete = [];

    for (const [id, file] of this.files) {
      if (now - file.uploadedAt > maxAge) {
        toDelete.push(id);
      }
    }

    for (const id of toDelete) {
      await this.deleteFile(id);
    }

    return toDelete.length;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// FILE ANALYZER - Analyze uploaded files
// ═══════════════════════════════════════════════════════════════════════════

export class FileAnalyzer extends EventEmitter {
  constructor(config = {}) {
    super();

    this.analyzers = new Map();
    this._registerDefaultAnalyzers();
  }

  _registerDefaultAnalyzers() {
    // Image analyzer
    this.registerAnalyzer('image', async (file, content) => {
      return {
        category: 'image',
        size: content.length,
        format: file.mimetype.split('/')[1],
        metadata: {
          hasAlpha: file.mimetype === 'image/png' || file.mimetype === 'image/webp',
          isAnimated: file.mimetype === 'image/gif'
        }
      };
    });

    // Text analyzer
    this.registerAnalyzer('text', async (file, content) => {
      const text = content.toString('utf-8');
      const lines = text.split('\n');
      const words = text.split(/\s+/).filter(w => w.length > 0);
      
      return {
        category: 'text',
        size: content.length,
        encoding: 'utf-8',
        metadata: {
          lines: lines.length,
          words: words.length,
          characters: text.length,
          hasCode: /[{}\[\]();=]/.test(text.substring(0, 1000))
        }
      };
    });

    // Document analyzer
    this.registerAnalyzer('document', async (file, content) => {
      return {
        category: 'document',
        size: content.length,
        format: file.mimetype.includes('pdf') ? 'pdf' : 'office',
        metadata: {
          isEncrypted: false
        }
      };
    });
  }

  /**
   * Register a custom analyzer
   */
  registerAnalyzer(category, handler) {
    this.analyzers.set(category, handler);
  }

  /**
   * Analyze a file
   */
  async analyze(file, content) {
    const category = this._getCategory(file.mimetype);
    const analyzer = this.analyzers.get(category) || this.analyzers.get('default');

    if (!analyzer) {
      return {
        category: 'unknown',
        size: content.length,
        metadata: {}
      };
    }

    try {
      const result = await analyzer(file, content);
      this.emit('analyzed', { fileId: file.id, result });
      return result;
    } catch (error) {
      this.emit('error', { fileId: file.id, error: error.message });
      return {
        category,
        size: content.length,
        error: error.message,
        metadata: {}
      };
    }
  }

  _getCategory(mimetype) {
    if (mimetype.startsWith('image/')) return 'image';
    if (mimetype.startsWith('video/')) return 'video';
    if (mimetype.startsWith('audio/')) return 'audio';
    if (mimetype.startsWith('text/')) return 'text';
    if (mimetype.includes('pdf') || mimetype.includes('document') || mimetype.includes('word')) return 'document';
    return 'default';
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════════════════

export default {
  FileUploadHandler,
  FileAnalyzer
};
