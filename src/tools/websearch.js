/**
 * Web Search Integration for NEXUS AI Platform
 * Provides web search, URL fetching, summarization, and link extraction
 */

const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const MAX_REQUESTS_PER_WINDOW = 30;

// Simple in-memory cache
const cache = new Map();

// Rate limiting state
const rateLimitState = {
  requests: [],
  blocked: false,
  blockedUntil: null,
};

/**
 * Check and enforce rate limiting
 * @throws {Error} If rate limit exceeded
 */
function checkRateLimit() {
  const now = Date.now();

  // Clean old requests
  rateLimitState.requests = rateLimitState.requests.filter(
    (time) => now - time < RATE_LIMIT_WINDOW
  );

  // Check if blocked
  if (rateLimitState.blocked && now < rateLimitState.blockedUntil) {
    const waitTime = Math.ceil((rateLimitState.blockedUntil - now) / 1000);
    throw new Error(`Rate limited. Try again in ${waitTime} seconds.`);
  }

  // Check limit
  if (rateLimitState.requests.length >= MAX_REQUESTS_PER_WINDOW) {
    rateLimitState.blocked = true;
    rateLimitState.blockedUntil = now + RATE_LIMIT_WINDOW;
    throw new Error(
      `Rate limit exceeded. Maximum ${MAX_REQUESTS_PER_WINDOW} requests per minute.`
    );
  }

  // Record request
  rateLimitState.requests.push(now);
}

/**
 * Generate cache key from query and options
 */
function getCacheKey(type, params) {
  return `${type}:${JSON.stringify(params)}`;
}

/**
 * Get cached result if available and not expired
 */
function getFromCache(key) {
  const entry = cache.get(key);
  if (entry && Date.now() - entry.timestamp < CACHE_TTL) {
    return entry.data;
  }
  cache.delete(key);
  return null;
}

/**
 * Store result in cache
 */
function setCache(key, data) {
  cache.set(key, { data, timestamp: Date.now() });

  // Cleanup old entries periodically
  if (cache.size > 1000) {
    const now = Date.now();
    for (const [k, v] of cache.entries()) {
      if (now - v.timestamp > CACHE_TTL) {
        cache.delete(k);
      }
    }
  }
}

/**
 * Clean HTML content to extract main text
 * @param {string} html - Raw HTML content
 * @returns {string} Cleaned text content
 */
function extractTextContent(html) {
  if (!html) return '';

  let text = html;

  // Remove script and style tags
  text = text.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '');
  text = text.replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '');
  text = text.replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript>/gi, '');

  // Remove navigation, header, footer, aside elements
  text = text.replace(/<nav\b[^>]*>[\s\S]*?<\/nav>/gi, '');
  text = text.replace(/<header\b[^>]*>[\s\S]*?<\/header>/gi, '');
  text = text.replace(/<footer\b[^>]*>[\s\S]*?<\/footer>/gi, '');
  text = text.replace(/<aside\b[^>]*>[\s\S]*?<\/aside>/gi, '');

  // Remove ads-related elements
  text = text.replace(/<div[^>]*class="[^"]*ad[^"]*"[^>]*>[\s\S]*?<\/div>/gi, '');
  text = text.replace(/<div[^>]*id="[^"]*ad[^"]*"[^>]*>[\s\S]*?<\/div>/gi, '');

  // Convert to plain text
  text = text.replace(/<br\s*\/?>/gi, '\n');
  text = text.replace(/<p[^>]*>/gi, '\n');
  text = text.replace(/<h[1-6][^>]*>/gi, '\n\n');
  text = text.replace(/<li[^>]*>/gi, '\n- ');
  text = text.replace(/<[^>]+>/g, '');

  // Decode HTML entities
  text = text.replace(/&nbsp;/g, ' ');
  text = text.replace(/&amp;/g, '&');
  text = text.replace(/&lt;/g, '<');
  text = text.replace(/&gt;/g, '>');
  text = text.replace(/&quot;/g, '"');
  text = text.replace(/&#39;/g, "'");
  text = text.replace(/&#[0-9]+;/g, '');

  // Clean up whitespace
  text = text.replace(/\n{3,}/g, '\n\n');
  text = text.replace(/[ \t]+/g, ' ');
  text = text.trim();

  return text;
}

/**
 * Extract links from HTML content
 * @param {string} html - Raw HTML content
 * @param {string} baseUrl - Base URL for resolving relative links
 * @returns {Array<{url: string, text: string, rel: string}>} Extracted links
 */
function extractLinksFromHtml(html, baseUrl) {
  const links = [];
  const linkRegex = /<a\s+[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  const baseUrlObj = new URL(baseUrl);

  let match;
  while ((match = linkRegex.exec(html)) !== null) {
    let href = match[1];
    const text = match[2].replace(/<[^>]+>/g, '').trim();

    // Skip empty or javascript: links
    if (!href || href.startsWith('javascript:') || href === '#') {
      continue;
    }

    // Resolve relative URLs
    try {
      const resolvedUrl = new URL(href, baseUrl).href;
      
      // Get rel attribute for filtering
      const relMatch = match[0].match(/rel=["']([^"']+)["']/i);
      const rel = relMatch ? relMatch[1] : '';

      links.push({
        url: resolvedUrl,
        text: text || resolvedUrl,
        rel,
        isExternal: new URL(resolvedUrl).hostname !== baseUrlObj.hostname,
      });
    } catch {
      // Skip invalid URLs
    }
  }

  // Remove duplicates
  const seen = new Set();
  return links.filter((link) => {
    if (seen.has(link.url)) return false;
    seen.add(link.url);
    return true;
  });
}

/**
 * Apply safe search filtering to results
 * @param {Array} results - Search results
 * @param {boolean} safeSearch - Enable safe search
 * @returns {Array} Filtered results
 */
function applySafeSearch(results, safeSearch = true) {
  if (!safeSearch) return results;

  const unsafePatterns = [
    /\b(xxx|porn|sex|nude|naked)\b/i,
    /\b(gore|violence|kill|murder)\b/i,
    /\b(drugs|cocaine|heroin)\b/i,
    /\b(gambling|casino)\b/i,
  ];

  return results.filter((result) => {
    const text = `${result.title} ${result.snippet} ${result.url}`.toLowerCase();
    return !unsafePatterns.some((pattern) => pattern.test(text));
  });
}

/**
 * Search the web using available search tools
 * @param {string} query - Search query
 * @param {Object} options - Search options
 * @param {number} options.limit - Maximum number of results (default: 10)
 * @param {string} options.language - Search language (default: 'en')
 * @param {boolean} options.safeSearch - Enable safe search (default: true)
 * @param {string} options.type - Result type ('auto', 'web', 'news')
 * @returns {Promise<Array<{title: string, url: string, snippet: string, score: number}>>}
 */
export async function search(query, options = {}) {
  const {
    limit = 10,
    language = 'en',
    safeSearch = true,
    type = 'auto',
  } = options;

  if (!query || typeof query !== 'string' || query.trim().length === 0) {
    throw new Error('Search query is required and must be a non-empty string');
  }

  const cacheKey = getCacheKey('search', { query, limit, language, safeSearch, type });
  const cached = getFromCache(cacheKey);
  if (cached) {
    return cached;
  }

  checkRateLimit();

  try {
    // Use websearch tool via global scope if available
    // In NEXUS platform, this would call the websearch tool
    // For now, we'll simulate the API structure
    const searchResults = await performWebSearch(query, {
      limit,
      language,
      safeSearch,
      type,
    });

    // Apply safe search filter
    const filteredResults = applySafeSearch(searchResults, safeSearch);

    // Limit results
    const limitedResults = filteredResults.slice(0, limit);

    setCache(cacheKey, limitedResults);
    return limitedResults;
  } catch (error) {
    throw new Error(`Search failed: ${error.message}`);
  }
}

/**
 * Internal web search implementation
 * Falls back to simple mock if tools unavailable
 */
async function performWebSearch(query, options) {
  // In the NEXUS platform, this would use the websearch tool
  // The websearch tool is available globally in the runtime
  
  if (typeof globalThis.websearch !== 'undefined') {
    const result = await globalThis.websearch({
      query,
      numResults: options.limit,
      type: options.type === 'auto' ? 'auto' : options.type,
    });

    // Transform to standard format
    return (result.results || []).map((item, index) => ({
      title: item.title || '',
      url: item.url || item.link || '',
      snippet: item.snippet || item.text || '',
      score: item.score || 1 - index * 0.05,
      publishedDate: item.publishedDate || null,
    }));
  }

  // Fallback: Return empty results with helpful message
  // In production, this would integrate with a real search API
  return [];
}

/**
 * Fetch and extract content from a URL
 * @param {string} url - URL to fetch
 * @param {Object} options - Fetch options
 * @param {number} options.timeout - Request timeout in ms (default: 30000)
 * @param {boolean} options.extractText - Extract clean text (default: true)
 * @param {string} options.format - Response format ('text', 'html', 'markdown')
 * @returns {Promise<{url: string, title: string, content: string, metadata: Object}>}
 */
export async function fetchUrl(url, options = {}) {
  const {
    timeout = 30000,
    extractText = true,
    format = 'markdown',
  } = options;

  if (!url || typeof url !== 'string') {
    throw new Error('URL is required and must be a string');
  }

  // Validate URL
  try {
    new URL(url);
  } catch {
    throw new Error(`Invalid URL: ${url}`);
  }

  const cacheKey = getCacheKey('fetch', { url, format });
  const cached = getFromCache(cacheKey);
  if (cached) {
    return cached;
  }

  checkRateLimit();

  try {
    let content;
    let title = '';
    let metadata = {};

    // Use webfetch tool if available
    if (typeof globalThis.webfetch !== 'undefined') {
      const result = await globalThis.webfetch({
        url,
        format: format === 'markdown' ? 'markdown' : 'text',
        timeout,
      });

      content = result.content || result.text || '';
      title = result.title || extractTitle(content);
    } else {
      // Fallback to fetch API
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          'User-Agent':
            'Mozilla/5.0 (compatible; NEXUS-AI/1.0; +https://nexus.ai)',
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        },
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      content = await response.text();
      title = extractTitle(content);
    }

    // Extract text content if requested
    let processedContent = content;
    if (extractText && format !== 'html') {
      processedContent = extractTextContent(content);

      // Limit content size
      if (processedContent.length > 50000) {
        processedContent = processedContent.substring(0, 50000) + '... [truncated]';
      }
    }

    const result = {
      url,
      title,
      content: processedContent,
      contentLength: content.length,
      metadata: {
        ...metadata,
        fetchedAt: new Date().toISOString(),
        format,
      },
    };

    setCache(cacheKey, result);
    return result;
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new Error(`Request timeout after ${timeout}ms`);
    }
    throw new Error(`Failed to fetch URL: ${error.message}`);
  }
}

/**
 * Extract title from HTML content
 */
function extractTitle(html) {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return match ? match[1].trim() : '';
}

/**
 * Get summary of a webpage
 * @param {string} url - URL to summarize
 * @param {Object} options - Summarization options
 * @param {number} options.maxLength - Maximum summary length (default: 500)
 * @returns {Promise<{url: string, title: string, summary: string}>}
 */
export async function summarize(url, options = {}) {
  const { maxLength = 500 } = options;

  if (!url || typeof url !== 'string') {
    throw new Error('URL is required and must be a string');
  }

  const cacheKey = getCacheKey('summarize', { url, maxLength });
  const cached = getFromCache(cacheKey);
  if (cached) {
    return cached;
  }

  // Fetch the page content
  const pageContent = await fetchUrl(url, {
    extractText: true,
    format: 'text',
  });

  // Generate summary using AI if available
  let summary;

  if (typeof globalThis.aiSummarize !== 'undefined') {
    // Use AI summarization if available
    summary = await globalThis.aiSummarize({
      text: pageContent.content,
      maxLength,
    });
  } else {
    // Fallback: Extract key sentences
    summary = extractKeySentences(pageContent.content, maxLength);
  }

  const result = {
    url,
    title: pageContent.title,
    summary,
    wordCount: pageContent.content.split(/\s+/).length,
  };

  setCache(cacheKey, result);
  return result;
}

/**
 * Extract key sentences from text (simple extractive summarization)
 */
function extractKeySentences(text, maxLength) {
  // Split into sentences
  const sentences = text
    .replace(/([.!?])\s+/g, '$1\n')
    .split('\n')
    .map((s) => s.trim())
    .filter((s) => s.length > 20 && s.length < 500);

  if (sentences.length === 0) {
    return text.substring(0, maxLength) + (text.length > maxLength ? '...' : '');
  }

  // Score sentences based on position and length
  const scored = sentences.map((sentence, index) => {
    const positionScore = 1 / (index + 1);
    const lengthScore = Math.min(sentence.length / 100, 1);
    return {
      sentence,
      score: positionScore + lengthScore,
    };
  });

  // Sort by score and take top sentences
  scored.sort((a, b) => b.score - a.score);
  const topSentences = scored.slice(0, Math.ceil(maxLength / 100));

  // Build summary
  let summary = topSentences.map((s) => s.sentence).join(' ');

  // Truncate if needed
  if (summary.length > maxLength) {
    summary = summary.substring(0, maxLength).replace(/\s+\S*$/, '') + '...';
  }

  return summary;
}

/**
 * Extract all links from a webpage
 * @param {string} url - URL to extract links from
 * @param {Object} options - Extraction options
 * @param {boolean} options.externalOnly - Only return external links (default: false)
 * @param {boolean} options.includeAnchors - Include anchor links (default: false)
 * @param {string} options.filter - Filter by URL pattern (regex string)
 * @returns {Promise<Array<{url: string, text: string, isExternal: boolean}>>}
 */
export async function extractLinks(url, options = {}) {
  const {
    externalOnly = false,
    includeAnchors = false,
    filter = null,
  } = options;

  if (!url || typeof url !== 'string') {
    throw new Error('URL is required and must be a string');
  }

  const cacheKey = getCacheKey('links', { url, externalOnly, includeAnchors, filter });
  const cached = getFromCache(cacheKey);
  if (cached) {
    return cached;
  }

  // Fetch the page content
  const pageContent = await fetchUrl(url, {
    extractText: false,
    format: 'html',
  });

  // Extract links from HTML
  let links = extractLinksFromHtml(pageContent.content, url);

  // Filter by external only
  if (externalOnly) {
    links = links.filter((link) => link.isExternal);
  }

  // Filter anchor links
  if (!includeAnchors) {
    links = links.filter(
      (link) => !link.url.includes('#') || link.url.split('#')[0] !== url.split('#')[0]
    );
  }

  // Apply URL filter
  if (filter) {
    try {
      const pattern = new RegExp(filter, 'i');
      links = links.filter((link) => pattern.test(link.url));
    } catch {
      // Invalid regex, skip filter
    }
  }

  setCache(cacheKey, links);
  return links;
}

/**
 * Clear the cache
 * @param {string} type - Optional type to clear ('search', 'fetch', 'summarize', 'links', or 'all')
 */
export function clearCache(type = 'all') {
  if (type === 'all') {
    cache.clear();
    return;
  }

  for (const key of cache.keys()) {
    if (key.startsWith(`${type}:`)) {
      cache.delete(key);
    }
  }
}

/**
 * Get cache statistics
 * @returns {{size: number, entries: Array<{key: string, age: number}>}}
 */
export function getCacheStats() {
  const now = Date.now();
  const entries = [];

  for (const [key, value] of cache.entries()) {
    entries.push({
      key,
      age: Math.floor((now - value.timestamp) / 1000),
      ttl: Math.floor((CACHE_TTL - (now - value.timestamp)) / 1000),
    });
  }

  return {
    size: cache.size,
    entries,
  };
}

/**
 * Reset rate limiting state
 */
export function resetRateLimit() {
  rateLimitState.requests = [];
  rateLimitState.blocked = false;
  rateLimitState.blockedUntil = null;
}

// Export all functions as default object for convenience
export default {
  search,
  fetchUrl,
  summarize,
  extractLinks,
  clearCache,
  getCacheStats,
  resetRateLimit,
};
