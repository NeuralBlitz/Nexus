#!/usr/bin/env node

import('@opencode-ai/sdk').then(async ({ createOpencodeClient }) => {
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║     AI RESEARCH AGENTS - REAL MISSION EXECUTION             ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');
  
  const queries = [
    { agent: 'OMEGA', query: 'Search the web for the latest breakthroughs in neural network architectures (2025-2026). Find novel patterns in state space models (Mamba, S4), mixture of experts, and new transformer variants.' },
    { agent: 'NEXUS', query: 'Search for recent advances in quantum computing algorithms. Find novel computational patterns, quantum ML breakthroughs, and error correction advances (2025-2026).' },
    { agent: 'AETHER', query: 'Research latest developments in AI code generation and programming assistants. Find novel patterns in LLM-based code generation, debugging AI, and automated software engineering.' },
    { agent: 'ZENITH', query: 'Search for emerging patterns in large language model capabilities. Find novel emergent behaviors, reasoning breakthroughs, and multimodal AI advances.' },
    { agent: 'VOID', query: 'Research distributed computing patterns, consensus algorithms, and edge computing advances. Find novel patterns in blockchain, Web3 infrastructure, and decentralized systems.' }
  ];
  
  const client = await createOpencodeClient();
  
  for (const { agent, query } of queries) {
    console.log(`\n🤖 ${agent} starting research...`);
    const startTime = Date.now();
    
    try {
      const stream = await client.chat.completions.createStream({
        model: 'opencode/claude-opus-4-5',
        messages: [
          { role: 'system', content: `You are ${agent}, an elite AI research agent. Search the web and provide deep analysis with sources. Be concise but thorough.` },
          { role: 'user', content: query }
        ],
        webSearch: { enabled: true },
        thinking: { type: 'enabled', depth: 'high' }
      });
      
      let response = '';
      for await (const chunk of stream) {
        response += chunk.choices?.[0]?.delta?.content || '';
      }
      
      const duration = ((Date.now() - startTime) / 1000).toFixed(1);
      console.log(`\n✅ ${agent} COMPLETE (${duration}s)`);
      console.log('─'.repeat(60));
      console.log(response.substring(0, 3000));
      console.log('─'.repeat(60));
    } catch (error) {
      console.error(`\n❌ ${agent} FAILED:`, error.message);
    }
  }
  
  console.log('\n╔══════════════════════════════════════════════════════════════╗');
  console.log('║                    MISSION COMPLETE                            ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');
}).catch(console.error);
