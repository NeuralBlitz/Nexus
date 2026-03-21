#!/usr/bin/env node

import { EventEmitter } from 'events';
import crypto from 'crypto';

// ═══════════════════════════════════════════════════════════════════════════
// BASE INTEGRATION CLASS
// ═══════════════════════════════════════════════════════════════════════════

export class BaseIntegration extends EventEmitter {
  constructor(config = {}) {
    super();

    this.name = config.name || 'unknown';
    this.type = config.type || 'integration';
    this.apiKey = config.apiKey;
    this.baseUrl = config.baseUrl;
    this.accessToken = config.accessToken;
    this.refreshToken = config.refreshToken;
    this.webhookSecret = config.webhookSecret;

    this.rateLimitRemaining = null;
    this.rateLimitReset = null;

    this.stats = {
      apiCalls: 0,
      errors: 0,
      lastCall: null
    };
  }

  /**
   * Check if integration is configured
   */
  isConfigured() {
    return !!(this.apiKey || this.accessToken);
  }

  /**
   * Make authenticated API request
   */
  async request(endpoint, options = {}) {
    const url = endpoint.startsWith('http') ? endpoint : `${this.baseUrl}${endpoint}`;

    const headers = {
      'Content-Type': 'application/json',
      ...this.getAuthHeaders(),
      ...options.headers
    };

    const response = await fetch(url, {
      ...options,
      headers
    });

    // Track rate limits
    this.rateLimitRemaining = response.headers.get('x-ratelimit-remaining');
    this.rateLimitReset = response.headers.get('x-ratelimit-reset');

    this.stats.apiCalls++;
    this.stats.lastCall = Date.now();

    if (!response.ok) {
      this.stats.errors++;
      const error = await response.text();
      throw new Error(`${this.name} API error: ${response.status} - ${error}`);
    }

    return response.json();
  }

  /**
   * Get auth headers (override in subclass)
   */
  getAuthHeaders() {
    if (this.accessToken) {
      return { 'Authorization': `Bearer ${this.accessToken}` };
    }
    if (this.apiKey) {
      return { 'Authorization': `Bearer ${this.apiKey}` };
    }
    return {};
  }

  /**
   * Get integration status
   */
  getStatus() {
    return {
      name: this.name,
      type: this.type,
      configured: this.isConfigured(),
      stats: this.stats,
      rateLimit: {
        remaining: this.rateLimitRemaining,
        reset: this.rateLimitReset
      }
    };
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// 1. NOTION INTEGRATION
// ═══════════════════════════════════════════════════════════════════════════

export class NotionIntegration extends BaseIntegration {
  constructor(config = {}) {
    super({
      ...config,
      name: 'notion',
      type: 'productivity',
      baseUrl: 'https://api.notion.com/v1'
    });

    this.version = config.version || '2022-06-28';
  }

  getAuthHeaders() {
    return {
      'Authorization': `Bearer ${this.apiKey}`,
      'Notion-Version': this.version
    };
  }

  // Pages
  async getPage(pageId) {
    return this.request(`/pages/${pageId}`);
  }

  async createPage(parent, properties, children = []) {
    return this.request('/pages', {
      method: 'POST',
      body: JSON.stringify({ parent, properties, children })
    });
  }

  async updatePage(pageId, properties) {
    return this.request(`/pages/${pageId}`, {
      method: 'PATCH',
      body: JSON.stringify({ properties })
    });
  }

  async archivePage(pageId) {
    return this.request(`/pages/${pageId}`, {
      method: 'PATCH',
      body: JSON.stringify({ archived: true })
    });
  }

  // Databases
  async getDatabase(databaseId) {
    return this.request(`/databases/${databaseId}`);
  }

  async queryDatabase(databaseId, filter = null, sorts = [], startCursor = null, pageSize = 100) {
    const body = { page_size: pageSize };
    if (filter) body.filter = filter;
    if (sorts.length) body.sorts = sorts;
    if (startCursor) body.start_cursor = startCursor;

    return this.request(`/databases/${databaseId}/query`, {
      method: 'POST',
      body: JSON.stringify(body)
    });
  }

  async createDatabase(parent, title, properties) {
    return this.request('/databases', {
      method: 'POST',
      body: JSON.stringify({ parent, title, properties })
    });
  }

  async updateDatabase(databaseId, properties) {
    return this.request(`/databases/${databaseId}`, {
      method: 'PATCH',
      body: JSON.stringify({ properties })
    });
  }

  // Blocks
  async getBlock(blockId) {
    return this.request(`/blocks/${blockId}`);
  }

  async getBlockChildren(blockId, startCursor = null, pageSize = 100) {
    const params = new URLSearchParams({ page_size: pageSize });
    if (startCursor) params.append('start_cursor', startCursor);
    return this.request(`/blocks/${blockId}/children?${params}`);
  }

  async appendBlockChildren(blockId, children) {
    return this.request(`/blocks/${blockId}/children`, {
      method: 'PATCH',
      body: JSON.stringify({ children })
    });
  }

  async deleteBlock(blockId) {
    return this.request(`/blocks/${blockId}`, {
      method: 'DELETE'
    });
  }

  // Search
  async search(query, filter = null) {
    const body = { query };
    if (filter) body.filter = filter;
    return this.request('/search', {
      method: 'POST',
      body: JSON.stringify(body)
    });
  }

  // Users
  async getUsers() {
    return this.request('/users');
  }

  async getUser(userId) {
    return this.request(`/users/${userId}`);
  }

  // Comments
  async getComments(blockId) {
    return this.request(`/comments?block_id=${blockId}`);
  }

  async createComment(blockId, richText) {
    return this.request('/comments', {
      method: 'POST',
      body: JSON.stringify({
        parent: { block_id: blockId },
        rich_text: richText
      })
    });
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// 2. CANVA INTEGRATION
// ═══════════════════════════════════════════════════════════════════════════

export class CanvaIntegration extends BaseIntegration {
  constructor(config = {}) {
    super({
      ...config,
      name: 'canva',
      type: 'design',
      baseUrl: 'https://api.canva.com/rest/v1'
    });
  }

  getAuthHeaders() {
    return {
      'Authorization': `Bearer ${this.accessToken}`
    };
  }

  // Designs
  async getDesign(designId) {
    return this.request(`/designs/${designId}`);
  }

  async listDesigns(queries = [], ownership = 'owned', limit = 100) {
    return this.request('/designs', {
      method: 'POST',
      body: JSON.stringify({ queries, ownership, limit })
    });
  }

  async createDesign(designType, designProperties = {}) {
    return this.request('/designs', {
      method: 'POST',
      body: JSON.stringify({
        design_type: designType,
        ...designProperties
      })
    });
  }

  async duplicateDesign(designId, title) {
    return this.request(`/designs/${designId}/duplicate`, {
      method: 'POST',
      body: JSON.stringify({ title })
    });
  }

  async exportDesign(designId, format, pages = []) {
    return this.request(`/designs/${designId}/export`, {
      method: 'POST',
      body: JSON.stringify({
        format_type: format,
        pages
      })
    });
  }

  // Assets
  async getAsset(assetId) {
    return this.request(`/assets/${assetId}`);
  }

  async importAsset(uploadUrl, name, type = 'image') {
    return this.request('/assets', {
      method: 'POST',
      body: JSON.stringify({
        upload_url: uploadUrl,
        name,
        asset_type: type
      })
    });
  }

  // Folders
  async listFolders(parentFolderId = null) {
    const params = parentFolderId ? `?parent_folder_id=${parentFolderId}` : '';
    return this.request(`/folders${params}`);
  }

  async createFolder(name, parentFolderId = null) {
    return this.request('/folders', {
      method: 'POST',
      body: JSON.stringify({ name, parent_folder_id: parentFolderId })
    });
  }

  async getFolder(folderId) {
    return this.request(`/folders/${folderId}`);
  }

  // Brand Templates
  async listBrandTemplates(query = '', limit = 100) {
    return this.request('/brand-templates', {
      method: 'POST',
      body: JSON.stringify({ query, limit })
    });
  }

  async getBrandTemplate(templateId) {
    return this.request(`/brand-templates/${templateId}`);
  }

  // Autofill
  async autofillDesign(designId, data) {
    return this.request(`/designs/${designId}/autofill`, {
      method: 'POST',
      body: JSON.stringify({ data })
    });
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// 3. FIGMA INTEGRATION
// ═══════════════════════════════════════════════════════════════════════════

export class FigmaIntegration extends BaseIntegration {
  constructor(config = {}) {
    super({
      ...config,
      name: 'figma',
      type: 'design',
      baseUrl: 'https://api.figma.com/v1'
    });
  }

  getAuthHeaders() {
    return {
      'X-Figma-Token': this.apiKey
    };
  }

  // Files
  async getFile(fileKey, depth = null, geometry = null) {
    const params = new URLSearchParams();
    if (depth) params.append('depth', depth);
    if (geometry) params.append('geometry', geometry);
    return this.request(`/files/${fileKey}?${params}`);
  }

  async getFileNodes(fileKey, ids, depth = null) {
    const params = new URLSearchParams({ ids: ids.join(',') });
    if (depth) params.append('depth', depth);
    return this.request(`/files/${fileKey}/nodes?${params}`);
  }

  async getImages(fileKey, options = {}) {
    const params = new URLSearchParams({
      ids: options.ids?.join(',') || '',
      format: options.format || 'png',
      scale: options.scale || 1
    });
    if (options.svg_include_id) params.append('svg_include_id', 'true');
    if (options.svg_simplify_stroke) params.append('svg_simplify_stroke', 'true');
    return this.request(`/images/${fileKey}?${params}`);
  }

  // Projects
  async getProjectFiles(projectKey) {
    return this.request(`/projects/${projectKey}/files`);
  }

  // Team Projects
  async getTeamProjects(teamId) {
    return this.request(`/teams/${teamId}/projects`);
  }

  // Components
  async getComponent(componentKey) {
    return this.request(`/components/${componentKey}`);
  }

  async getComponentSets(teamId) {
    return this.request(`/teams/${teamId}/component_sets`);
  }

  // Styles
  async getStyles(teamId) {
    return this.request(`/teams/${teamId}/styles`);
  }

  // Users
  async getMe() {
    return this.request('/me');
  }

  // Webhooks
  async createWebhook(eventType, teamId, endpoint, passcode) {
    return this.request('/v2/webhooks', {
      method: 'POST',
      body: JSON.stringify({
        event_type: eventType,
        team_id: teamId,
        endpoint,
        passcode
      })
    });
  }

  async getWebhooks(teamId) {
    return this.request(`/v2/webhooks/teams/${teamId}`);
  }

  async deleteWebhook(webhookId) {
    return this.request(`/v2/webhooks/${webhookId}`, {
      method: 'DELETE'
    });
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// 4. LINEAR INTEGRATION
// ═══════════════════════════════════════════════════════════════════════════

export class LinearIntegration extends BaseIntegration {
  constructor(config = {}) {
    super({
      ...config,
      name: 'linear',
      type: 'project_management',
      baseUrl: 'https://api.linear.app/graphql'
    });

    this.graphqlEndpoint = 'https://api.linear.app/graphql';
  }

  getAuthHeaders() {
    return {
      'Authorization': this.apiKey,
      'Content-Type': 'application/json'
    };
  }

  // GraphQL query helper
  async query(query, variables = {}) {
    const response = await fetch(this.graphqlEndpoint, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify({ query, variables })
    });

    this.stats.apiCalls++;

    if (!response.ok) {
      this.stats.errors++;
      throw new Error(`Linear API error: ${response.status}`);
    }

    const result = await response.json();
    if (result.errors) {
      throw new Error(`GraphQL error: ${result.errors[0].message}`);
    }

    return result.data;
  }

  // Issues
  async getIssue(issueId) {
    return this.query(`
      query GetIssue($id: String!) {
        issue(id: $id) {
          id
          identifier
          title
          description
          priority
          state { id name color }
          assignee { id name email }
          team { id name key }
          labels { nodes { id name color } }
          createdAt
          updatedAt
          dueDate
        }
      }
    `, { id: issueId });
  }

  async createIssue(input) {
    return this.query(`
      mutation CreateIssue($input: IssueCreateInput!) {
        issueCreate(input: $input) {
          success
          issue {
            id
            identifier
            title
          }
        }
      }
    `, { input });
  }

  async updateIssue(id, input) {
    return this.query(`
      mutation UpdateIssue($id: String!, $input: IssueUpdateInput!) {
        issueUpdate(id: $id, input: $input) {
          success
          issue {
            id
            identifier
            title
          }
        }
      }
    `, { id, input });
  }

  async deleteIssue(id) {
    return this.query(`
      mutation DeleteIssue($id: String!) {
        issueDelete(id: $id) {
          success
        }
      }
    `, { id });
  }

  async listIssues(filter = {}, first = 50) {
    return this.query(`
      query ListIssues($filter: IssueFilter, $first: Int) {
        issues(filter: $filter, first: $first) {
          nodes {
            id
            identifier
            title
            priority
            state { id name }
            assignee { id name }
            createdAt
          }
          pageInfo { hasNextPage endCursor }
        }
      }
    `, { filter, first });
  }

  // Teams
  async getTeams() {
    return this.query(`
      query GetTeams {
        teams {
          nodes {
            id
            name
            key
            members { nodes { id name email } }
          }
        }
      }
    `);
  }

  // Projects
  async getProjects() {
    return this.query(`
      query GetProjects {
        projects {
          nodes {
            id
            name
            description
            state
            teams { nodes { id name } }
          }
        }
      }
    `);
  }

  async createProject(input) {
    return this.query(`
      mutation CreateProject($input: ProjectCreateInput!) {
        projectCreate(input: $input) {
          success
          project { id name }
        }
      }
    `, { input });
  }

  // Comments
  async createComment(issueId, body) {
    return this.query(`
      mutation CreateComment($input: CommentCreateInput!) {
        commentCreate(input: $input) {
          success
          comment { id body }
        }
      }
    `, { input: { issueId, body } });
  }

  // Workflow States
  async getWorkflowStates(teamId) {
    return this.query(`
      query GetWorkflowStates($teamId: String!) {
        workflowStates(filter: { team: { id: { eq: $teamId } } }) {
          nodes { id name color type }
        }
      }
    `, { teamId });
  }

  // Labels
  async getLabels(teamId) {
    return this.query(`
      query GetLabels($teamId: String!) {
        issueLabels(filter: { team: { id: { eq: $teamId } } }) {
          nodes { id name color description }
        }
      }
    `, { teamId });
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// 5. JIRA INTEGRATION
// ═══════════════════════════════════════════════════════════════════════════

export class JiraIntegration extends BaseIntegration {
  constructor(config = {}) {
    super({
      ...config,
      name: 'jira',
      type: 'project_management',
      baseUrl: config.cloudId 
        ? `https://api.atlassian.com/ex/jira/${config.cloudId}`
        : `https://${config.domain}.atlassian.net`
    });

    this.email = config.email;
    this.domain = config.domain;
  }

  getAuthHeaders() {
    if (this.apiKey && this.email) {
      // Basic auth for Jira Cloud
      const credentials = Buffer.from(`${this.email}:${this.apiKey}`).toString('base64');
      return { 'Authorization': `Basic ${credentials}` };
    }
    return { 'Authorization': `Bearer ${this.accessToken}` };
  }

  // Issues
  async getIssue(issueKey, fields = null, expand = null) {
    const params = new URLSearchParams();
    if (fields) params.append('fields', fields);
    if (expand) params.append('expand', expand);
    return this.request(`/rest/api/3/issue/${issueKey}?${params}`);
  }

  async createIssue(projectKey, issueType, summary, description = null, fields = {}) {
    const body = {
      fields: {
        project: { key: projectKey },
        issuetype: { name: issueType },
        summary,
        ...fields
      }
    };
    if (description) {
      body.fields.description = {
        type: 'doc',
        version: 1,
        content: [{
          type: 'paragraph',
          content: [{ type: 'text', text: description }]
        }]
      };
    }

    return this.request('/rest/api/3/issue', {
      method: 'POST',
      body: JSON.stringify(body)
    });
  }

  async updateIssue(issueKey, fields) {
    return this.request(`/rest/api/3/issue/${issueKey}`, {
      method: 'PUT',
      body: JSON.stringify({ fields })
    });
  }

  async deleteIssue(issueKey) {
    return this.request(`/rest/api/3/issue/${issueKey}`, {
      method: 'DELETE'
    });
  }

  async searchIssues(jql, fields = ['summary', 'status', 'assignee'], startAt = 0, maxResults = 50) {
    return this.request('/rest/api/3/search', {
      method: 'POST',
      body: JSON.stringify({
        jql,
        fields,
        startAt,
        maxResults
      })
    });
  }

  // Projects
  async getProjects() {
    return this.request('/rest/api/3/project');
  }

  async getProject(projectKey) {
    return this.request(`/rest/api/3/project/${projectKey}`);
  }

  // Issue Types
  async getIssueTypes() {
    return this.request('/rest/api/3/issuetype');
  }

  // Transitions
  async getTransitions(issueKey) {
    return this.request(`/rest/api/3/issue/${issueKey}/transitions`);
  }

  async transitionIssue(issueKey, transitionId) {
    return this.request(`/rest/api/3/issue/${issueKey}/transitions`, {
      method: 'POST',
      body: JSON.stringify({
        transition: { id: transitionId }
      })
    });
  }

  // Comments
  async getComments(issueKey) {
    return this.request(`/rest/api/3/issue/${issueKey}/comment`);
  }

  async addComment(issueKey, body) {
    return this.request(`/rest/api/3/issue/${issueKey}/comment`, {
      method: 'POST',
      body: JSON.stringify({
        body: {
          type: 'doc',
          version: 1,
          content: [{
            type: 'paragraph',
            content: [{ type: 'text', text: body }]
          }]
        }
      })
    });
  }

  // Users
  async getCurrentUser() {
    return this.request('/rest/api/3/myself');
  }

  async searchUsers(query) {
    return this.request(`/rest/api/3/user/search?query=${encodeURIComponent(query)}`);
  }

  // Boards (Agile)
  async getBoards() {
    return this.request('/rest/agile/1.0/board');
  }

  async getBoardSprints(boardId) {
    return this.request(`/rest/agile/1.0/board/${boardId}/sprint`);
  }

  // Webhooks
  async getWebhooks() {
    return this.request('/rest/api/3/webhook');
  }

  async registerWebhook(url, events) {
    return this.request('/rest/api/3/webhook', {
      method: 'POST',
      body: JSON.stringify({ url, events })
    });
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// 6. TRELLO INTEGRATION
// ═══════════════════════════════════════════════════════════════════════════

export class TrelloIntegration extends BaseIntegration {
  constructor(config = {}) {
    super({
      ...config,
      name: 'trello',
      type: 'project_management',
      baseUrl: 'https://api.trello.com/1'
    });

    this.appKey = config.appKey || config.apiKey;
    this.token = config.token || config.accessToken;
  }

  isConfigured() {
    return !!(this.appKey && this.token);
  }

  getAuthHeaders() {
    return {}; // Trello uses query params for auth
  }

  _authParams(params = {}) {
    return {
      key: this.appKey,
      token: this.token,
      ...params
    };
  }

  async request(endpoint, options = {}) {
    const url = new URL(`${this.baseUrl}${endpoint}`);
    const authParams = this._authParams();
    
    for (const [key, value] of Object.entries(authParams)) {
      url.searchParams.append(key, value);
    }

    const response = await fetch(url.toString(), {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      }
    });

    this.stats.apiCalls++;

    if (!response.ok) {
      this.stats.errors++;
      throw new Error(`Trello API error: ${response.status}`);
    }

    return response.json();
  }

  // Boards
  async getBoard(boardId) {
    return this.request(`/boards/${boardId}`);
  }

  async createBoard(name, desc = '', defaultLists = true) {
    return this.request('/boards', {
      method: 'POST',
      body: JSON.stringify({ name, desc, defaultLists })
    });
  }

  async updateBoard(boardId, fields) {
    return this.request(`/boards/${boardId}`, {
      method: 'PUT',
      body: JSON.stringify(fields)
    });
  }

  async deleteBoard(boardId) {
    return this.request(`/boards/${boardId}`, {
      method: 'DELETE'
    });
  }

  async getBoardLists(boardId, filter = 'all') {
    return this.request(`/boards/${boardId}/lists`, {
      query: { filter }
    });
  }

  async getBoardCards(boardId, filter = 'all') {
    return this.request(`/boards/${boardId}/cards`, {
      query: { filter }
    });
  }

  async getBoardMembers(boardId) {
    return this.request(`/boards/${boardId}/members`);
  }

  // Lists
  async getList(listId) {
    return this.request(`/lists/${listId}`);
  }

  async createList(name, boardId, pos = 'bottom') {
    return this.request('/lists', {
      method: 'POST',
      body: JSON.stringify({ name, idBoard: boardId, pos })
    });
  }

  async updateList(listId, fields) {
    return this.request(`/lists/${listId}`, {
      method: 'PUT',
      body: JSON.stringify(fields)
    });
  }

  async archiveList(listId) {
    return this.request(`/lists/${listId}/closed`, {
      method: 'PUT',
      body: JSON.stringify({ value: true })
    });
  }

  // Cards
  async getCard(cardId) {
    return this.request(`/cards/${cardId}`);
  }

  async createCard(name, listId, desc = '', pos = 'bottom', due = null) {
    const body = { name, idList: listId, desc, pos };
    if (due) body.due = due;
    return this.request('/cards', {
      method: 'POST',
      body: JSON.stringify(body)
    });
  }

  async updateCard(cardId, fields) {
    return this.request(`/cards/${cardId}`, {
      method: 'PUT',
      body: JSON.stringify(fields)
    });
  }

  async deleteCard(cardId) {
    return this.request(`/cards/${cardId}`, {
      method: 'DELETE'
    });
  }

  async moveCard(cardId, listId, pos) {
    return this.request(`/cards/${cardId}`, {
      method: 'PUT',
      body: JSON.stringify({ idList: listId, pos })
    });
  }

  async getCardComments(cardId) {
    return this.request(`/cards/${cardId}/actions`, {
      query: { filter: 'commentCard' }
    });
  }

  async addCardComment(cardId, text) {
    return this.request(`/cards/${cardId}/actions/comments`, {
      method: 'POST',
      body: JSON.stringify({ text })
    });
  }

  async getCardChecklists(cardId) {
    return this.request(`/cards/${cardId}/checklists`);
  }

  async addCardChecklist(cardId, name) {
    return this.request(`/cards/${cardId}/checklists`, {
      method: 'POST',
      body: JSON.stringify({ name })
    });
  }

  async addCardAttachment(cardId, name, url) {
    return this.request(`/cards/${cardId}/attachments`, {
      method: 'POST',
      body: JSON.stringify({ name, url })
    });
  }

  // Labels
  async getBoardLabels(boardId) {
    return this.request(`/boards/${boardId}/labels`);
  }

  async createLabel(boardId, name, color) {
    return this.request('/labels', {
      method: 'POST',
      body: JSON.stringify({ name, color, idBoard: boardId })
    });
  }

  async addLabelToCard(cardId, labelId) {
    return this.request(`/cards/${cardId}/idLabels`, {
      method: 'POST',
      body: JSON.stringify({ value: labelId })
    });
  }

  // Members
  async getMember(memberId) {
    return this.request(`/members/${memberId}`);
  }

  async addMemberToBoard(boardId, memberEmail) {
    return this.request(`/boards/${boardId}/members`, {
      method: 'PUT',
      body: JSON.stringify({ email: memberEmail })
    });
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// 7. AIRTABLE INTEGRATION
// ═══════════════════════════════════════════════════════════════════════════

export class AirtableIntegration extends BaseIntegration {
  constructor(config = {}) {
    super({
      ...config,
      name: 'airtable',
      type: 'database',
      baseUrl: 'https://api.airtable.com/v0'
    });
  }

  getAuthHeaders() {
    return {
      'Authorization': `Bearer ${this.apiKey}`
    };
  }

  // Records
  async getRecord(baseId, tableIdOrName, recordId) {
    return this.request(`/${baseId}/${tableIdOrName}/${recordId}`);
  }

  async listRecords(baseId, tableIdOrName, options = {}) {
    const params = new URLSearchParams();
    if (options.fields) options.fields.forEach(f => params.append('fields[]', f));
    if (options.filterByFormula) params.append('filterByFormula', options.filterByFormula);
    if (options.sort) options.sort.forEach((s, i) => {
      params.append(`sort[${i}][field]`, s.field);
      params.append(`sort[${i}][direction]`, s.direction || 'asc');
    });
    if (options.maxRecords) params.append('maxRecords', options.maxRecords);
    if (options.pageSize) params.append('pageSize', options.pageSize);
    if (options.view) params.append('view', options.view);

    return this.request(`/${baseId}/${tableIdOrName}?${params}`);
  }

  async createRecord(baseId, tableIdOrName, fields) {
    return this.request(`/${baseId}/${tableIdOrName}`, {
      method: 'POST',
      body: JSON.stringify({ fields })
    });
  }

  async createRecords(baseId, tableIdOrName, records) {
    return this.request(`/${baseId}/${tableIdOrName}`, {
      method: 'POST',
      body: JSON.stringify({ records })
    });
  }

  async updateRecord(baseId, tableIdOrName, recordId, fields) {
    return this.request(`/${baseId}/${tableIdOrName}/${recordId}`, {
      method: 'PATCH',
      body: JSON.stringify({ fields })
    });
  }

  async updateRecords(baseId, tableIdOrName, records) {
    return this.request(`/${baseId}/${tableIdOrName}`, {
      method: 'PATCH',
      body: JSON.stringify({ records })
    });
  }

  async replaceRecord(baseId, tableIdOrName, recordId, fields) {
    return this.request(`/${baseId}/${tableIdOrName}/${recordId}`, {
      method: 'PUT',
      body: JSON.stringify({ fields })
    });
  }

  async deleteRecord(baseId, tableIdOrName, recordId) {
    return this.request(`/${baseId}/${tableIdOrName}/${recordId}`, {
      method: 'DELETE'
    });
  }

  async deleteRecords(baseId, tableIdOrName, recordIds) {
    return this.request(`/${baseId}/${tableIdOrName}`, {
      method: 'DELETE',
      body: JSON.stringify({ records: recordIds.map(id => ({ id })) })
    });
  }

  // Search
  async searchRecords(baseId, tableIdOrName, query, options = {}) {
    const params = new URLSearchParams({
      query,
      ...options
    });
    return this.request(`/${baseId}/${tableIdOrName}/listRecords?${params}`);
  }

  // Bases
  async listBases() {
    return this.request('/meta/bases');
  }

  async getBaseSchema(baseId) {
    return this.request(`/meta/bases/${baseId}/tables`);
  }

  // Webhooks
  async createWebhook(baseId, notificationUrl, options = {}) {
    return this.request(`/bases/${baseId}/webhooks`, {
      method: 'POST',
      body: JSON.stringify({
        notificationUrl,
        ...options
      })
    });
  }

  async listWebhooks(baseId) {
    return this.request(`/bases/${baseId}/webhooks`);
  }

  async refreshWebhook(baseId, webhookId) {
    return this.request(`/bases/${baseId}/webhooks/${webhookId}/refresh`, {
      method: 'POST'
    });
  }

  async deleteWebhook(baseId, webhookId) {
    return this.request(`/bases/${baseId}/webhooks/${webhookId}`, {
      method: 'DELETE'
    });
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// 8. GOOGLE WORKSPACE INTEGRATION
// ═══════════════════════════════════════════════════════════════════════════

export class GoogleWorkspaceIntegration extends BaseIntegration {
  constructor(config = {}) {
    super({
      ...config,
      name: 'google',
      type: 'productivity'
    });

    this.clientId = config.clientId;
    this.clientSecret = config.clientSecret;
  }

  // Google Docs
  async getDocument(documentId) {
    return this.request(`https://docs.googleapis.com/v1/documents/${documentId}`);
  }

  async createDocument(title) {
    return this.request('https://docs.googleapis.com/v1/documents', {
      method: 'POST',
      body: JSON.stringify({ title })
    });
  }

  async batchUpdateDocument(documentId, requests) {
    return this.request(`https://docs.googleapis.com/v1/documents/${documentId}:batchUpdate`, {
      method: 'POST',
      body: JSON.stringify({ requests })
    });
  }

  // Google Sheets
  async getSpreadsheet(spreadsheetId, ranges = [], includeGridData = false) {
    const params = new URLSearchParams();
    ranges.forEach(r => params.append('ranges', r));
    if (includeGridData) params.append('includeGridData', 'true');
    return this.request(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?${params}`);
  }

  async createSpreadsheet(title, sheets = []) {
    return this.request('https://sheets.googleapis.com/v4/spreadsheets', {
      method: 'POST',
      body: JSON.stringify({
        properties: { title },
        sheets: sheets.map(name => ({ properties: { title: name } }))
      })
    });
  }

  async getValues(spreadsheetId, range) {
    return this.request(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}`);
  }

  async updateValues(spreadsheetId, range, values, valueInputOption = 'USER_ENTERED') {
    return this.request(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}?valueInputOption=${valueInputOption}`,
      {
        method: 'PUT',
        body: JSON.stringify({ values })
      }
    );
  }

  async appendValues(spreadsheetId, range, values, valueInputOption = 'USER_ENTERED') {
    return this.request(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}:append?valueInputOption=${valueInputOption}`,
      {
        method: 'POST',
        body: JSON.stringify({ values })
      }
    );
  }

  // Google Drive
  async listFiles(query = '', pageSize = 100, pageToken = null) {
    const params = new URLSearchParams({ pageSize });
    if (query) params.append('q', query);
    if (pageToken) params.append('pageToken', pageToken);
    return this.request(`https://www.googleapis.com/drive/v3/files?${params}`);
  }

  async getFile(fileId) {
    return this.request(`https://www.googleapis.com/drive/v3/files/${fileId}`);
  }

  async createFile(name, mimeType, parents = [], content = null) {
    const metadata = { name, mimeType, parents };
    
    if (content) {
      // Multipart upload
      const boundary = crypto.randomBytes(16).toString('hex');
      const body = [
        `--${boundary}`,
        'Content-Type: application/json',
        '',
        JSON.stringify(metadata),
        `--${boundary}`,
        `Content-Type: ${mimeType}`,
        '',
        content,
        `--${boundary}--`
      ].join('\r\n');

      return this.request('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
        method: 'POST',
        headers: {
          'Content-Type': `multipart/related; boundary=${boundary}`
        },
        body
      });
    }

    return this.request('https://www.googleapis.com/drive/v3/files', {
      method: 'POST',
      body: JSON.stringify(metadata)
    });
  }

  async updateFile(fileId, metadata) {
    return this.request(`https://www.googleapis.com/drive/v3/files/${fileId}`, {
      method: 'PATCH',
      body: JSON.stringify(metadata)
    });
  }

  async deleteFile(fileId) {
    return this.request(`https://www.googleapis.com/drive/v3/files/${fileId}`, {
      method: 'DELETE'
    });
  }

  async downloadFile(fileId) {
    return this.request(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`);
  }

  // Gmail
  async listMessages(query = '', maxResults = 100) {
    const params = new URLSearchParams({ maxResults });
    if (query) params.append('q', query);
    return this.request(`https://gmail.googleapis.com/gmail/v1/users/me/messages?${params}`);
  }

  async getMessage(messageId) {
    return this.request(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}`);
  }

  async sendEmail(to, subject, body) {
    const raw = Buffer.from(
      `To: ${to}\r\nSubject: ${subject}\r\nContent-Type: text/plain\r\n\r\n${body}`
    ).toString('base64url');

    return this.request('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
      method: 'POST',
      body: JSON.stringify({ raw })
    });
  }

  async getLabels() {
    return this.request('https://gmail.googleapis.com/gmail/v1/users/me/labels');
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// 9. SALESFORCE INTEGRATION
// ═══════════════════════════════════════════════════════════════════════════

export class SalesforceIntegration extends BaseIntegration {
  constructor(config = {}) {
    super({
      ...config,
      name: 'salesforce',
      type: 'crm'
    });

    this.instanceUrl = config.instanceUrl;
    this.version = config.version || 'v60.0';
  }

  getAuthHeaders() {
    return {
      'Authorization': `Bearer ${this.accessToken}`,
      'Content-Type': 'application/json'
    };
  }

  async request(endpoint, options = {}) {
    const url = endpoint.startsWith('http') 
      ? endpoint 
      : `${this.instanceUrl}/services/data/${this.version}${endpoint}`;

    const response = await fetch(url, {
      ...options,
      headers: this.getAuthHeaders()
    });

    this.stats.apiCalls++;

    if (!response.ok) {
      this.stats.errors++;
      const error = await response.json();
      throw new Error(`Salesforce API error: ${error.message || response.status}`);
    }

    if (response.status === 204) return null;
    return response.json();
  }

  // OAuth
  async authenticate(username, password, securityToken, clientId, clientSecret) {
    const params = new URLSearchParams({
      grant_type: 'password',
      client_id: clientId,
      client_secret: clientSecret,
      username,
      password: password + securityToken
    });

    const response = await fetch(`${this.instanceUrl}/services/oauth2/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params
    });

    const data = await response.json();
    this.accessToken = data.access_token;
    this.instanceUrl = data.instance_url;

    return data;
  }

  // CRUD Operations
  async query(soql) {
    return this.request(`/query?q=${encodeURIComponent(soql)}`);
  }

  async queryAll(soql) {
    return this.request(`/queryAll?q=${encodeURIComponent(soql)}`);
  }

  async create(sobjectType, record) {
    return this.request(`/sobjects/${sobjectType}`, {
      method: 'POST',
      body: JSON.stringify(record)
    });
  }

  async get(sobjectType, id) {
    return this.request(`/sobjects/${sobjectType}/${id}`);
  }

  async update(sobjectType, id, record) {
    return this.request(`/sobjects/${sobjectType}/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(record)
    });
  }

  async delete(sobjectType, id) {
    return this.request(`/sobjects/${sobjectType}/${id}`, {
      method: 'DELETE'
    });
  }

  // Search
  async search(sosl) {
    return this.request(`/search?q=${encodeURIComponent(sosl)}`);
  }

  // Metadata
  async describe(sobjectType) {
    return this.request(`/sobjects/${sobjectType}/describe`);
  }

  async describeGlobal() {
    return this.request('/sobjects');
  }

  // Composite
  async composite(requests, allOrNone = false) {
    return this.request('/composite', {
      method: 'POST',
      body: JSON.stringify({
        allOrNone,
        records: requests
      })
    });
  }

  // Chatter
  async getFeedElements(feedId) {
    return this.request(`/feed-elements?feedElementType=FeedItem&feedId=${feedId}`);
  }

  async postToFeed(feedId, body) {
    return this.request('/feed-elements', {
      method: 'POST',
      body: JSON.stringify({
        body,
        feedElementType: 'FeedItem',
        subjectId: feedId
      })
    });
  }

  // Bulk API
  async createBulkJob(objectType, operation, content) {
    return this.request(`/jobs/ingest`, {
      method: 'POST',
      body: JSON.stringify({
        object: objectType,
        operation,
        contentType: content
      })
    });
  }

  async getBulkJob(jobId) {
    return this.request(`/jobs/ingest/${jobId}`);
  }

  async closeBulkJob(jobId) {
    return this.request(`/jobs/ingest/${jobId}`, {
      method: 'PATCH',
      body: JSON.stringify({ state: 'UploadComplete' })
    });
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// 10. HUBSPOT INTEGRATION
// ═══════════════════════════════════════════════════════════════════════════

export class HubSpotIntegration extends BaseIntegration {
  constructor(config = {}) {
    super({
      ...config,
      name: 'hubspot',
      type: 'crm',
      baseUrl: 'https://api.hubapi.com'
    });
  }

  getAuthHeaders() {
    return {
      'Authorization': `Bearer ${this.accessToken}`
    };
  }

  // Contacts
  async getContact(contactId, properties = []) {
    const params = new URLSearchParams();
    if (properties.length) params.append('properties', properties.join(','));
    return this.request(`/crm/v3/objects/contacts/${contactId}?${params}`);
  }

  async listContacts(properties = [], limit = 100, after = null) {
    const params = new URLSearchParams({ limit });
    if (properties.length) params.append('properties', properties.join(','));
    if (after) params.append('after', after);
    return this.request(`/crm/v3/objects/contacts?${params}`);
  }

  async createContact(properties) {
    return this.request('/crm/v3/objects/contacts', {
      method: 'POST',
      body: JSON.stringify({ properties })
    });
  }

  async updateContact(contactId, properties) {
    return this.request(`/crm/v3/objects/contacts/${contactId}`, {
      method: 'PATCH',
      body: JSON.stringify({ properties })
    });
  }

  async deleteContact(contactId) {
    return this.request(`/crm/v3/objects/contacts/${contactId}`, {
      method: 'DELETE'
    });
  }

  async searchContacts(filterGroups = [], properties = [], limit = 100) {
    return this.request('/crm/v3/objects/contacts/search', {
      method: 'POST',
      body: JSON.stringify({ filterGroups, properties, limit })
    });
  }

  // Companies
  async getCompany(companyId, properties = []) {
    const params = new URLSearchParams();
    if (properties.length) params.append('properties', properties.join(','));
    return this.request(`/crm/v3/objects/companies/${companyId}?${params}`);
  }

  async listCompanies(properties = [], limit = 100, after = null) {
    const params = new URLSearchParams({ limit });
    if (properties.length) params.append('properties', properties.join(','));
    if (after) params.append('after', after);
    return this.request(`/crm/v3/objects/companies?${params}`);
  }

  async createCompany(properties) {
    return this.request('/crm/v3/objects/companies', {
      method: 'POST',
      body: JSON.stringify({ properties })
    });
  }

  async updateCompany(companyId, properties) {
    return this.request(`/crm/v3/objects/companies/${companyId}`, {
      method: 'PATCH',
      body: JSON.stringify({ properties })
    });
  }

  // Deals
  async getDeal(dealId, properties = []) {
    const params = new URLSearchParams();
    if (properties.length) params.append('properties', properties.join(','));
    return this.request(`/crm/v3/objects/deals/${dealId}?${params}`);
  }

  async listDeals(properties = [], limit = 100, after = null) {
    const params = new URLSearchParams({ limit });
    if (properties.length) params.append('properties', properties.join(','));
    if (after) params.append('after', after);
    return this.request(`/crm/v3/objects/deals?${params}`);
  }

  async createDeal(properties) {
    return this.request('/crm/v3/objects/deals', {
      method: 'POST',
      body: JSON.stringify({ properties })
    });
  }

  async updateDeal(dealId, properties) {
    return this.request(`/crm/v3/objects/deals/${dealId}`, {
      method: 'PATCH',
      body: JSON.stringify({ properties })
    });
  }

  // Tickets
  async getTicket(ticketId, properties = []) {
    const params = new URLSearchParams();
    if (properties.length) params.append('properties', properties.join(','));
    return this.request(`/crm/v3/objects/tickets/${ticketId}?${params}`);
  }

  async createTicket(properties) {
    return this.request('/crm/v3/objects/tickets', {
      method: 'POST',
      body: JSON.stringify({ properties })
    });
  }

  // Engagements
  async createEngagement(type, associations, properties = {}) {
    return this.request(`/crm/v3/objects/engagements`, {
      method: 'POST',
      body: JSON.stringify({
        properties: { hs_activity_type: type, ...properties },
        associations
      })
    });
  }

  // Lists
  async getList(listId) {
    return this.request(`/crm/v3/lists/${listId}`);
  }

  async getAllLists(limit = 100) {
    return this.request(`/crm/v3/lists?limit=${limit}`);
  }

  // Properties
  async getProperty(propertyName) {
    return this.request(`/crm/v3/properties/contacts/${propertyName}`);
  }

  async getAllProperties(objectType) {
    return this.request(`/crm/v3/properties/${objectType}`);
  }

  // Webhooks
  async createWebhook(url, events, filter = null) {
    return this.request('/webhooks/v3', {
      method: 'POST',
      body: JSON.stringify({
        targetUrl: url,
        active: true,
        eventRequests: events,
        filter
      })
    });
  }

  async listWebhooks() {
    return this.request('/webhooks/v3');
  }

  async deleteWebhook(webhookId) {
    return this.request(`/webhooks/v3/${webhookId}`, {
      method: 'DELETE'
    });
  }

  // Marketing
  async createContactList(name, dynamic = false) {
    return this.request('/crm/v3/lists', {
      method: 'POST',
      body: JSON.stringify({
        name,
        processing: dynamic ? 'DYNAMIC' : 'MANUAL',
        listSource: 'CONTACTS'
      })
    });
  }

  async addContactsToList(listId, contactIds) {
    return this.request(`/crm/v3/lists/${listId}/memberships`, {
      method: 'PUT',
      body: JSON.stringify(contactIds)
    });
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// INTEGRATION MANAGER
// ═══════════════════════════════════════════════════════════════════════════

export class IntegrationManager extends EventEmitter {
  constructor() {
    super();
    this.integrations = new Map();
  }

  /**
   * Register an integration
   */
  register(name, integration) {
    this.integrations.set(name, integration);
    
    // Forward events
    integration.on('error', (error) => this.emit('error', { integration: name, ...error }));
    
    this.emit('registered', { name });
    return this;
  }

  /**
   * Get an integration
   */
  get(name) {
    return this.integrations.get(name);
  }

  /**
   * Get all integrations
   */
  getAll() {
    return Array.from(this.integrations.entries()).map(([name, integration]) => ({
      name,
      ...integration.getStatus()
    }));
  }

  /**
   * Get configured integrations
   */
  getConfigured() {
    return this.getAll().filter(i => i.configured);
  }

  /**
   * Initialize all integrations from environment
   */
  initFromEnv() {
    // Notion
    if (process.env.NOTION_API_KEY) {
      this.register('notion', new NotionIntegration({ apiKey: process.env.NOTION_API_KEY }));
    }

    // Figma
    if (process.env.FIGMA_ACCESS_TOKEN) {
      this.register('figma', new FigmaIntegration({ apiKey: process.env.FIGMA_ACCESS_TOKEN }));
    }

    // Linear
    if (process.env.LINEAR_API_KEY) {
      this.register('linear', new LinearIntegration({ apiKey: process.env.LINEAR_API_KEY }));
    }

    // Jira
    if (process.env.JIRA_DOMAIN && process.env.JIRA_EMAIL && process.env.JIRA_API_TOKEN) {
      this.register('jira', new JiraIntegration({
        domain: process.env.JIRA_DOMAIN,
        email: process.env.JIRA_EMAIL,
        apiKey: process.env.JIRA_API_TOKEN
      }));
    }

    // Trello
    if (process.env.TRELLO_APP_KEY && process.env.TRELLO_TOKEN) {
      this.register('trello', new TrelloIntegration({
        appKey: process.env.TRELLO_APP_KEY,
        token: process.env.TRELLO_TOKEN
      }));
    }

    // Airtable
    if (process.env.AIRTABLE_API_KEY) {
      this.register('airtable', new AirtableIntegration({ apiKey: process.env.AIRTABLE_API_KEY }));
    }

    // Google
    if (process.env.GOOGLE_ACCESS_TOKEN) {
      this.register('google', new GoogleWorkspaceIntegration({ accessToken: process.env.GOOGLE_ACCESS_TOKEN }));
    }

    // Salesforce
    if (process.env.SALESFORCE_ACCESS_TOKEN && process.env.SALESFORCE_INSTANCE_URL) {
      this.register('salesforce', new SalesforceIntegration({
        accessToken: process.env.SALESFORCE_ACCESS_TOKEN,
        instanceUrl: process.env.SALESFORCE_INSTANCE_URL
      }));
    }

    // HubSpot
    if (process.env.HUBSPOT_ACCESS_TOKEN) {
      this.register('hubspot', new HubSpotIntegration({ accessToken: process.env.HUBSPOT_ACCESS_TOKEN }));
    }

    return this;
  }

  /**
   * Get status summary
   */
  getStatusSummary() {
    const all = this.getAll();
    return {
      total: all.length,
      configured: all.filter(i => i.configured).length,
      integrations: all
    };
  }
}

// Export singleton
let manager = null;

export function getIntegrationManager() {
  if (!manager) {
    manager = new IntegrationManager();
    manager.initFromEnv();
  }
  return manager;
}

export default {
  BaseIntegration,
  NotionIntegration,
  CanvaIntegration,
  FigmaIntegration,
  LinearIntegration,
  JiraIntegration,
  TrelloIntegration,
  AirtableIntegration,
  GoogleWorkspaceIntegration,
  SalesforceIntegration,
  HubSpotIntegration,
  IntegrationManager,
  getIntegrationManager
};
