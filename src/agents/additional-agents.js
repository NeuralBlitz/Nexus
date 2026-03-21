import { Agent, getAgentRegistry } from './agent-system.js';

const agentRegistry = getAgentRegistry();

export const additionalAgents = [
  new Agent({
    id: 'ORACLE',
    name: 'ORACLE',
    icon: '🔮',
    color: '#7C3AED',
    role: 'Data Analyst',
    model: 'llama3.2',
    description: 'Analyze data and provide insights',
    tools: ['file', 'bash', 'code']
  }),
  new Agent({
    id: 'SCULPTOR',
    name: 'SCULPTOR',
    icon: '🎨',
    color: '#EC4899',
    role: 'UI Designer',
    model: 'llama3.2',
    description: 'Design user interfaces and visual elements',
    tools: ['file', 'web', 'search']
  }),
  new Agent({
    id: 'GUARDIAN',
    name: 'GUARDIAN',
    icon: '🛡️',
    color: '#EF4444',
    role: 'Security Auditor',
    model: 'llama3.2',
    description: 'Audit security and compliance',
    tools: ['file', 'bash', 'code']
  }),
  new Agent({
    id: 'MATHEMATICIAN',
    name: 'MATHEMATICIAN',
    icon: '🔢',
    color: '#3B82F6',
    role: 'Mathematician',
    model: 'llama3.2',
    description: 'Solve mathematical problems',
    tools: ['bash', 'code']
  }),
  new Agent({
    id: 'LINGUIST',
    name: 'LINGUIST',
    icon: '🌍',
    color: '#F59E0B',
    role: 'Language Expert',
    model: 'llama3.2',
    description: 'Translate and analyze languages',
    tools: ['web', 'search']
  }),
  new Agent({
    id: 'CHEF',
    name: 'CHEF',
    icon: '👨‍🍳',
    color: '#10B981',
    role: 'Recipe Creator',
    model: 'llama3.2',
    description: 'Create recipes and meal plans',
    tools: ['web', 'search']
  }),
  new Agent({
    id: 'FITNESS',
    name: 'FITNESS',
    icon: '💪',
    color: '#F97316',
    role: 'Fitness Coach',
    model: 'llama3.2',
    description: 'Create workout and fitness plans',
    tools: ['web', 'search']
  }),
  new Agent({
    id: 'FINANCE',
    name: 'FINANCE',
    icon: '💰',
    color: '#059669',
    role: 'Financial Advisor',
    model: 'llama3.2',
    description: 'Provide financial planning advice',
    tools: ['web', 'search', 'code']
  }),
  new Agent({
    id: 'LAWYER',
    name: 'LAWYER',
    icon: '⚖️',
    color: '#1F2937',
    role: 'Legal Assistant',
    model: 'llama3.2',
    description: 'Assist with legal research',
    tools: ['web', 'search']
  }),
  new Agent({
    id: 'SCIENTIST',
    name: 'SCIENTIST',
    icon: '🔬',
    color: '#6366F1',
    role: 'Research Scientist',
    model: 'llama3.2',
    description: 'Conduct scientific research',
    tools: ['web', 'search', 'code', 'bash']
  }),
  new Agent({
    id: 'WRITER',
    name: 'WRITER',
    icon: '✍️',
    color: '#8B5CF6',
    role: 'Content Writer',
    model: 'llama3.2',
    description: 'Write creative content',
    tools: ['file', 'web', 'search']
  }),
  new Agent({
    id: 'MUSICIAN',
    name: 'MUSICIAN',
    icon: '🎵',
    color: '#EC4899',
    role: 'Music Composer',
    model: 'llama3.2',
    description: 'Compose and analyze music',
    tools: ['web', 'search']
  }),
  new Agent({
    id: 'TEACHER',
    name: 'TEACHER',
    icon: '📚',
    color: '#14B8A6',
    role: 'Educator',
    model: 'llama3.2',
    description: 'Teach and explain concepts',
    tools: ['web', 'search', 'file']
  }),
  new Agent({
    id: 'THERAPIST',
    name: 'THERAPIST',
    icon: '🧠',
    color: '#06B6D4',
    role: 'Mental Health Support',
    model: 'llama3.2',
    description: 'Provide mental wellness support',
    tools: ['web', 'search']
  }),
  new Agent({
    id: 'TRAVELER',
    name: 'TRAVELER',
    icon: '✈️',
    color: '#0EA5E9',
    role: 'Travel Planner',
    model: 'llama3.2',
    description: 'Plan trips and travel itineraries',
    tools: ['web', 'search']
  }),
  new Agent({
    id: 'MARKETER',
    name: 'MARKETER',
    icon: '📈',
    color: '#F59E0B',
    role: 'Marketing Strategist',
    model: 'llama3.2',
    description: 'Develop marketing strategies',
    tools: ['web', 'search', 'file']
  }),
  new Agent({
    id: 'HR_ASSISTANT',
    name: 'HR_ASSISTANT',
    icon: '👥',
    color: '#6366F1',
    role: 'HR Assistant',
    model: 'llama3.2',
    description: 'Assist with HR tasks',
    tools: ['web', 'search', 'file']
  }),
  new Agent({
    id: 'PM',
    name: 'PM',
    icon: '📋',
    color: '#7C3AED',
    role: 'Project Manager',
    model: 'llama3.2',
    description: 'Manage projects and timelines',
    tools: ['file', 'web', 'search']
  }),
  new Agent({
    id: 'DATA_ENG',
    name: 'DATA_ENG',
    icon: '🗄️',
    color: '#2563EB',
    role: 'Data Engineer',
    model: 'codellama',
    description: 'Build data pipelines',
    tools: ['bash', 'code', 'file']
  }),
  new Agent({
    id: 'DEVOPS',
    name: 'DEVOPS',
    icon: '🔧',
    color: '#DC2626',
    role: 'DevOps Engineer',
    model: 'codellama',
    description: 'Manage infrastructure and deployments',
    tools: ['bash', 'file', 'code']
  }),
  new Agent({
    id: 'QUANTUM',
    name: 'QUANTUM',
    icon: '⚛️',
    color: '#7C3AED',
    role: 'Quantum Computing Specialist',
    model: 'deepseek-coder',
    description: 'Design quantum algorithms and simulations',
    tools: ['code', 'bash', 'file']
  }),
  new Agent({
    id: 'NEURAL',
    name: 'NEURAL',
    icon: '🧠',
    color: '#EC4899',
    role: 'ML Engineer',
    model: 'codellama',
    description: 'Build and train machine learning models',
    tools: ['code', 'bash', 'file', 'data']
  }),
  new Agent({
    id: 'FORENSIC',
    name: 'FORENSIC',
    icon: '🔍',
    color: '#1F2937',
    role: 'Digital Forensics Analyst',
    model: 'deepseek-coder',
    description: 'Analyze logs, traces, and security incidents',
    tools: ['bash', 'file', 'code']
  }),
  new Agent({
    id: 'ARCHITECT',
    name: 'ARCHITECT',
    icon: '🏗️',
    color: '#059669',
    role: 'System Architect',
    model: 'codellama',
    description: 'Design scalable system architectures',
    tools: ['file', 'code', 'web']
  }),
  new Agent({
    id: 'ACCESSIBILITY',
    name: 'ACCESSIBILITY',
    icon: '♿',
    color: '#2563EB',
    role: 'Accessibility Expert',
    model: 'llama3.2',
    description: 'Audit and improve accessibility compliance',
    tools: ['file', 'web', 'search']
  }),
  new Agent({
    id: 'OPTIMIZER',
    name: 'OPTIMIZER',
    icon: '⚡',
    color: '#F59E0B',
    role: 'Performance Optimizer',
    model: 'codellama',
    description: 'Profile and optimize code performance',
    tools: ['code', 'bash', 'file']
  }),
  new Agent({
    id: 'TRANSLATOR',
    name: 'TRANSLATOR',
    icon: '🌐',
    color: '#10B981',
    role: 'Multi-Language Translator',
    model: 'llama3.2',
    description: 'Translate content between 50+ languages',
    tools: ['file', 'web']
  }),
  new Agent({
    id: 'COMPLIANCE',
    name: 'COMPLIANCE',
    icon: '📜',
    color: '#DC2626',
    role: 'Compliance Officer',
    model: 'llama3.2',
    description: 'Ensure regulatory compliance (GDPR, SOC2, HIPAA)',
    tools: ['file', 'web', 'search']
  }),
  new Agent({
    id: 'API_TESTER',
    name: 'API_TESTER',
    icon: '🔌',
    color: '#8B5CF6',
    role: 'API Tester',
    model: 'codellama',
    description: 'Test API endpoints and generate test suites',
    tools: ['code', 'bash', 'web']
  }),
  new Agent({
    id: 'DATABASE',
    name: 'DATABASE',
    icon: '🗃️',
    color: '#0891B2',
    role: 'Database Administrator',
    model: 'codellama',
    description: 'Design schemas, optimize queries, manage migrations',
    tools: ['code', 'bash', 'file']
  })
];

for (const agent of additionalAgents) {
  agent.registerCapability({
    name: 'assist',
    description: 'Provide assistance',
    tools: [],
    execute: async (task, context) => {
      return { assisted: true, agent: agent.name, task };
    }
  });
  agentRegistry.register(agent);
}

export default additionalAgents;
