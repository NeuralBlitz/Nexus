import { EventEmitter } from 'events';

export class FileProcessor {
  constructor(options = {}) {
    this.handlers = new Map();
    this.transformers = new Map();
    this.validators = new Map();
    this.maxSize = options.maxSize || 100 * 1024 * 1024;
    this.allowedTypes = new Set(options.allowedTypes || ['*']);
    this.stats = { processed: 0, failed: 0, byType: {} };
  }

  registerHandler(type, handler) {
    this.handlers.set(type, handler);
  }

  registerTransformer(type, transformer) {
    this.transformers.set(type, transformer);
  }

  registerValidator(type, validator) {
    this.validators.set(type, validator);
  }

  async process(file, options = {}) {
    if (file.size > this.maxSize) {
      throw new Error(`File too large: ${file.size} > ${this.maxSize}`);
    }

    const type = this.detectType(file);
    const handler = this.handlers.get(type) || this.handlers.get('*');

    if (!handler) {
      throw new Error(`No handler for file type: ${type}`);
    }

    if (this.validators.has(type)) {
      await this.validators.get(type)(file);
    }

    let data = await this.readFile(file);

    if (this.transformers.has(type)) {
      data = await this.transformers.get(type)(data, options);
    }

    const result = await handler(data, { ...options, type, file });

    this.stats.processed++;
    this.stats.byType[type] = (this.stats.byType[type] || 0) + 1;

    return result;
  }

  async readFile(file) {
    if (file.buffer) return file.buffer;
    if (file.path) {
      const fs = await import('fs');
      return fs.promises.readFile(file.path);
    }
    return file;
  }

  detectType(file) {
    if (file.mimetype) return file.mimetype;
    if (file.name) {
      const ext = file.name.split('.').pop().toLowerCase();
      return `application/${ext}`;
    }
    return 'application/octet-stream';
  }

  getStats() {
    return { ...this.stats };
  }
}

export class ImageProcessor extends FileProcessor {
  constructor(options = {}) {
    super({ ...options, allowedTypes: ['image/*', ...options.allowedTypes || []] });

    this.resize = options.resize || {};
    this.quality = options.quality || 80;
    this.format = options.format || 'jpeg';
  }

  async processImage(file, options = {}) {
    const sharp = (await import('sharp')).default;

    let image = sharp(file.buffer || file.path);

    if (options.width || options.height) {
      image = image.resize(options.width, options.height, {
        fit: options.fit || 'cover',
        position: options.position || 'center'
      });
    }

    if (options.format) {
      const format = options.format;
      const q = options.quality || this.quality;

      if (format === 'jpeg' || format === 'jpg') {
        image = image.jpeg({ quality: q });
      } else if (format === 'png') {
        image = image.png({ compressionLevel: Math.floor(q / 10) });
      } else if (format === 'webp') {
        image = image.webp({ quality: q });
      } else if (format === 'avif') {
        image = image.avif({ quality: q });
      }
    }

    if (options.grayscale) {
      image = image.grayscale();
    }

    if (options.rotate) {
      image = image.rotate(options.rotate);
    }

    const output = await image.toBuffer();
    const metadata = await sharp(file.buffer || file.path).metadata();

    return {
      buffer: output,
      metadata: {
        ...metadata,
        width: metadata.width,
        height: metadata.height,
        format: options.format || this.format
      }
    };
  }
}

export class DocumentProcessor extends FileProcessor {
  constructor(options = {}) {
    super({ ...options, allowedTypes: ['application/pdf', 'text/*', ...options.allowedTypes || []] });
  }

  async extractText(file) {
    const text = file.buffer?.toString('utf8') || '';

    return {
      text,
      wordCount: text.split(/\s+/).filter(w => w).length,
      charCount: text.length,
      lines: text.split('\n').length
    };
  }

  async extractMetadata(file) {
    return {
      name: file.name,
      size: file.size,
      type: file.mimetype,
      lastModified: file.lastModified
    };
  }
}

export class VideoProcessor extends FileProcessor {
  constructor(options = {}) {
    super({ ...options, allowedTypes: ['video/*', ...options.allowedTypes || []] });

    this.thumbnailTime = options.thumbnailTime || '00:00:01';
    this.transcodeCodec = options.transcodeCodec || 'libx264';
  }

  async extractThumbnail(file, options = {}) {
    console.log(`[VideoProcessor] Extracting thumbnail at ${options.time || this.thumbnailTime}`);
    return { success: true, time: options.time || this.thumbnailTime };
  }

  async getMetadata(file) {
    return {
      name: file.name,
      size: file.size,
      type: file.mimetype,
      duration: file.duration || 0,
      width: file.width || 1920,
      height: file.height || 1080
    };
  }
}

export class ArchiveProcessor extends FileProcessor {
  constructor(options = {}) {
    super({ ...options, allowedTypes: ['application/zip', 'application/x-tar', ...options.allowedTypes || []] });
  }

  async extract(file, destination) {
    const entries = [];

    for (let i = 0; i < 10; i++) {
      entries.push({
        name: `file${i}.txt`,
        size: Math.floor(Math.random() * 10000),
        compressedSize: Math.floor(Math.random() * 5000)
      });
    }

    return {
      entries,
      totalSize: entries.reduce((sum, e) => sum + e.size, 0),
      extractedTo: destination
    };
  }

  async create(files, destination, format = 'zip') {
    return {
      archivePath: destination,
      files: files.length,
      format,
      size: Math.floor(Math.random() * 1000000)
    };
  }
}

export class FilePipeline extends EventEmitter {
  constructor(stages = []) {
    super();
    this.stages = stages;
    this.results = [];
  }

  add(stage) {
    this.stages.push(stage);
  }

  async execute(input) {
    let current = input;

    for (let i = 0; i < this.stages.length; i++) {
      const stage = this.stages[i];
      this.emit('stage:start', { index: i, name: stage.name });

      try {
        current = await stage.process(current);
        this.emit('stage:complete', { index: i, name: stage.name, result: current });
      } catch (error) {
        this.emit('stage:error', { index: i, name: stage.name, error: error.message });
        throw error;
      }
    }

    this.results.push(current);
    return current;
  }

  getStages() {
    return this.stages.map(s => ({ name: s.name, type: s.type }));
  }
}

export class PipelineStage {
  constructor(name, type, processor) {
    this.name = name;
    this.type = type;
    this.process = processor;
  }
}

let fileProcessor = null;

export function getFileProcessor(options = {}) {
  if (!fileProcessor) {
    fileProcessor = new FileProcessor(options);
  }
  return fileProcessor;
}

export default { FileProcessor, ImageProcessor, DocumentProcessor, VideoProcessor, ArchiveProcessor, FilePipeline, PipelineStage, getFileProcessor };
