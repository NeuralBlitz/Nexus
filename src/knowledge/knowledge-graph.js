#!/usr/bin/env node

import { EventEmitter } from 'events';
import crypto from 'crypto';

// ═══════════════════════════════════════════════════════════════════════════
// KNOWLEDGE GRAPH
// Entity-Relationship graph for context awareness and reasoning
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Node types
 */
export const NodeType = {
  CONCEPT: 'concept',
  ENTITY: 'entity',
  AGENT: 'agent',
  TASK: 'task',
  PROVIDER: 'provider',
  CHANNEL: 'channel',
  TOOL: 'tool',
  RESOURCE: 'resource',
  EVENT: 'event',
  CUSTOM: 'custom'
};

/**
 * Relationship types
 */
export const RelationType = {
  IS_A: 'is_a',
  HAS_A: 'has_a',
  PART_OF: 'part_of',
  USES: 'uses',
  PRODUCES: 'produces',
  CAUSED_BY: 'caused_by',
  RELATED_TO: 'related_to',
  DEPENDS_ON: 'depends_on',
  CONTRADICTS: 'contradicts',
  SUPPORTS: 'supports',
  CUSTOM: 'custom'
};

/**
 * Graph Node
 */
export class Node {
  constructor(config) {
    this.id = config.id || `node_${crypto.randomBytes(6).toString('hex')}`;
    this.type = config.type || NodeType.CONCEPT;
    this.name = config.name;
    this.description = config.description || '';
    this.properties = config.properties || {};
    this.tags = config.tags || [];
    this.metadata = config.metadata || {};

    // Stats
    this.createdAt = Date.now();
    this.updatedAt = Date.now();
    this.accessCount = 0;
    this.lastAccessed = null;

    // Embedding (for similarity search)
    this.embedding = null;
  }

  /**
   * Update properties
   */
  update(props) {
    Object.assign(this.properties, props);
    this.updatedAt = Date.now();
    return this;
  }

  /**
   * Access the node
   */
  access() {
    this.accessCount++;
    this.lastAccessed = Date.now();
    return this;
  }

  /**
   * Calculate relevance
   */
  getRelevance() {
    const age = Date.now() - this.createdAt;
    const ageHours = age / (1000 * 60 * 60);

    const recencyFactor = Math.exp(-ageHours / 168); // Half-life of 1 week
    const frequencyFactor = Math.min(1, Math.log10(this.accessCount + 1) / 3);

    return 0.3 + 0.3 * recencyFactor + 0.4 * frequencyFactor;
  }

  toJSON() {
    return {
      id: this.id,
      type: this.type,
      name: this.name,
      description: this.description,
      properties: this.properties,
      tags: this.tags,
      createdAt: this.createdAt,
      accessCount: this.accessCount
    };
  }
}

/**
 * Graph Relationship
 */
export class Relationship {
  constructor(config) {
    this.id = config.id || `rel_${crypto.randomBytes(6).toString('hex')}`;
    this.type = config.type || RelationType.RELATED_TO;
    this.source = config.source;
    this.target = config.target;
    this.weight = config.weight || 1.0;
    this.properties = config.properties || {};
    this.description = config.description || '';

    // Stats
    this.createdAt = Date.now();
    this.accessCount = 0;
  }

  /**
   * Access the relationship
   */
  access() {
    this.accessCount++;
    return this;
  }

  toJSON() {
    return {
      id: this.id,
      type: this.type,
      source: this.source,
      target: this.target,
      weight: this.weight,
      properties: this.properties,
      description: this.description
    };
  }
}

/**
 * Knowledge Graph
 */
export class KnowledgeGraph extends EventEmitter {
  constructor() {
    super();

    this.nodes = new Map();
    this.relationships = new Map();

    // Indexes for fast lookup
    this.nodeIndex = new Map(); // type -> Set<nodeId>
    this.tagIndex = new Map();  // tag -> Set<nodeId>
    this.edgeIndex = new Map(); // nodeId -> { incoming: [], outgoing: [] }
  }

  /**
   * Add a node
   */
  addNode(config) {
    const node = config instanceof Node ? config : new Node(config);
    this.nodes.set(node.id, node);

    // Update indexes
    if (!this.nodeIndex.has(node.type)) {
      this.nodeIndex.set(node.type, new Set());
    }
    this.nodeIndex.get(node.type).add(node.id);

    for (const tag of node.tags) {
      if (!this.tagIndex.has(tag)) {
        this.tagIndex.set(tag, new Set());
      }
      this.tagIndex.get(tag).add(node.id);
    }

    // Initialize edge index
    this.edgeIndex.set(node.id, { incoming: [], outgoing: [] });

    this.emit('node:added', node);
    return node;
  }

  /**
   * Get a node
   */
  getNode(nodeId) {
    return this.nodes.get(nodeId);
  }

  /**
   * Update a node
   */
  updateNode(nodeId, updates) {
    const node = this.nodes.get(nodeId);
    if (!node) return null;

    node.update(updates);
    this.emit('node:updated', node);
    return node;
  }

  /**
   * Remove a node
   */
  removeNode(nodeId) {
    const node = this.nodes.get(nodeId);
    if (!node) return false;

    // Remove from indexes
    this.nodeIndex.get(node.type)?.delete(nodeId);
    for (const tag of node.tags) {
      this.tagIndex.get(tag)?.delete(nodeId);
    }

    // Remove all relationships involving this node
    const edges = this.edgeIndex.get(nodeId);
    if (edges) {
      for (const relId of [...edges.incoming, ...edges.outgoing]) {
        this.removeRelationship(relId);
      }
    }

    this.edgeIndex.delete(nodeId);
    this.nodes.delete(nodeId);

    this.emit('node:removed', nodeId);
    return true;
  }

  /**
   * Add a relationship
   */
  addRelationship(config) {
    const rel = config instanceof Relationship ? config : new Relationship(config);

    // Verify both nodes exist
    if (!this.nodes.has(rel.source) || !this.nodes.has(rel.target)) {
      throw new Error('Both source and target nodes must exist');
    }

    this.relationships.set(rel.id, rel);

    // Update edge index
    const sourceEdges = this.edgeIndex.get(rel.source);
    const targetEdges = this.edgeIndex.get(rel.target);

    sourceEdges?.outgoing.push(rel.id);
    targetEdges?.incoming.push(rel.id);

    this.emit('relationship:added', rel);
    return rel;
  }

  /**
   * Get a relationship
   */
  getRelationship(relId) {
    return this.relationships.get(relId);
  }

  /**
   * Remove a relationship
   */
  removeRelationship(relId) {
    const rel = this.relationships.get(relId);
    if (!rel) return false;

    // Update edge index
    const sourceEdges = this.edgeIndex.get(rel.source);
    const targetEdges = this.edgeIndex.get(rel.target);

    if (sourceEdges) {
      sourceEdges.outgoing = sourceEdges.outgoing.filter(id => id !== relId);
    }
    if (targetEdges) {
      targetEdges.incoming = targetEdges.incoming.filter(id => id !== relId);
    }

    this.relationships.delete(relId);
    this.emit('relationship:removed', relId);
    return true;
  }

  /**
   * Get nodes by type
   */
  getNodesByType(type) {
    const ids = this.nodeIndex.get(type) || new Set();
    return Array.from(ids).map(id => this.nodes.get(id)).filter(Boolean);
  }

  /**
   * Get nodes by tag
   */
  getNodesByTag(tag) {
    const ids = this.tagIndex.get(tag) || new Set();
    return Array.from(ids).map(id => this.nodes.get(id)).filter(Boolean);
  }

  /**
   * Search nodes by name/description
   */
  search(query, options = {}) {
    const { type, limit = 20 } = options;
    const queryLower = query.toLowerCase();

    let results = Array.from(this.nodes.values())
      .filter(node => {
        const nameMatch = node.name.toLowerCase().includes(queryLower);
        const descMatch = node.description.toLowerCase().includes(queryLower);
        const tagMatch = node.tags.some(t => t.toLowerCase().includes(queryLower));
        return nameMatch || descMatch || tagMatch;
      });

    if (type) {
      results = results.filter(n => n.type === type);
    }

    // Sort by relevance
    results.sort((a, b) => {
      const aRelevance = a.getRelevance();
      const bRelevance = b.getRelevance();
      return bRelevance - aRelevance;
    });

    return results.slice(0, limit);
  }

  /**
   * Get neighbors of a node
   */
  getNeighbors(nodeId, options = {}) {
    const { relationType, direction = 'both', depth = 1 } = options;

    const visited = new Set();
    const neighbors = [];

    const traverse = (currentId, currentDepth) => {
      if (visited.has(currentId) || currentDepth > depth) return;
      visited.add(currentId);

      const edges = this.edgeIndex.get(currentId);
      if (!edges) return;

      const relIds = direction === 'incoming' ? edges.incoming :
                     direction === 'outgoing' ? edges.outgoing :
                     [...edges.incoming, ...edges.outgoing];

      for (const relId of relIds) {
        const rel = this.relationships.get(relId);
        if (!rel) continue;

        if (relationType && rel.type !== relationType) continue;

        const neighborId = rel.source === currentId ? rel.target : rel.source;
        const neighbor = this.nodes.get(neighborId);

        if (neighbor && !visited.has(neighborId)) {
          neighbors.push({
            node: neighbor,
            relationship: rel,
            distance: currentDepth
          });

          traverse(neighborId, currentDepth + 1);
        }
      }
    };

    traverse(nodeId, 1);
    return neighbors;
  }

  /**
   * Find shortest path between two nodes
   */
  findPath(sourceId, targetId, options = {}) {
    const { maxDepth = 5 } = options;

    if (sourceId === targetId) return { path: [sourceId], length: 0 };

    const queue = [[sourceId]];
    const visited = new Set([sourceId]);

    while (queue.length > 0) {
      const path = queue.shift();
      const current = path[path.length - 1];

      if (path.length > maxDepth) continue;

      const edges = this.edgeIndex.get(current);
      if (!edges) continue;

      const allRels = [...edges.incoming, ...edges.outgoing];

      for (const relId of allRels) {
        const rel = this.relationships.get(relId);
        if (!rel) continue;

        const neighbor = rel.source === current ? rel.target : rel.source;

        if (neighbor === targetId) {
          return {
            path: [...path, neighbor],
            length: path.length,
            relationships: allRels.slice(0, path.length)
          };
        }

        if (!visited.has(neighbor)) {
          visited.add(neighbor);
          queue.push([...path, neighbor]);
        }
      }
    }

    return null; // No path found
  }

  /**
   * Get subgraph around a node
   */
  getSubgraph(nodeId, options = {}) {
    const { radius = 2 } = options;

    const nodes = new Set();
    const relationships = new Set();

    const traverse = (id, depth) => {
      if (depth > radius || nodes.has(id)) return;
      nodes.add(id);

      const edges = this.edgeIndex.get(id);
      if (!edges) return;

      for (const relId of [...edges.incoming, ...edges.outgoing]) {
        if (!relationships.has(relId)) {
          relationships.add(relId);
          const rel = this.relationships.get(relId);
          if (rel) {
            const neighbor = rel.source === id ? rel.target : rel.source;
            traverse(neighbor, depth + 1);
          }
        }
      }
    };

    traverse(nodeId, 0);

    return {
      nodes: Array.from(nodes).map(id => this.nodes.get(id)).filter(Boolean),
      relationships: Array.from(relationships).map(id => this.relationships.get(id)).filter(Boolean)
    };
  }

  /**
   * Get connected components
   */
  getConnectedComponents() {
    const visited = new Set();
    const components = [];

    for (const [nodeId] of this.nodes) {
      if (!visited.has(nodeId)) {
        const component = this.getSubgraph(nodeId, { radius: 100 });
        component.nodes.forEach(n => visited.add(n.id));
        if (component.nodes.length > 0) {
          components.push(component);
        }
      }
    }

    return components;
  }

  /**
   * Get graph statistics
   */
  getStats() {
    const nodeTypes = {};
    const relTypes = {};

    for (const node of this.nodes.values()) {
      nodeTypes[node.type] = (nodeTypes[node.type] || 0) + 1;
    }

    for (const rel of this.relationships.values()) {
      relTypes[rel.type] = (relTypes[rel.type] || 0) + 1;
    }

    const avgConnections = this.nodes.size > 0
      ? Array.from(this.edgeIndex.values()).reduce((sum, e) => sum + e.incoming.length + e.outgoing.length, 0) / this.nodes.size
      : 0;

    return {
      nodes: this.nodes.size,
      relationships: this.relationships.size,
      nodeTypes,
      relationshipTypes: relTypes,
      avgConnections: Math.round(avgConnections * 100) / 100,
      components: this.getConnectedComponents().length
    };
  }

  /**
   * Export graph
   */
  export() {
    return {
      nodes: Array.from(this.nodes.values()).map(n => n.toJSON()),
      relationships: Array.from(this.relationships.values()).map(r => r.toJSON()),
      exportedAt: Date.now()
    };
  }

  /**
   * Import graph
   */
  import(data) {
    for (const nodeData of data.nodes) {
      this.addNode(nodeData);
    }
    for (const relData of data.relationships) {
      this.addRelationship(relData);
    }
    this.emit('graph:imported', { nodes: data.nodes.length, relationships: data.relationships.length });
  }

  /**
   * Clear graph
   */
  clear() {
    this.nodes.clear();
    this.relationships.clear();
    this.nodeIndex.clear();
    this.tagIndex.clear();
    this.edgeIndex.clear();
    this.emit('graph:cleared');
  }

  /**
   * Get all nodes of a specific type
   */
  getNodesByType(type) {
    const index = this.nodeIndex.get(type);
    if (!index) return [];
    return Array.from(index).map(id => this.nodes.get(id)).filter(Boolean);
  }

  /**
   * Get all relationship types between two nodes
   */
  getRelationshipTypes(sourceId, targetId) {
    const types = [];
    for (const rel of this.relationships.values()) {
      if (rel.source === sourceId && rel.target === targetId) types.push(rel.type);
    }
    return [...new Set(types)];
  }

  /**
   * Get strongly connected components (Tarjan's algorithm)
   */
  getStronglyConnectedComponents() {
    const index = new Map();
    const lowlink = new Map();
    const onStack = new Set();
    const stack = [];
    const components = [];
    let idx = 0;

    const strongconnect = (nodeId) => {
      index.set(nodeId, idx);
      lowlink.set(nodeId, idx);
      idx++;
      stack.push(nodeId);
      onStack.add(nodeId);

      const edges = this.edgeIndex.get(nodeId);
      if (edges) {
        for (const relId of edges.outgoing) {
          const rel = this.relationships.get(relId);
          if (!rel) continue;
          const neighbor = rel.target;
          if (!index.has(neighbor)) {
            strongconnect(neighbor);
            lowlink.set(nodeId, Math.min(lowlink.get(nodeId), lowlink.get(neighbor)));
          } else if (onStack.has(neighbor)) {
            lowlink.set(nodeId, Math.min(lowlink.get(nodeId), index.get(neighbor)));
          }
        }
      }

      if (lowlink.get(nodeId) === index.get(nodeId)) {
        const component = [];
        let w;
        do {
          w = stack.pop();
          onStack.delete(w);
          component.push(w);
        } while (w !== nodeId);
        components.push(component);
      }
    };

    for (const nodeId of this.nodes.keys()) {
      if (!index.has(nodeId)) strongconnect(nodeId);
    }

    return components;
  }

  /**
   * Get graph statistics with more detail
   */
  getDetailedStats() {
    const relTypeCounts = {};
    for (const rel of this.relationships.values()) {
      relTypeCounts[rel.type] = (relTypeCounts[rel.type] || 0) + 1;
    }
    const nodeTypeCounts = {};
    for (const node of this.nodes.values()) {
      nodeTypeCounts[node.type] = (nodeTypeCounts[node.type] || 0) + 1;
    }

    return {
      ...this.getStats(),
      nodeTypes: nodeTypeCounts,
      relationshipTypes: relTypeCounts,
      components: this.getStronglyConnectedComponents().length,
      avgDegree: this.nodes.size > 0
        ? (this.relationships.size * 2 / this.nodes.size).toFixed(2)
        : 0
    };
  }

  /**
   * Merge two nodes (move all relationships from source to target)
   */
  mergeNodes(keepId, removeId) {
    const removeNode = this.nodes.get(removeId);
    if (!removeNode) return false;

    // Redirect all relationships
    for (const rel of this.relationships.values()) {
      if (rel.source === removeId) rel.source = keepId;
      if (rel.target === removeId) rel.target = keepId;
    }

    // Merge tags
    const keepNode = this.nodes.get(keepId);
    if (keepNode && removeNode.tags) {
      for (const tag of removeNode.tags) keepNode.addTag(tag);
    }

    this.removeNode(removeId);
    this.emit('node:merged', { kept: keepId, removed: removeId });
    return true;
  }
}

// Export singleton
let graph = null;

export function getKnowledgeGraph() {
  if (!graph) {
    graph = new KnowledgeGraph();
  }
  return graph;
}

export default {
  KnowledgeGraph,
  Node,
  Relationship,
  NodeType,
  RelationType,
  getKnowledgeGraph
};