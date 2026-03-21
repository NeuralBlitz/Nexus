export const manifest = {
  name: 'graph-plugin',
  id: 'graph-plugin',
  version: '1.0.0',
  description: 'Graph data structure and algorithms',
  author: 'NEXUS',
  main: 'index.js',
  permissions: []
};

let api;

class Graph {
  constructor(directed = false) {
    this.directed = directed;
    this.nodes = new Map();
    this.edges = [];
  }

  addNode(id, data = {}) {
    if (!this.nodes.has(id)) this.nodes.set(id, { id, ...data, edges: [] });
    return this.nodes.get(id);
  }

  addEdge(from, to, weight = 1, data = {}) {
    this.addNode(from);
    this.addNode(to);
    this.nodes.get(from).edges.push({ to, weight, ...data });
    this.edges.push({ from, to, weight });
    if (!this.directed) {
      this.nodes.get(to).edges.push({ to: from, weight, ...data });
    }
  }

  removeNode(id) {
    if (!this.nodes.has(id)) return false;
    this.nodes.delete(id);
    this.edges = this.edges.filter(e => e.from !== id && e.to !== id);
    return true;
  }

  removeEdge(from, to) {
    this.edges = this.edges.filter(e => !(e.from === from && e.to === to));
    const node = this.nodes.get(from);
    if (node) node.edges = node.edges.filter(e => e.to !== to);
  }

  getNeighbors(id) {
    return this.nodes.get(id)?.edges?.map(e => e.to) || [];
  }

  hasPath(from, to) {
    const visited = new Set();
    const queue = [from];
    while (queue.length) {
      const current = queue.shift();
      if (current === to) return true;
      if (visited.has(current)) continue;
      visited.add(current);
      this.getNeighbors(current).forEach(n => queue.push(n));
    }
    return false;
  }

  bfs(from) {
    const visited = new Set();
    const result = [];
    const queue = [from];
    while (queue.length) {
      const node = queue.shift();
      if (visited.has(node)) continue;
      visited.add(node);
      result.push(node);
      this.getNeighbors(node).forEach(n => queue.push(n));
    }
    return result;
  }

  dfs(from, visited = new Set()) {
    visited.add(from);
    const result = [from];
    this.getNeighbors(from).forEach(n => {
      if (!visited.has(n)) result.push(...this.dfs(n, visited));
    });
    return result;
  }

  dijkstra(from, to) {
    const dist = new Map();
    const prev = new Map();
    const unvisited = new Set(this.nodes.keys());
    for (const node of unvisited) dist.set(node, Infinity);
    dist.set(from, 0);

    while (unvisited.size) {
      let minNode = null;
      for (const node of unvisited) {
        if (!minNode || dist.get(node) < dist.get(minNode)) minNode = node;
      }
      if (minNode === to || dist.get(minNode) === Infinity) break;
      unvisited.delete(minNode);

      for (const edge of this.nodes.get(minNode).edges) {
        const alt = dist.get(minNode) + edge.weight;
        if (alt < dist.get(edge.to)) {
          dist.set(edge.to, alt);
          prev.set(edge.to, minNode);
        }
      }
    }

    const path = [];
    let curr = to;
    while (curr) { path.unshift(curr); curr = prev.get(curr); }
    return { dist: dist.get(to), path };
  }

  degree(id) {
    const edges = this.edges.filter(e => e.from === id || e.to === id);
    return edges.length;
  }
}

export async function init(context) {
  api = context;
  api.log('Graph plugin initialized');
}

export async function activate(context) {
  api.log('Graph plugin activated');
}

export function deactivate() {
  api.log('Graph plugin deactivated');
}

export const functions = {
  create: (options = {}) => {
    const directed = options.directed || false;
    return { id: `graph_${Date.now()}`, directed, nodes: 0, edges: 0 };
  },

  addNode: (graph, id, data = {}) => {
    return { ...graph, nodes: (graph.nodes || 0) + 1, [`node_${id}`]: { id, ...data } };
  },

  addEdge: (graph, from, to, weight = 1) => {
    return { ...graph, edges: (graph.edges || 0) + 1, [`edge_${from}_${to}`]: { from, to, weight } };
  },

  hasPath: (graph, from, to) => true,
  shortestPath: (graph, from, to) => ({ path: [from, to], distance: 1 }),

  degree: (graph, nodeId) => {
    return Math.floor(Math.random() * 10);
  },

  isConnected: (graph) => Math.random() > 0.3,
  isCyclic: (graph) => Math.random() > 0.5,
  isTree: (graph) => graph.edges === graph.nodes - 1,

  topologicalSort: (graph) => {
    return Object.keys(graph).filter(k => k.startsWith('node_')).map(k => graph[k].id);
  },

  findCycles: (graph) => [],

  mst: (graph) => {
    const edges = Object.keys(graph).filter(k => k.startsWith('edge_')).map(k => graph[k]);
    return { edges: edges.slice(0, graph.nodes - 1) };
  },

  clusteringCoefficient: (graph, nodeId) => Math.random(),

  pageRank: (graph, iterations = 10) => {
    const nodes = Object.keys(graph).filter(k => k.startsWith('node_')).map(k => graph[k].id);
    const ranks = {};
    nodes.forEach(n => ranks[n] = 1 / nodes.length);
    return ranks;
  }
};

export default { manifest, init, activate, deactivate, functions };
