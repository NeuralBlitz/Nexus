#!/usr/bin/env node

import chalk from 'chalk';
import { spawn } from 'child_process';
import readline from 'readline';
import inquirer from 'inquirer';

const CONFIG = {
  port: parseInt(process.env.NEXUS_PORT || process.env.PORT || 3000),
  wsUrl: `ws://localhost:${process.env.NEXUS_PORT || 3000}`,
  maxHistory: 100,
  statusUpdateInterval: 5000
};

const AGENTS = [
  { id: 'NEXUS-1', name: 'NEXUS', icon: '🔮', color: '#9333EA', status: 'idle', tasks: 0 },
  { id: 'CODEX', name: 'CODEX', icon: '💻', color: '#10B981', status: 'idle', tasks: 0 },
  { id: 'AURORA', name: 'AURORA', icon: '🌟', color: '#F59E0B', status: 'idle', tasks: 0 },
  { id: 'GHOST', name: 'GHOST', icon: '👻', color: '#06B6D4', status: 'idle', tasks: 0 },
  { id: 'ORACLE', name: 'ORACLE', icon: '🔮', color: '#EC4899', status: 'idle', tasks: 0 },
  { id: 'WRAITH', name: 'WRAITH', icon: '⚡', color: '#EF4444', status: 'idle', tasks: 0 }
];

const COMMANDS = [
  '/status', '/history', '/clear', '/models', '/switch', '/code', '/research', '/chat',
  'agents', 'providers', 'run', 'runall', 'local', 'cloud', 'stream', 'ollama', 'test', 'help', 'exit'
];

// ═══════════════════════════════════════════════════════════════════════════
// STATE MANAGEMENT
// ═══════════════════════════════════════════════════════════════════════════

const state = {
  currentAgent: null,
  commandHistory: [],
  taskHistory: [],
  historyIndex: -1,
  isProcessing: false
};

// ═══════════════════════════════════════════════════════════════════════════
// ANSI COLORS & STYLING
// ═══════════════════════════════════════════════════════════════════════════

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  blue: '\x1b[34m',
  purple: '\x1b[35m',
  white: '\x1b[37m',
  black: '\x1b[30m',
  bgCyan: '\x1b[46m',
  bgGreen: '\x1b[42m',
  bgYellow: '\x1b[43m',
  bgRed: '\x1b[41m'
};

function getAgentColor(agentId) {
  const agent = AGENTS.find(a => a.id === agentId);
  return agent ? agent.color : colors.cyan;
}

function colorize(text, color) {
  const colorMap = {
    '#9333EA': colors.magenta,
    '#10B981': colors.green,
    '#F59E0B': colors.yellow,
    '#06B6D4': colors.cyan,
    '#EC4899': colors.magenta,
    '#EF4444': colors.red
  };
  return (colorMap[color] || colors.cyan) + text + colors.reset;
}

function log(...args) {
  console.log(chalk.cyan('[NEXUS]'), ...args);
}

function agentLog(agentId, ...args) {
  const agent = AGENTS.find(a => a.id === agentId);
  if (agent) {
    const prefix = `${agent.icon} ${chalk.hex(agent.color)(agent.name)}`;
    console.log(prefix, ...args);
  } else {
    console.log(chalk.cyan('[NEXUS]'), ...args);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// UI COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════

function banner() {
  console.log(`
${colors.cyan}${colors.bright}
╔═══════════════════════════════════════════════════════════════════════════╗
║                                                                       ║
║     ███╗   ██╗███████╗██╗   ██╗██╗  ██╗██╗   ██╗                  ║
║     ████╗  ██║██╔════╝╚██╗ ██╔╝██║  ██║██║   ██║                  ║
║     ██╔██╗ ██║█████╗   ╚████╔╝ ███████║██║   ██║                  ║
║     ██║╚██╗██║██╔══╝    ╚██╔╝  ██╔══██║██║   ██║                  ║
║     ██║ ╚████║███████╗   ██║   ██║  ██║╚██████╔╝                  ║
║     ╚═╝  ╚═══╝╚══════╝   ╚═╝   ╚═╝  ╚═╝ ╚═════╝                   ║
║                                                                       ║
║     UNIFIED AI AGENT PLATFORM - CLI INTERFACE v2.0                    ║
║     Type 'help' for commands or use '/' for shortcuts                 ║
${colors.reset}
`);
}

function showHelp() {
  console.log(`
${colors.cyan}${colors.bright}COMMANDS:${colors.reset}
  ${colors.green}agents${colors.reset}              - List all available agents
  ${colors.green}providers${colors.reset}           - Check AI provider status
  ${colors.green}run <agent> <task>${colors.reset}  - Execute task on agent
  ${colors.green}runall <task>${colors.reset}       - Execute on all agents
  ${colors.green}local <task>${colors.reset}        - Run using local Ollama
  ${colors.green}cloud <task>${colors.reset}         - Run using OpenCode/Claude
  ${colors.green}stream <task>${colors.reset}       - Stream response
  ${colors.green}ollama${colors.reset}             - Check Ollama status
  ${colors.green}test${colors.reset}               - Run diagnostics

${colors.magenta}${colors.bright}SHORTCUT COMMANDS:${colors.reset}
  ${colors.yellow}/status${colors.reset}             - Show all agents and their status
  ${colors.yellow}/history${colors.reset}            - Show recent task history
  ${colors.yellow}/clear${colors.reset}              - Clear screen
  ${colors.yellow}/models${colors.reset}             - List available models
  ${colors.yellow}/switch <agent>${colors.reset}     - Switch to specific agent
  ${colors.yellow}/code <task>${colors.reset}        - Quick code task (uses CODEX)
  ${colors.yellow}/research <task>${colors.reset}    - Quick research task (uses AURORA)
  ${colors.yellow}/chat <message>${colors.reset}     - Quick chat (uses current agent)

${colors.cyan}${colors.bright}KEYBOARD SHORTCUTS:${colors.reset}
  ${colors.dim}↑/↓${colors.reset}                 - Navigate command history
  ${colors.dim}Tab${colors.reset}                 - Auto-complete commands
  ${colors.dim}Ctrl+C${colors.reset}              - Exit

${colors.cyan}${colors.bright}EXAMPLES:${colors.reset}
  ${colors.dim}> /code Write a Python function to sort a list
  ${colors.dim}> /research What are the latest AI breakthroughs?
  ${colors.dim}> run CODEX Build me a React dashboard component
  ${colors.dim}> /switch AURORA
  ${colors.dim}> /status
`);
}

// ═══════════════════════════════════════════════════════════════════════════
// PROGRESS INDICATORS
// ═══════════════════════════════════════════════════════════════════════════

class ProgressSpinner {
  constructor(message, agentId = null) {
    this.message = message;
    this.agentId = agentId;
    this.frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
    this.frameIndex = 0;
    this.active = false;
    this.interval = null;
  }

  start() {
    this.active = true;
    this.interval = setInterval(() => {
      if (!this.active) return;
      const frame = this.frames[this.frameIndex];
      const prefix = this.agentId ? agentLog(this.agentId, '') : '';
      process.stdout.write(`\r${frame} ${this.message}`);
      this.frameIndex = (this.frameIndex + 1) % this.frames.length;
    }, 80);
    return this;
  }

  stop(success = true) {
    this.active = false;
    if (this.interval) clearInterval(this.interval);
    const symbol = success ? '✓' : '✗';
    const color = success ? colors.green : colors.red;
    process.stdout.write(`\r${color}${symbol}${colors.reset} ${this.message}\n`);
  }

  updateMessage(message) {
    this.message = message;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// INTERACTIVE AGENT SELECTION
// ═══════════════════════════════════════════════════════════════════════════

async function selectAgentInteractive() {
  const choices = AGENTS.map(agent => ({
    name: `${agent.icon} ${agent.name} - ${agent.status} (${agent.tasks} tasks)`,
    value: agent.id,
    short: agent.name
  }));

  const { selectedAgent } = await inquirer.prompt([
    {
      type: 'list',
      name: 'selectedAgent',
      message: 'Select an agent:',
      choices,
      loop: false
    }
  ]);

  return selectedAgent;
}

// ═══════════════════════════════════════════════════════════════════════════
// COMMAND HISTORY
// ═══════════════════════════════════════════════════════════════════════════

function addToHistory(command) {
  if (command.trim() && state.commandHistory[state.commandHistory.length - 1] !== command) {
    state.commandHistory.push(command);
    if (state.commandHistory.length > CONFIG.maxHistory) {
      state.commandHistory.shift();
    }
  }
  state.historyIndex = state.commandHistory.length;
}

function addToTaskHistory(agent, task, result) {
  state.taskHistory.unshift({
    agent,
    task,
    result: result?.substring(0, 100) + (result?.length > 100 ? '...' : ''),
    timestamp: new Date().toISOString()
  });
  if (state.taskHistory.length > CONFIG.maxHistory) {
    state.taskHistory.pop();
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// TAB COMPLETION
// ═══════════════════════════════════════════════════════════════════════════

function getCompletions(partial) {
  const lowerPartial = partial.toLowerCase();
  const completions = [];
  
  // Command completions
  COMMANDS.forEach(cmd => {
    if (cmd.startsWith(lowerPartial)) {
      completions.push(cmd);
    }
  });
  
  // Agent completions for /switch command
  if (lowerPartial.startsWith('/switch ') || lowerPartial.startsWith('/switch')) {
    const agentPartial = lowerPartial.replace('/switch', '').trim().toUpperCase();
    AGENTS.forEach(agent => {
      if (agent.id.startsWith(agentPartial)) {
        completions.push(`/switch ${agent.id}`);
      }
    });
  }
  
  // Run command completions
  if (lowerPartial.startsWith('run ') || lowerPartial.startsWith('run')) {
    const agentPartial = lowerPartial.replace('run', '').trim().toUpperCase();
    AGENTS.forEach(agent => {
      if (agent.id.startsWith(agentPartial)) {
        completions.push(`run ${agent.id}`);
      }
    });
  }
  
  return completions;
}

// ═══════════════════════════════════════════════════════════════════════════
// DIRECT AI EXECUTION (No WebSocket needed)
// ═══════════════════════════════════════════════════════════════════════════

async function runOpenCode(task, agentId = null) {
  const agent = agentId || state.currentAgent || 'NEXUS-1';
  agentLog(agent, `${colors.yellow}Running task...${colors.reset}`);
  
  // Update agent status
  updateAgentStatus(agent, 'processing');
  
  return new Promise((resolve, reject) => {
    const proc = spawn('opencode', ['run', task]);
    let output = '';
    const spinner = new ProgressSpinner('Processing with OpenCode...', agent).start();
    
    proc.stdout.on('data', d => {
      const text = d.toString();
      output += text;
      spinner.stop();
      process.stdout.write(text);
      spinner.start();
    });
    
    proc.stderr.on('data', d => {
      const text = d.toString();
      if (!text.includes('build')) process.stderr.write(text);
    });
    
    proc.on('close', (code) => {
      spinner.stop();
      console.log('');
      updateAgentStatus(agent, 'idle');
      addToTaskHistory(agent, task, output);
      
      const clean = output
        .replace(/\x1b\[[0-9;]*m/g, '')
        .replace(/^> build · .+$/gm, '')
        .replace(/^◈ .+$/gm, '')
        .trim();
      resolve(clean);
    });
    
    proc.on('error', (err) => {
      spinner.stop(false);
      updateAgentStatus(agent, 'error');
      reject(err);
    });
    
    setTimeout(() => { proc.kill(); reject(new Error('Timeout')); }, 180000);
  });
}

async function runClaude(task, agentId = null) {
  const agent = agentId || state.currentAgent || 'NEXUS-1';
  agentLog(agent, `${colors.yellow}Running via Claude Code...${colors.reset}`);
  
  updateAgentStatus(agent, 'processing');
  
  return new Promise((resolve, reject) => {
    const proc = spawn('claude', ['--print', task]);
    let output = '';
    const spinner = new ProgressSpinner('Processing with Claude...', agent).start();
    
    proc.stdout.on('data', d => {
      const text = d.toString();
      output += text;
      spinner.stop();
      process.stdout.write(text);
      spinner.start();
    });
    
    proc.on('close', (code) => {
      spinner.stop();
      console.log('');
      updateAgentStatus(agent, 'idle');
      addToTaskHistory(agent, task, output);
      if (code === 0) resolve(output.trim());
      else reject(new Error('Claude failed'));
    });
    
    proc.on('error', (err) => {
      spinner.stop(false);
      updateAgentStatus(agent, 'error');
      reject(err);
    });
    
    setTimeout(() => { proc.kill(); reject(new Error('Timeout')); }, 180000);
  });
}

async function runOllama(task, model = 'llama3.2', agentId = null) {
  const agent = agentId || state.currentAgent || 'NEXUS-1';
  agentLog(agent, `${colors.yellow}Running via Ollama (${model})...${colors.reset}`);
  
  updateAgentStatus(agent, 'processing');
  
  return new Promise((resolve, reject) => {
    const proc = spawn('curl', [
      '-s', 'http://localhost:11434/api/generate',
      '-X', 'POST',
      '-d', JSON.stringify({ model, prompt: task, stream: true })
    ]);
    
    let output = '';
    const spinner = new ProgressSpinner(`Processing with ${model}...`, agent).start();
    let hasOutput = false;
    
    proc.stdout.on('data', (data) => {
      const text = data.toString();
      const lines = text.split('\n').filter(l => l.trim());
      
      for (const line of lines) {
        try {
          const parsed = JSON.parse(line);
          if (parsed.response) {
            hasOutput = true;
            spinner.stop();
            output += parsed.response;
            process.stdout.write(parsed.response);
            spinner.start();
          }
        } catch {}
      }
    });
    
    proc.on('close', () => {
      spinner.stop();
      console.log('');
      updateAgentStatus(agent, 'idle');
      addToTaskHistory(agent, task, output);
      resolve(output);
    });
    
    proc.on('error', (e) => {
      spinner.stop(false);
      updateAgentStatus(agent, 'error');
      reject(new Error('Ollama not running'));
    });
    setTimeout(() => { proc.kill(); reject(new Error('Timeout')); }, 120000);
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// AGENT STATUS MANAGEMENT
// ═══════════════════════════════════════════════════════════════════════════

function updateAgentStatus(agentId, status) {
  const agent = AGENTS.find(a => a.id === agentId);
  if (agent) {
    agent.status = status;
    if (status === 'processing') agent.tasks++;
  }
}

function showStatusPanel() {
  console.log(`\n${colors.cyan}${colors.bright}═══ AGENT STATUS PANEL ═══${colors.reset}\n`);
  
  AGENTS.forEach(agent => {
    const statusColor = agent.status === 'processing' ? colors.yellow :
                       agent.status === 'error' ? colors.red :
                       agent.status === 'idle' ? colors.green : colors.cyan;
    const statusIcon = agent.status === 'processing' ? '🔄' :
                      agent.status === 'error' ? '❌' :
                      agent.status === 'idle' ? '✅' : '❓';
    
    console.log(`  ${agent.icon} ${chalk.hex(agent.color)(agent.name.padEnd(8))} ${statusIcon} ${statusColor}${agent.status.padEnd(12)}${colors.reset} Tasks: ${agent.tasks}`);
  });
  
  console.log(`\n${colors.dim}Current agent: ${state.currentAgent || 'None'}${colors.reset}\n`);
}

// ═══════════════════════════════════════════════════════════════════════════
// PROVIDER CHECKS
// ═══════════════════════════════════════════════════════════════════════════

async function checkOllama() {
  log(`${colors.cyan}Checking Ollama status...${colors.reset}`);
  
  try {
    const proc = spawn('curl', ['-s', 'http://localhost:11434/api/tags']);
    
    return new Promise((resolve) => {
      let output = '';
      proc.stdout.on('data', d => output += d.toString());
      proc.on('close', () => {
        try {
          const data = JSON.parse(output);
          console.log(`${colors.green}✅ Ollama is ONLINE${colors.reset}`);
          console.log(`${colors.cyan}Available models:${colors.reset}`);
          data.models?.forEach(m => console.log(`  - ${m.name}`));
          resolve(true);
        } catch {
          console.log(`${colors.red}❌ Ollama returned invalid data${colors.reset}`);
          resolve(false);
        }
      });
      proc.on('error', () => {
        console.log(`${colors.red}❌ Ollama is OFFLINE${colors.reset}`);
        console.log(`${colors.yellow}Run: ollama serve${colors.reset}`);
        resolve(false);
      });
    });
  } catch {
    console.log(`${colors.red}❌ Ollama not found${colors.reset}`);
    return false;
  }
}

async function testProviders() {
  console.log(`\n${colors.cyan}${colors.bright}═══ PROVIDER DIAGNOSTICS ═══${colors.reset}\n`);
  
  const spinner = new ProgressSpinner('Checking providers...').start();
  
  // Test OpenCode
  try {
    const proc = spawn('which', ['opencode']);
    await new Promise(r => proc.on('close', code => { 
      spinner.stop();
      if (code === 0) {
        console.log(`${colors.green}✅${colors.reset} OpenCode`);
      } else {
        console.log(`${colors.red}❌${colors.reset} OpenCode (not installed)`);
      }
      spinner.start();
    }));
  } catch {
    spinner.stop();
    console.log(`${colors.red}❌${colors.reset} OpenCode`);
    spinner.start();
  }
  
  // Test Claude
  try {
    const proc = spawn('which', ['claude']);
    await new Promise(r => proc.on('close', code => { 
      spinner.stop();
      if (code === 0) {
        console.log(`${colors.green}✅${colors.reset} Claude Code`);
      } else {
        console.log(`${colors.red}❌${colors.reset} Claude Code (not installed)`);
      }
      spinner.start();
    }));
  } catch {
    spinner.stop();
    console.log(`${colors.red}❌${colors.reset} Claude Code`);
    spinner.start();
  }
  
  // Test Ollama
  spinner.stop();
  await checkOllama();
  spinner.start();
  
  // Test OpenAI
  if (process.env.OPENAI_API_KEY) {
    console.log(`${colors.green}✅${colors.reset} OpenAI (API key set)`);
  } else {
    console.log(`${colors.yellow}⚠️${colors.reset} OpenAI (no API key)`);
  }
  
  // Test Anthropic
  if (process.env.ANTHROPIC_API_KEY) {
    console.log(`${colors.green}✅${colors.reset} Anthropic (API key set)`);
  } else {
    console.log(`${colors.yellow}⚠️${colors.reset} Anthropic (no API key)`);
  }
  
  console.log('');
}

// ═══════════════════════════════════════════════════════════════════════════
// COMMAND HANDLERS
// ═══════════════════════════════════════════════════════════════════════════

async function handleSlashCommand(cmd, args, rl) {
  switch (cmd) {
    case '/status':
      showStatusPanel();
      return true;
      
    case '/history':
      console.log(`\n${colors.cyan}${colors.bright}═══ RECENT TASK HISTORY ═══${colors.reset}\n`);
      if (state.taskHistory.length === 0) {
        console.log(`${colors.dim}No tasks in history.${colors.reset}`);
      } else {
        state.taskHistory.slice(0, 10).forEach((item, i) => {
          const agent = AGENTS.find(a => a.id === item.agent);
          const icon = agent ? agent.icon : '📝';
          const time = new Date(item.timestamp).toLocaleTimeString();
          console.log(`${colors.dim}${i + 1}.${colors.reset} ${icon} ${chalk.hex(agent?.color || '#9333EA')(item.agent)} ${colors.dim}@${time}${colors.reset}`);
          console.log(`   ${colors.yellow}${item.task.substring(0, 60)}${item.task.length > 60 ? '...' : ''}${colors.reset}`);
          console.log(`   ${colors.dim}${item.result?.substring(0, 80)}...${colors.reset}\n`);
        });
      }
      return true;
      
    case '/clear':
      console.clear();
      banner();
      return true;
      
    case '/models':
      console.log(`\n${colors.cyan}${colors.bright}═══ AVAILABLE MODELS ═══${colors.reset}\n`);
      console.log(`${colors.green}Local (Ollama):${colors.reset}`);
      console.log(`  - llama3.2 (default)`);
      console.log(`  - llama3.1`);
      console.log(`  - mistral`);
      console.log(`  - codellama`);
      console.log(`\n${colors.green}Cloud:${colors.reset}`);
      console.log(`  - OpenCode (claude-sonnet-4-20250514)`);
      console.log(`  - Claude Code (claude-3-5-sonnet-20241022)`);
      console.log(`  - OpenAI GPT-4o (if API key set)`);
      console.log('');
      return true;
      
    case '/switch':
      if (args.length < 1) {
        const selected = await selectAgentInteractive();
        state.currentAgent = selected;
        const agent = AGENTS.find(a => a.id === selected);
        log(`${colors.green}Switched to ${agent.icon} ${chalk.hex(agent.color)(agent.name)}${colors.reset}`);
      } else {
        const agentId = args[0].toUpperCase();
        const agent = AGENTS.find(a => a.id === agentId);
        if (agent) {
          state.currentAgent = agentId;
          log(`${colors.green}Switched to ${agent.icon} ${chalk.hex(agent.color)(agent.name)}${colors.reset}`);
        } else {
          log(`${colors.red}Unknown agent: ${args[0]}${colors.reset}`);
          log(`${colors.dim}Available: ${AGENTS.map(a => a.id).join(', ')}${colors.reset}`);
        }
      }
      return true;
      
    case '/code':
      if (args.length < 1) {
        log(`${colors.red}Usage: /code <task>${colors.reset}`);
      } else {
        const task = args.join(' ');
        state.currentAgent = 'CODEX';
        try {
          await runOpenCode(task, 'CODEX');
        } catch (e) {
          log(`${colors.red}Error: ${e.message}${colors.reset}`);
        }
      }
      return true;
      
    case '/research':
      if (args.length < 1) {
        log(`${colors.red}Usage: /research <task>${colors.reset}`);
      } else {
        const task = args.join(' ');
        state.currentAgent = 'AURORA';
        try {
          await runOpenCode(task, 'AURORA');
        } catch (e) {
          log(`${colors.red}Error: ${e.message}${colors.reset}`);
        }
      }
      return true;
      
    case '/chat':
      if (args.length < 1) {
        log(`${colors.red}Usage: /chat <message>${colors.reset}`);
      } else {
        const task = args.join(' ');
        if (!state.currentAgent) {
          state.currentAgent = 'NEXUS-1';
        }
        try {
          await runOpenCode(task, state.currentAgent);
        } catch (e) {
          try {
            await runOllama(task, 'llama3.2', state.currentAgent);
          } catch (e2) {
            log(`${colors.red}Error: ${e2.message}${colors.reset}`);
          }
        }
      }
      return true;
      
    default:
      return false;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN CLI LOOP
// ═══════════════════════════════════════════════════════════════════════════

async function main() {
  banner();
  
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: `${colors.cyan}nexus>${colors.reset} `,
    completer: (line) => {
      const completions = getCompletions(line);
      return [completions.length ? completions : [line], line];
    }
  });
  
  // Set default agent
  state.currentAgent = 'NEXUS-1';
  
  rl.prompt();
  
  rl.on('line', async (line) => {
    const trimmedLine = line.trim();
    const lowerLine = trimmedLine.toLowerCase();
    const parts = trimmedLine.split(/\s+/);
    const cmd = parts[0]?.toLowerCase();
    const args = parts.slice(1);
    
    addToHistory(trimmedLine);
    
    if (state.isProcessing) {
      log(`${colors.yellow}Processing previous command...${colors.reset}`);
      rl.prompt();
      return;
    }
    
    state.isProcessing = true;
    console.log('');
    
    try {
      // Check for slash commands first
      if (cmd.startsWith('/')) {
        const handled = await handleSlashCommand(cmd, args, rl);
        if (!handled) {
          log(`${colors.red}Unknown command: ${cmd}${colors.reset}`);
          log(`${colors.dim}Type 'help' for available commands${colors.reset}`);
        }
      } else {
        // Regular commands
        switch (cmd) {
          case 'agents':
            console.log(`${colors.cyan}${colors.bright}═══ AGENT ROSTER ═══${colors.reset}\n`);
            AGENTS.forEach(a => {
              const statusIcon = a.status === 'processing' ? '🔄' : 
                                a.status === 'error' ? '❌' : '✅';
              console.log(`  ${a.icon} ${chalk.hex(a.color)(a.name.padEnd(8))} ${statusIcon} ${a.status.padEnd(12)} Tasks: ${a.tasks}`);
            });
            console.log('');
            break;
            
          case 'providers':
          case 'test':
            await testProviders();
            break;
            
          case 'ollama':
            await checkOllama();
            break;
            
          case 'help':
          case '?':
            showHelp();
            break;
            
          case 'exit':
          case 'quit':
          case 'q':
            console.log(`${colors.cyan}Goodbye!${colors.reset}\n`);
            process.exit(0);
            break;
            
          case '':
            break;
            
          case 'run':
            if (args.length < 2) {
              log(`${colors.red}Usage: run <agent> <task>${colors.reset}`);
              log(`${colors.dim}Available agents: ${AGENTS.map(a => a.id).join(', ')}${colors.reset}`);
            } else {
              const agentId = args[0].toUpperCase();
              const task = args.slice(1).join(' ');
              const agent = AGENTS.find(a => a.id === agentId);
              
              if (!agent) {
                log(`${colors.red}Unknown agent: ${args[0]}${colors.reset}`);
                log(`${colors.dim}Available: ${AGENTS.map(a => a.id).join(', ')}${colors.reset}`);
              } else {
                state.currentAgent = agentId;
                try {
                  await runOpenCode(task, agentId);
                } catch (e) {
                  log(`${colors.red}Error: ${e.message}${colors.reset}`);
                }
              }
            }
            break;
            
          case 'runall':
            if (args.length < 1) {
              log(`${colors.red}Usage: runall <task>${colors.reset}`);
            } else {
              const task = args.join(' ');
              log(`${colors.cyan}Executing on ALL agents...${colors.reset}`);
              for (const agent of AGENTS.slice(0, 3)) {
                console.log(`\n${colors.yellow}═══ ${agent.icon} ${agent.name} ═══${colors.reset}`);
                try {
                  await runOpenCode(task, agent.id);
                } catch (e) {
                  log(`${colors.red}Error: ${e.message}${colors.reset}`);
                }
              }
            }
            break;
            
          case 'local':
            if (args.length < 1) {
              log(`${colors.red}Usage: local <task>${colors.reset}`);
            } else {
              const task = args.join(' ');
              try {
                await runOllama(task, 'llama3.2', state.currentAgent);
              } catch (e) {
                log(`${colors.red}Ollama error: ${e.message}${colors.reset}`);
                log(`${colors.yellow}Make sure Ollama is running: ollama serve${colors.reset}`);
              }
            }
            break;
            
          case 'cloud':
            if (args.length < 1) {
              log(`${colors.red}Usage: cloud <task>${colors.reset}`);
            } else {
              const task = args.join(' ');
              try {
                await runOpenCode(task, state.currentAgent);
              } catch (e) {
                try {
                  await runClaude(task, state.currentAgent);
                } catch (e2) {
                  log(`${colors.red}Cloud error: ${e2.message}${colors.reset}`);
                }
              }
            }
            break;
            
          case 'stream':
            if (args.length < 1) {
              log(`${colors.red}Usage: stream <task>${colors.reset}`);
            } else {
              const task = args.join(' ');
              log(`${colors.cyan}Streaming response...${colors.reset}`);
              try {
                await runOllama(task, 'llama3.2', state.currentAgent);
              } catch (e) {
                log(`${colors.red}Stream error: ${e.message}${colors.reset}`);
              }
            }
            break;
            
          default:
            // Direct task execution with current agent
            if (!state.currentAgent) {
              state.currentAgent = 'NEXUS-1';
            }
            
            try {
              await runOpenCode(trimmedLine, state.currentAgent);
            } catch (e) {
              try {
                await runOllama(trimmedLine, 'llama3.2', state.currentAgent);
              } catch (e2) {
                log(`${colors.red}No providers available. Run 'test' to check status.${colors.reset}`);
              }
            }
        }
      }
    } catch (e) {
      log(`${colors.red}Error: ${e.message}${colors.reset}`);
    }
    
    state.isProcessing = false;
    console.log('');
    rl.prompt();
  });
  
  rl.on('close', () => {
    console.log(`${colors.cyan}\nGoodbye!${colors.reset}\n`);
    process.exit(0);
  });
  
  // Handle Ctrl+C gracefully
  process.on('SIGINT', () => {
    console.log(`\n${colors.yellow}Use 'exit' or 'quit' to leave${colors.reset}`);
    rl.prompt();
  });
}

main().catch(e => {
  console.error(`${colors.red}Fatal error: ${e.message}${colors.reset}`);
  process.exit(1);
});
