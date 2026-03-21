export const manifest = {
  name: 'markdown-plugin',
  id: 'markdown-plugin',
  version: '1.0.0',
  description: 'Markdown parsing and rendering',
  author: 'NEXUS',
  main: 'index.js',
  permissions: []
};

let api;

export async function init(context) {
  api = context;
  api.log('Markdown plugin initialized');
}

export async function activate(context) {
  api.log('Markdown plugin activated');
}

export function deactivate() {
  api.log('Markdown plugin deactivated');
}

export const hooks = {
  'document:render': async (content, context) => {
    if (context.format === 'markdown') {
      return renderMarkdown(content);
    }
  }
};

function renderMarkdown(text) {
  let html = text;

  html = html.replace(/^### (.*$)/gm, '<h3>$1</h3>');
  html = html.replace(/^## (.*$)/gm, '<h2>$1</h2>');
  html = html.replace(/^# (.*$)/gm, '<h1>$1</h1>');

  html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');
  html = html.replace(/`(.*?)`/g, '<code>$1</code>');
  html = html.replace(/~~(.*?)~~/g, '<del>$1</del>');

  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');

  html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1">');

  html = html.replace(/^\* (.*$)/gm, '<li>$1</li>');
  html = html.replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>');

  html = html.replace(/^> (.*$)/gm, '<blockquote>$1</blockquote>');

  html = html.replace(/```(\w+)?\n([\s\S]*?)```/g, '<pre><code class="$1">$2</code></pre>');

  html = html.replace(/\n/g, '<br>');

  return html;
}

export const functions = {
  render: (markdown) => renderMarkdown(markdown),
  
  parse: (html) => {
    let markdown = html;
    markdown = markdown.replace(/<h1>(.*?)<\/h1>/g, '# $1');
    markdown = markdown.replace(/<h2>(.*?)<\/h2>/g, '## $1');
    markdown = markdown.replace(/<h3>(.*?)<\/h3>/g, '### $1');
    markdown = markdown.replace(/<strong>(.*?)<\/strong>/g, '**$1**');
    markdown = markdown.replace(/<em>(.*?)<\/em>/g, '*$1*');
    markdown = markdown.replace(/<code>(.*?)<\/code>/g, '`$1`');
    markdown = markdown.replace(/<a href="([^"]+)">(.*?)<\/a>/g, '[$2]($1)');
    return markdown;
  },

  extractHeadings: (markdown) => {
    const headings = [];
    const regex = /^(#{1,6})\s+(.+)$/gm;
    let match;
    while ((match = regex.exec(markdown)) !== null) {
      headings.push({
        level: match[1].length,
        text: match[2]
      });
    }
    return headings;
  },

  extractLinks: (markdown) => {
    const links = [];
    const regex = /\[([^\]]+)\]\(([^)]+)\)/g;
    let match;
    while ((match = regex.exec(markdown)) !== null) {
      links.push({
        text: match[1],
        url: match[2]
      });
    }
    return links;
  },

  extractCodeBlocks: (markdown) => {
    const blocks = [];
    const regex = /```(\w+)?\n([\s\S]*?)```/g;
    let match;
    while ((match = regex.exec(markdown)) !== null) {
      blocks.push({
        language: match[1] || 'plaintext',
        code: match[2]
      });
    }
    return blocks;
  },

  extractTOC: (markdown) => {
    const headings = functions.extractHeadings(markdown);
    return headings.map(h => ({
      level: h.level,
      text: h.text,
      anchor: h.text.toLowerCase().replace(/\s+/g, '-')
    }));
  },

  wordCount: (markdown) => {
    const text = markdown.replace(/[#*`\[\]()]/g, '');
    return text.split(/\s+/).filter(w => w).length;
  },

  characterCount: (markdown) => {
    return markdown.length;
  },

  addBadge: (text, label, color = 'blue') => {
    return `${text} ![${label}](https://img.shields.io/badge/${encodeURIComponent(label)}-${color})`;
  },

  addTOC: (markdown) => {
    const toc = functions.extractTOC(markdown);
    const tocMd = '\n## Table of Contents\n' + 
      toc.map(t => `${'  '.repeat(t.level - 1)}- [${t.text}](#${t.anchor})`).join('\n') + 
      '\n\n';
    return markdown.replace(/^# .+$/m, m => m + tocMd);
  }
};

export default { manifest, init, activate, deactivate, hooks, functions };
