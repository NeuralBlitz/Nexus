export const manifest = {
  name: 'diff-plugin',
  id: 'diff-plugin',
  version: '1.0.0',
  description: 'Text diffing and comparison utilities',
  author: 'NEXUS',
  main: 'index.js',
  permissions: []
};

let api;

export async function init(context) {
  api = context;
  api.log('Diff plugin initialized');
}

export async function activate(context) {
  api.log('Diff plugin activated');
}

export function deactivate() {
  api.log('Diff plugin deactivated');
}

export const functions = {
  diff: (text1, text2) => {
    const lines1 = text1.split('\n'), lines2 = text2.split('\n');
    const result = [];
    const lcs = longestCommonSubsequence(lines1, lines2);
    let i = 0, j = 0, k = 0;
    
    while (i < lines1.length || j < lines2.length) {
      if (i < lines1.length && j < lines2.length && k < lcs.length && lines1[i] === lcs[k] && lines2[j] === lcs[k]) {
        result.push({ type: 'equal', value: lines1[i] });
        i++; j++; k++;
      } else if (j < lines2.length && (k >= lcs.length || lines2[j] !== lcs[k])) {
        result.push({ type: 'add', value: lines2[j] });
        j++;
      } else {
        result.push({ type: 'remove', value: lines1[i] });
        i++;
      }
    }
    return result;
  },

  unified: (text1, text2, options = {}) => {
    const { context = 3 } = options;
    const diffs = functions.diff(text1, text2);
    const result = ['--- original', '+++ modified'];
    let oldCount = 0, newCount = 0;
    
    for (let i = 0; i < diffs.length; i++) {
      const d = diffs[i];
      if (d.type === 'equal') {
        if (oldCount < context || newCount < context) {
          result.push(' ' + d.value);
        }
        oldCount++; newCount++;
      } else if (d.type === 'remove') {
        result.push('-' + d.value);
        oldCount = 0;
      } else {
        result.push('+' + d.value);
        newCount = 0;
      }
    }
    return result.join('\n');
  },

  sideBySide: (text1, text2, width = 40) => {
    const diffs = functions.diff(text1, text2);
    const left = [], right = [];
    
    for (const d of diffs) {
      if (d.type === 'equal') {
        const padded = d.value.padEnd(width);
        left.push(padded);
        right.push(padded);
      } else if (d.type === 'remove') {
        left.push(d.value.padEnd(width));
        right.push(''.padEnd(width));
      } else {
        left.push(''.padEnd(width));
        right.push(d.value.padEnd(width));
      }
    }
    
    return left.map((l, i) => `${l} | ${right[i]}`).join('\n');
  },

  words: (text1, text2) => {
    const words1 = text1.split(/\s+/), words2 = text2.split(/\s+/);
    return functions.diff(words1.join('\n'), words2.join('\n')).map(d => ({ ...d, value: d.value.replace(/\n/g, ' ') }));
  },

  chars: (text1, text2) => {
    return functions.diff(text1.split(''), text2.split('')).map(d => ({ ...d, value: d.value }));
  },

  patch: (original, diffs) => {
    return diffs.filter(d => d.type !== 'remove').map(d => d.value).join('\n');
  },

  stats: (text1, text2) => {
    const diffs = functions.diff(text1, text2);
    const added = diffs.filter(d => d.type === 'add').length;
    const removed = diffs.filter(d => d.type === 'remove').length;
    const unchanged = diffs.filter(d => d.type === 'equal').length;
    return { added, removed, unchanged, changes: added + removed };
  },

  applyPatch: (original, patch) => {
    const lines = original.split('\n');
    const patchLines = patch.split('\n');
    let result = [], i = 0;
    
    for (const line of patchLines) {
      if (line.startsWith('+')) {
        result.push(line.slice(1));
      } else if (line.startsWith('-')) {
        i++;
      } else if (line.startsWith(' ')) {
        result.push(line.slice(1));
        i++;
      }
    }
    return result.join('\n');
  },

  createPatch: (original, modified, options = {}) => {
    const { oldName = 'original', newName = 'modified' } = options;
    const diffs = functions.diff(original, modified);
    const lines = [];
    lines.push(`--- ${oldName}`);
    lines.push(`+++ ${newName}`);
    
    for (const d of diffs) {
      if (d.type === 'equal') lines.push(' ' + d.value);
      else if (d.type === 'remove') lines.push('-' + d.value);
      else lines.push('+' + d.value);
    }
    return lines.join('\n');
  }
};

function longestCommonSubsequence(a, b) {
  const m = a.length, n = b.length;
  const dp = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));
  
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i-1] === b[j-1]) dp[i][j] = dp[i-1][j-1] + 1;
      else dp[i][j] = Math.max(dp[i-1][j], dp[i][j-1]);
    }
  }
  
  const result = [];
  let i = m, j = n;
  while (i > 0 && j > 0) {
    if (a[i-1] === b[j-1]) { result.unshift(a[i-1]); i--; j--; }
    else if (dp[i-1][j] > dp[i][j-1]) i--;
    else j--;
  }
  return result;
}

export default { manifest, init, activate, deactivate, functions };
