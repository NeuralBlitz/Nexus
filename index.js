#!/usr/bin/env node

import('@opencode-ai/sdk').then(async ({ createOpencodeServer }) => {
  const express = require('express');
  const http = require('http');
  const WebSocket = require('ws');
  const path = require('path');
  const { spawn } = require('child_process');

  const app = express();
  app.use(express.json());
  app.use(express.static(path.join(__dirname, 'public')));

  const server = http.createServer(app);
  const wss = new WebSocket.Server({ server });

  const CONFIG = { port: process.env.PORT || 19003 };

  const AGENTS = [
    { id: 'OMEGA', color: '#ff0040', icon: '⚡', role: 'Deep Research', specialty: 'Deep analysis & synthesis' },
    { id: 'NEXUS', color: '#00ff88', icon: '🔗', role: 'Web Crawler', specialty: 'Web search & data gathering' },
    { id: 'AETHER', color: '#8800ff', icon: '✨', role: 'Code Architect', specialty: 'Code generation & debugging' },
    { id: 'ZENITH', color: '#ffcc00', icon: '🏔️', role: 'Analysis Core', specialty: 'Pattern recognition & ML' },
    { id: 'VOID', color: '#00ccff', icon: '🌌', role: 'Memory Bank', specialty: 'Knowledge graph & context' },
    { id: 'PRIME', color: '#ff6600', icon: '👑', role: 'Command Unit', specialty: 'Orchestration & coordination' }
  ];

  const MISSIONS = [
    { name: 'OPERATION NEURAL FRONTIER', topic: 'neural network architecture breakthroughs 2025-2026: state space models, mixture of experts, transformers' },
    { name: 'PROJECT QUANTUM CORE', topic: 'quantum computing algorithm advances 2025-2026: error correction, quantum ML' },
    { name: 'TASK FORCE AI CODER', topic: 'AI code generation advances 2025-2026: LLM coding assistants, automated debugging' },
    { name: 'MISSION LLM EMERGENCE', topic: 'large language model emergent behaviors 2025-2026: reasoning, multimodal AI' },
    { name: 'OPERATION DISTRIBUTED', topic: 'distributed computing patterns 2025-2026: consensus algorithms, edge computing' }
  ];

  const state = {
    agents: {},
    missions: [],
    completedMissions: [],
    stats: { totalMissions: 0, totalResearch: 0, tokensUsed: 0, uptime: Date.now() },
    researchLog: [],
    opencodeServer: null,
    sdk: null
  };

  AGENTS.forEach(a => {
    state.agents[a.id] = { ...a, status: 'STANDBY', missionsCompleted: 0, currentResearch: null, xp: 0, level: 1 };
  });

  function broadcast(data) {
    const msg = JSON.stringify(data);
    wss.clients.forEach(c => c.readyState === WebSocket.OPEN && c.send(msg));
  }

  function log(msg, type = 'INFO') {
    const entry = { time: new Date().toISOString(), type, msg };
    state.researchLog.unshift(entry);
    if (state.researchLog.length > 100) state.researchLog.pop();
    broadcast({ type: 'LOG', entry });
    console.log(`[${type}] ${msg}`);
  }

  async function callOpenCodeAI(messages, thinking = 'high') {
    try {
      const prompt = messages.map(m => m.role === 'system' ? `SYSTEM: ${m.content}` : `USER: ${m.content}`).join('\n\n');
      
      return new Promise((resolve, reject) => {
        const timeoutMs = 240000; // 4 minutes
        const timeout = setTimeout(() => {
          proc.kill('SIGTERM');
          reject(new Error('Timeout after 4 minutes'));
        }, timeoutMs);
        
        const proc = spawn('opencode', ['run', prompt]);
        
        let output = '';
        let error = '';
        
        proc.stdout.on('data', d => output += d.toString());
        proc.stderr.on('data', d => error += d.toString());
        
        proc.on('close', (code) => {
          clearTimeout(timeout);
          if (code === 0 || output) {
            const clean = output
              .replace(/\x1b\[[0-9;]*m/g, '')
              .replace(/^> build · .+$/gm, '')
              .replace(/^◈ .+$/gm, '')
              .replace(/^\s+$/gm, '')
              .trim();
            resolve({ content: clean || output, usage: { total_tokens: Math.floor(output.length / 4) } });
          } else {
            reject(new Error(error || 'opencode failed'));
          }
        });
      });
    } catch (e) {
      log(`OpenCode AI error: ${e.message}`, 'ERROR');
      throw e;
    }
  }

  async function executeAgentResearch(agentId, topic) {
    const agent = state.agents[agentId];
    if (!agent) return null;

    agent.status = 'RESEARCHING';
    agent.currentResearch = topic.substring(0, 60);
    broadcast({ type: 'AGENT_UPDATE', agent: { id: agentId, ...agent } });
    log(`${agent.icon} ${agentId} researching: ${topic.substring(0, 50)}...`, 'AGENT');

    const startTime = Date.now();
    
    try {
      const response = await callOpenCodeAI([
        { role: 'system', content: `You are ${agentId}, an elite AI research agent. Search the web and provide detailed findings.` },
        { role: 'user', content: `Research this topic thoroughly: ${topic}. Include key discoveries, patterns, and sources.` }
      ]);

      const duration = Math.round((Date.now() - startTime) / 1000);
      const content = response.content || 'No response';
      const tokens = response.usage?.total_tokens || Math.floor(content.length / 4);

      agent.status = 'STANDBY';
      agent.currentResearch = null;
      agent.lastResearch = { topic, content, duration, tokens, timestamp: Date.now() };
      agent.missionsCompleted++;
      agent.xp += Math.floor(tokens / 10);
      agent.level = Math.floor(agent.xp / 100) + 1;
      state.stats.totalResearch++;
      state.stats.tokensUsed += tokens;

      broadcast({ type: 'AGENT_UPDATE', agent: { id: agentId, ...agent } });
      broadcast({ type: 'RESEARCH_COMPLETE', agent: agentId, topic, content, duration, tokens });
      log(`✅ ${agent.icon} ${agentId} complete (${duration}s, ${tokens} tokens)`, 'SUCCESS');

      return { topic, content, duration, tokens };
    } catch (error) {
      agent.status = 'ERROR';
      agent.currentResearch = null;
      log(`❌ ${agent.icon} ${agentId} failed: ${error.message}`, 'ERROR');
      broadcast({ type: 'AGENT_UPDATE', agent: { id: agentId, ...agent } });
      return null;
    }
  }

  async function executeMission(mission) {
    log(`🎯 Starting mission: ${mission.name}`, 'MISSION');
    
    mission.status = 'ACTIVE';
    mission.progress = 0;
    mission.startedAt = Date.now();
    mission.results = [];
    broadcast({ type: 'MISSION_START', mission });

    const numAgents = Math.min(3, AGENTS.length);
    const agentResults = [];
    
    for (let i = 0; i < numAgents; i++) {
      const agent = AGENTS[i];
      const result = await executeAgentResearch(agent.id, mission.topic);
      if (result) agentResults.push({ agent: agent.id, ...result });
      mission.progress = Math.round(((i + 1) / numAgents) * 100);
      broadcast({ type: 'MISSION_UPDATE', mission });
    }

    mission.results = agentResults;
    mission.progress = 100;
    mission.status = 'COMPLETED';
    mission.completedAt = Date.now();
    
    state.completedMissions.push(mission);
    state.stats.totalMissions++;

    broadcast({ type: 'MISSION_COMPLETE', mission });
    log(`🏆 Mission complete: ${mission.name}`, 'MISSION');

    return mission;
  }

  async function executeRaid(numMissions = 5) {
    log(`⚔️ RAID INITIATED: ${numMissions} missions`, 'MISSION');
    
    const selectedMissions = [];
    for (let i = 0; i < numMissions; i++) {
      const template = MISSIONS[i % MISSIONS.length];
      selectedMissions.push({
        id: `MISSION-${Date.now()}-${i}`,
        name: `${template.name} ${String.fromCharCode(65 + Math.floor(Math.random() * 26))}`,
        topic: template.topic,
        status: 'QUEUED',
        progress: 0,
        results: []
      });
    }

    state.missions.push(...selectedMissions);
    broadcast({ type: 'RAID_START', missions: selectedMissions });

    for (const mission of selectedMissions) {
      await executeMission(mission);
    }

    log(`⚔️ RAID COMPLETE: ${numMissions} missions executed`, 'MISSION');
    broadcast({ type: 'RAID_COMPLETE', stats: state.stats });
  }

  wss.on('connection', (ws) => {
    ws.send(JSON.stringify({ type: 'INIT', state }));
    
    ws.on('message', async (msg) => {
      try {
        const cmd = JSON.parse(msg);
        
        switch (cmd.type) {
          case 'EXECUTE_AGENT':
            const result = await executeAgentResearch(cmd.agentId, cmd.topic);
            ws.send(JSON.stringify({ type: 'RESEARCH_RESULT', result }));
            break;
          case 'EXECUTE_MISSION':
            const mission = { id: `MISSION-${Date.now()}`, name: cmd.name || 'Custom Mission', topic: cmd.topic, status: 'QUEUED', progress: 0, results: [] };
            state.missions.push(mission);
            await executeMission(mission);
            break;
          case 'EXECUTE_RAID':
            await executeRaid(cmd.count || 5);
            break;
          case 'GET_STATE':
            ws.send(JSON.stringify({ type: 'STATE', state }));
            break;
        }
      } catch (e) {
        ws.send(JSON.stringify({ type: 'ERROR', error: e.message }));
      }
    });
  });

  setInterval(() => {
    state.stats.uptime = Date.now();
    broadcast({ type: 'STATS_UPDATE', stats: state.stats, agents: state.agents });
  }, 5000);

  server.listen(CONFIG.port, '0.0.0.0', () => {
    console.log('');
    console.log('╔═══════════════════════════════════════════════════════════════════╗');
    console.log('║           NEURAL COMMAND CENTER v2.0 - OPERATIONAL              ║');
    console.log('╠═══════════════════════════════════════════════════════════════════╣');
    console.log(`║  🎮  Dashboard: http://0.0.0.0:${CONFIG.port}                        ║`);
    console.log(`║  📡  WebSocket: ws://0.0.0.0:${CONFIG.port}                          ║`);
    console.log('║  🤖  Agents: 6 AI research agents ready                          ║');
    console.log('║  ⚔️  Raids: Ready for deployment                                ║');
    console.log('╠═══════════════════════════════════════════════════════════════════╣');
    console.log('║  Commands:                                                     ║');
    console.log('║    /raid 5      - Execute 5 research missions                    ║');
    console.log('║    /raid 10     - Execute 10 missions (MEGA RAID)              ║');
    console.log('║    /status      - View all agent status                         ║');
    console.log('║    /stats       - View research statistics                      ║');
    console.log('╚═══════════════════════════════════════════════════════════════════╝');
    console.log('');
    log('Neural Command Center activated - OpenCode AI integration ready', 'SYSTEM');
  });
}).catch(console.error);
