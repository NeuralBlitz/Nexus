import { readFile as fsReadFile, writeFile as fsWriteFile, stat, readdir, mkdir, copyFile } from 'fs/promises';
import { join, resolve, relative, dirname, basename } from 'path';

const WORKSPACE_ROOT = resolve(process.env.WORKSPACE_ROOT || '/home/runner/workspace');
const MAX_READ_SIZE = 10 * 1024 * 1024; // 10 MB

/**
 * Ensure the given path is within the workspace root.
 * Throws if path attempts directory traversal.
 */
function safePath(userPath) {
  const resolved = resolve(WORKSPACE_ROOT, userPath);
  if (!resolved.startsWith(WORKSPACE_ROOT)) {
    throw new Error(`Path traversal detected: ${userPath}`);
  }
  return resolved;
}

/**
 * Read file content with size limits.
 * @param {string} path - Relative or absolute path within workspace.
 * @param {Object} options - Optional settings.
 * @param {number} options.maxSize - Override max size in bytes (default 10MB).
 * @param {string} options.encoding - Default 'utf8'.
 * @returns {Promise<string|Buffer>} File content.
 */
export async function readFile(path, options = {}) {
  const { maxSize = MAX_READ_SIZE, encoding = 'utf8' } = options;
  const filePath = safePath(path);
  
  const stats = await stat(filePath);
  if (stats.size > maxSize) {
    throw new Error(`File size ${stats.size} exceeds limit ${maxSize}`);
  }
  
  return fsReadFile(filePath, encoding);
}

/**
 * Write file content with backup option.
 * @param {string} path - Relative or absolute path within workspace.
 * @param {string|Buffer} content - Content to write.
 * @param {Object} options - Optional settings.
 * @param {boolean} options.backup - If true, create .bak backup of existing file.
 * @param {boolean} options.overwrite - If false, throw if file exists (default true).
 * @returns {Promise<void>}
 */
export async function writeFile(path, content, options = {}) {
  const { backup = false, overwrite = true } = options;
  const filePath = safePath(path);
  
  // Ensure parent directory exists
  await mkdir(dirname(filePath), { recursive: true });
  
  if (!overwrite) {
    try {
      await stat(filePath);
      throw new Error(`File already exists: ${path}`);
    } catch (err) {
      if (err.code !== 'ENOENT') throw err;
    }
  }
  
  if (backup) {
    try {
      await copyFile(filePath, `${filePath}.bak`);
    } catch (err) {
      if (err.code !== 'ENOENT') throw err;
      // No existing file to backup, that's fine
    }
  }
  
  await fsWriteFile(filePath, content);
}

/**
 * List directory contents.
 * @param {string} path - Relative or absolute path within workspace.
 * @param {Object} options - Optional settings.
 * @param {boolean} options.withFileTypes - If true, return Dirent objects.
 * @returns {Promise<string[]|Dirent[]>}
 */
export async function listDir(path, options = {}) {
  const { withFileTypes = false } = options;
  const dirPath = safePath(path);
  return readdir(dirPath, { withFileTypes });
}

/**
 * Search for files by glob pattern.
 * @param {string} pattern - Glob pattern relative to workspace root.
 * @param {Object} options - Optional settings.
 * @param {string} options.cwd - Override working directory (still restricted to workspace).
 * @returns {Promise<string[]>} Array of matching file paths relative to workspace root.
 */
export async function searchFiles(pattern, options = {}) {
  const { cwd = '.' } = options;
  const baseDir = safePath(cwd);
  
  // Use glob library (if not available, fallback to simple implementation)
  // Note: glob package is not installed; we implement a simple recursive search.
  // We'll implement a simple glob matcher for '*', '**', '?'.
  // For now, we'll use the glob module if available, else fallback.
  // Since glob is not in dependencies, we implement our own.
  return simpleGlob(pattern, baseDir);
}

/**
 * Simple glob implementation for '*', '**', '?' patterns.
 * @param {string} pattern
 * @param {string} baseDir
 * @returns {Promise<string[]>}
 */
async function simpleGlob(pattern, baseDir) {
  // Normalize pattern to relative from baseDir
  const normalized = pattern.replace(/\\/g, '/');
  const segments = normalized.split('/');
  const results = [];
  
  async function walk(currentDir, segmentIndex) {
    const segment = segments[segmentIndex];
    const isLast = segmentIndex === segments.length - 1;
    
    if (!segment) {
      // Empty segment (trailing slash)
      if (isLast) {
        results.push(relative(WORKSPACE_ROOT, currentDir));
      }
      return;
    }
    
    let entries;
    try {
      entries = await readdir(currentDir, { withFileTypes: true });
    } catch {
      return; // Directory cannot be read
    }
    
    // Convert segment to regex
    const regex = segmentToRegex(segment);
    
    for (const entry of entries) {
      if (regex.test(entry.name)) {
        const fullPath = join(currentDir, entry.name);
        const relativePath = relative(WORKSPACE_ROOT, fullPath);
        
        if (entry.isDirectory()) {
          if (segment === '**') {
            // '**' matches zero or more directories
            // Include the directory itself
            if (isLast) {
              results.push(relativePath);
            }
            // Continue walking into it
            await walk(fullPath, segmentIndex);
            // Also continue with next segment (if any) without consuming this segment
            if (!isLast) {
              await walk(fullPath, segmentIndex + 1);
            }
          } else {
            if (isLast) {
              results.push(relativePath);
            } else {
              await walk(fullPath, segmentIndex + 1);
            }
          }
        } else if (entry.isFile() || entry.isSymbolicLink()) {
          if (isLast) {
            results.push(relativePath);
          }
        }
      } else if (segment === '**') {
        // '**' can match zero directories, so try next segment
        if (!isLast) {
          await walk(currentDir, segmentIndex + 1);
        }
      }
    }
  }
  
  await walk(baseDir, 0);
  return results;
}

function segmentToRegex(segment) {
  // Escape regex special chars except *, ?, []
  const escaped = segment.replace(/[.+^${}()|[\]\\]/g, '\\$&');
  // Replace glob wildcards
  const withWildcards = escaped
    .replace(/\*\*/g, '§GLOBSTAR§')
    .replace(/\*/g, '[^/]*')
    .replace(/§GLOBSTAR§/g, '.*')
    .replace(/\?/g, '.');
  return new RegExp(`^${withWildcards}$`);
}

/**
 * Search file contents with grep-like functionality.
 * @param {string|RegExp} pattern - Pattern to search for.
 * @param {string} path - Directory to search within (relative or absolute).
 * @param {Object} options - Optional settings.
 * @param {boolean} options.caseSensitive - Default true.
 * @param {boolean} options.recursive - Default true.
 * @param {number} options.maxFiles - Maximum number of files to search (default 1000).
 * @returns {Promise<Array<{file: string, line: number, content: string}>>}
 */
export async function grepFiles(pattern, path, options = {}) {
  const { caseSensitive = true, recursive = true, maxFiles = 1000 } = options;
  const dirPath = safePath(path);
  
  const regex = typeof pattern === 'string' 
    ? new RegExp(pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), caseSensitive ? 'g' : 'gi')
    : pattern;
  
  const results = [];
  let fileCount = 0;
  
  async function searchDir(currentDir) {
    if (fileCount >= maxFiles) return;
    
    let entries;
    try {
      entries = await readdir(currentDir, { withFileTypes: true });
    } catch {
      return;
    }
    
    for (const entry of entries) {
      if (fileCount >= maxFiles) break;
      
      const fullPath = join(currentDir, entry.name);
      
      if (entry.isDirectory() && recursive) {
        await searchDir(fullPath);
      } else if (entry.isFile()) {
        fileCount++;
        try {
          const content = await readFile(fullPath, { encoding: 'utf8' });
          const lines = content.split('\n');
          lines.forEach((line, idx) => {
            if (regex.test(line)) {
              results.push({
                file: relative(WORKSPACE_ROOT, fullPath),
                line: idx + 1,
                content: line.trim()
              });
            }
          });
        } catch {
          // Skip files that cannot be read (binary, permissions, etc.)
        }
      }
    }
  }
  
  await searchDir(dirPath);
  return results;
}

// Export safePath for internal use if needed
export { safePath, WORKSPACE_ROOT };