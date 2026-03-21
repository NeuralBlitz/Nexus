#!/usr/bin/env node

const WebSocket = require('ws');
const crypto = require('crypto');

const TOKEN = '88ab9737aec5e8cfd889153daf580f8db0d2983e49c8af23';
const WS_URL = 'ws://127.0.0.1:18789';

const researchQueries = [
  { agent: 'OMEGA', query: 'Search web for latest neural network architecture breakthroughs 2025-2026: state space models (Mamba), mixture of experts, new transformer variants. Return concise findings.' },
  { agent: 'NEXUS', query: 'Search web for quantum computing algorithm advances 2025-2026: quantum error correction, quantum ML, novel computational patterns. Return concise findings.' },
  { agent: 'AETHER', query: 'Search web for AI code generation advances 2025-2026: LLM coding assistants, automated debugging tools, software engineering automation. Return concise findings.' },
  { agent: 'ZENITH', query: 'Search web for large language model emergent behaviors 2025-2026: reasoning breakthroughs, multimodal AI, new capabilities. Return concise findings.' },
  { agent: 'VOID', query: 'Search web for distributed computing patterns 2025-2026: consensus algorithms, edge computing, blockchain innovations. Return concise findings.' }
];

function createAgentSession(agentName, query) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(WS_URL);

    let sessionId = `research-${agentName.toLowerCase()}-${Date.now()}`;
    let response = '';
    let authenticated = false;

    ws.on('open', () => {
      console.log(`\n🤖 ${agentName} connecting...`);
    });

    ws.on('message', async (data) => {
      const msg = JSON.parse(data.toString());
      
      if (msg.type === 'event' && msg.event === 'connect.challenge') {
        const { nonce, ts } = msg.payload;
        const signature = crypto
          .createHmac('sha256', TOKEN)
          .update(`${nonce}:${ts}`)
          .digest('hex');
        
        ws.send(JSON.stringify({
          type: 'auth',
          token: TOKEN,
          signature,
          nonce,
          ts
        }));
      }

      if (msg.type === 'auth.success' || (msg.type === 'event' && msg.event === 'auth.success')) {
        authenticated = true;
        console.log(`${agentName}: Authenticated`);
        
        ws.send(JSON.stringify({
          id: `req-${Date.now()}`,
          type: 'execute',
          action: 'chat.send',
          sessionId,
          params: {
            message: query,
            agent: agentName.toLowerCase(),
            thinking: 'high',
            webSearch: true
          }
        }));
      }

      if (msg.type === 'execute.result' || msg.type === 'result') {
        response += msg.content || msg.text || '';
        if (msg.done || msg.final) {
          console.log(`\n✅ ${agentName} COMPLETE`);
          console.log('─'.repeat(50));
          console.log((response || 'No content').substring(0, 2000));
          console.log('─'.repeat(50));
          ws.close();
          resolve(response);
        }
      }

      if (msg.type === 'error') {
        console.error(`❌ ${agentName} ERROR:`, msg.message);
        ws.close();
        reject(new Error(msg.message));
      }
    });

    ws.on('error', (err) => {
      console.error(`❌ ${agentName} error:`, err.message);
      reject(err);
    });

    setTimeout(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.close();
        resolve(response || 'Timeout');
      }
    }, 180000);
  });
}

async function main() {
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║     AI RESEARCH AGENTS - REAL MISSION EXECUTION             ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');

  for (const { agent, query } of researchQueries) {
    try {
      await createAgentSession(agent, query);
    } catch (err) {
      console.error(`\n❌ ${agent} FAILED`);
    }
  }

  console.log('\n╔══════════════════════════════════════════════════════════════╗');
  console.log('║                    MISSION COMPLETE                          ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');
}

main().catch(console.error);
