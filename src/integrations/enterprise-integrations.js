#!/usr/bin/env node

import { EventEmitter } from 'events';

// ═══════════════════════════════════════════════════════════════════════════
// BASE INTEGRATION CLASS
// ═══════════════════════════════════════════════════════════════════════════

export class BaseIntegration extends EventEmitter {
  constructor(config = {}) {
    super();
    this.name = config.name || 'unknown';
    this.type = config.type || 'integration';
    this.apiKey = config.apiKey || config.accessToken;
    this.baseUrl = config.baseUrl;
    this.stats = { apiCalls: 0, errors: 0, lastCall: null };
  }

  isConfigured() {
    return !!this.apiKey;
  }

  async request(endpoint, options = {}) {
    const url = endpoint.startsWith('http') ? endpoint : `${this.baseUrl}${endpoint}`;
    const headers = {
      'Content-Type': 'application/json',
      ...this.getAuthHeaders(),
      ...options.headers
    };

    const response = await fetch(url, { ...options, headers });
    this.stats.apiCalls++;
    this.stats.lastCall = Date.now();

    if (!response.ok) {
      this.stats.errors++;
      throw new Error(`${this.name} API error: ${response.status}`);
    }

    return response.json();
  }

  getAuthHeaders() {
    if (this.apiKey?.startsWith('Bearer ')) {
      return { 'Authorization': this.apiKey };
    }
    return { 'Authorization': `Bearer ${this.apiKey}` };
  }

  getStatus() {
    return { name: this.name, type: this.type, configured: this.isConfigured(), stats: this.stats };
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// SPOTIFY INTEGRATION
// ═══════════════════════════════════════════════════════════════════════════

export class SpotifyIntegration extends BaseIntegration {
  constructor(config = {}) {
    super({
      ...config,
      name: 'spotify',
      type: 'entertainment',
      baseUrl: 'https://api.spotify.com/v1'
    });
    this.clientId = config.clientId;
    this.clientSecret = config.clientSecret;
    this.accessToken = config.accessToken;
  }

  getAuthHeaders() {
    return { 'Authorization': `Bearer ${this.accessToken}` };
  }

  // User Profile
  async getMe() {
    return this.request('/me');
  }

  async getUser(userId) {
    return this.request(`/users/${userId}`);
  }

  // Playlists
  async getPlaylists() {
    return this.request('/me/playlists');
  }

  async getPlaylist(playlistId) {
    return this.request(`/playlists/${playlistId}`);
  }

  async createPlaylist(name, description = '', isPublic = false) {
    const user = await this.getMe();
    return this.request(`/users/${user.id}/playlists`, {
      method: 'POST',
      body: JSON.stringify({ name, description, public: isPublic })
    });
  }

  async addTracksToPlaylist(playlistId, trackUris) {
    return this.request(`/playlists/${playlistId}/tracks`, {
      method: 'POST',
      body: JSON.stringify({ uris: trackUris })
    });
  }

  async removeTracksFromPlaylist(playlistId, trackUris) {
    return this.request(`/playlists/${playlistId}/tracks`, {
      method: 'DELETE',
      body: JSON.stringify({ tracks: trackUris.map(uri => ({ uri })) })
    });
  }

  async updatePlaylist(playlistId, updates) {
    return this.request(`/playlists/${playlistId}`, {
      method: 'PUT',
      body: JSON.stringify(updates)
    });
  }

  // Tracks
  async getTrack(trackId) {
    return this.request(`/tracks/${trackId}`);
  }

  async getAudioFeatures(trackId) {
    return this.request(`/audio-features/${trackId}`);
  }

  async getAudioFeaturesBatch(trackIds) {
    return this.request(`/audio-features?ids=${trackIds.join(',')}`);
  }

  async getRecommendations(seedTracks = [], seedArtists = [], seedGenres = [], options = {}) {
    const params = new URLSearchParams();
    if (seedTracks.length) params.append('seed_tracks', seedTracks.slice(0, 5).join(','));
    if (seedArtists.length) params.append('seed_artists', seedArtists.slice(0, 5).join(','));
    if (seedGenres.length) params.append('seed_genres', seedGenres.slice(0, 5).join(','));
    Object.entries(options).forEach(([k, v]) => params.append(k, v));
    return this.request(`/recommendations?${params}`);
  }

  // Search
  async search(query, types = ['track', 'artist', 'album'], limit = 20) {
    const params = new URLSearchParams({ q: query, type: types.join(','), limit });
    return this.request(`/search?${params}`);
  }

  // Artists
  async getArtist(artistId) {
    return this.request(`/artists/${artistId}`);
  }

  async getArtistTopTracks(artistId, market = 'US') {
    return this.request(`/artists/${artistId}/top-tracks?market=${market}`);
  }

  async getArtistAlbums(artistId, includeGroups = 'album,single') {
    return this.request(`/artists/${artistId}/albums?include_groups=${includeGroups}`);
  }

  async getRelatedArtists(artistId) {
    return this.request(`/artists/${artistId}/related-artists`);
  }

  // Albums
  async getAlbum(albumId) {
    return this.request(`/albums/${albumId}`);
  }

  async getAlbumTracks(albumId, limit = 50) {
    return this.request(`/albums/${albumId}/tracks?limit=${limit}`);
  }

  // Player
  async getPlaybackState() {
    return this.request('/me/player');
  }

  async getCurrentlyPlaying() {
    return this.request('/me/player/currently-playing');
  }

  async startPlayback(deviceId = null, contextUri = null, uris = []) {
    const body = {};
    if (contextUri) body.context_uri = contextUri;
    if (uris.length) body.uris = uris;
    if (deviceId) body.device_ids = [deviceId];
    return this.request('/me/player/play', {
      method: 'PUT',
      body: JSON.stringify(body)
    });
  }

  async pausePlayback(deviceId = null) {
    return this.request('/me/player/pause', { method: 'PUT' });
  }

  async skipToNext() {
    return this.request('/me/player/next', { method: 'POST' });
  }

  async skipToPrevious() {
    return this.request('/me/player/previous', { method: 'POST' });
  }

  async seekToPosition(positionMs) {
    return this.request(`/me/player/seek?position_ms=${positionMs}`, { method: 'PUT' });
  }

  async setVolume(volumePercent, deviceId = null) {
    const params = new URLSearchParams({ volume_percent: volumePercent });
    if (deviceId) params.append('device_id', deviceId);
    return this.request(`/me/player/volume?${params}`, { method: 'PUT' });
  }

  async setRepeatMode(state = 'off', deviceId = null) {
    const params = new URLSearchParams({ state });
    if (deviceId) params.append('device_id', deviceId);
    return this.request(`/me/player/repeat?${params}`, { method: 'PUT' });
  }

  async setShuffle(state = false, deviceId = null) {
    const params = new URLSearchParams({ state: state.toString() });
    if (deviceId) params.append('device_id', deviceId);
    return this.request(`/me/player/shuffle?${params}`, { method: 'PUT' });
  }

  // Library
  async getSavedTracks(limit = 50, offset = 0) {
    return this.request(`/me/tracks?limit=${limit}&offset=${offset}`);
  }

  async saveTracks(trackIds) {
    return this.request('/me/tracks', {
      method: 'PUT',
      body: JSON.stringify({ ids: trackIds })
    });
  }

  async removeSavedTracks(trackIds) {
    return this.request('/me/tracks', {
      method: 'DELETE',
      body: JSON.stringify({ ids: trackIds })
    });
  }

  async checkSavedTracks(trackIds) {
    return this.request(`/me/tracks/contains?ids=${trackIds.join(',')}`);
  }

  async getSavedAlbums(limit = 50, offset = 0) {
    return this.request(`/me/albums?limit=${limit}&offset=${offset}`);
  }

  async saveAlbums(albumIds) {
    return this.request('/me/albums', {
      method: 'PUT',
      body: JSON.stringify({ ids: albumIds })
    });
  }

  // Browse
  async getNewReleases(country = 'US', limit = 20) {
    return this.request(`/browse/new-releases?country=${country}&limit=${limit}`);
  }

  async getFeaturedPlaylists(country = 'US', locale = 'en_US', timestamp = null) {
    const params = new URLSearchParams({ country, locale });
    if (timestamp) params.append('timestamp', timestamp);
    return this.request(`/browse/featured-playlists?${params}`);
  }

  async getCategories(country = 'US', locale = 'en_US', limit = 50) {
    const params = new URLSearchParams({ country, locale, limit });
    return this.request(`/browse/categories?${params}`);
  }

  async getCategoryPlaylists(categoryId, country = 'US', limit = 50) {
    return this.request(`/browse/categories/${categoryId}/playlists?country=${country}&limit=${limit}`);
  }

  // Follow
  async followUsers(userIds) {
    return this.request('/me/following', {
      method: 'PUT',
      body: JSON.stringify({ ids: userIds }),
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${this.accessToken}` }
    });
  }

  async followArtists(artistIds) {
    return this.request('/me/following', {
      method: 'PUT',
      body: JSON.stringify({ ids: artistIds }),
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${this.accessToken}` }
    });
  }

  async getFollowedArtists(limit = 50) {
    return this.request(`/me/following?type=artist&limit=${limit}`);
  }

  // Episodes & Shows
  async getShow(showId) {
    return this.request(`/shows/${showId}`);
  }

  async getEpisode(episodeId) {
    return this.request(`/episodes/${episodeId}`);
  }

  async getSavedShows(limit = 50, offset = 0) {
    return this.request(`/me/shows?limit=${limit}&offset=${offset}`);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// TARGET INTEGRATION
// ═══════════════════════════════════════════════════════════════════════════

export class TargetIntegration extends BaseIntegration {
  constructor(config = {}) {
    super({
      ...config,
      name: 'target',
      type: 'ecommerce',
      baseUrl: 'https://api.target.com/v3'
    });
  }

  async searchProducts(query, options = {}) {
    const params = new URLSearchParams({ q: query, ...options });
    return this.request(`/products/search?${params}`);
  }

  async getProduct(productId) {
    return this.request(`/products/${productId}`);
  }

  async getProductOffers(productId) {
    return this.request(`/products/${productId}/offers`);
  }

  async getProductReviews(productId, limit = 10) {
    return this.request(`/products/${productId}/reviews?limit=${limit}`);
  }

  async getProductVariations(productId) {
    return this.request(`/products/${productId}/variations`);
  }

  async getProductsByCategory(categoryId, options = {}) {
    const params = new URLSearchParams(options);
    return this.request(`/categories/${categoryId}/products?${params}`);
  }

  async getDeals(options = {}) {
    const params = new URLSearchParams(options);
    return this.request(`/deals?${params}`);
  }

  async getStore(storeId) {
    return this.request(`/stores/${storeId}`);
  }

  async searchStores(zipCode, radius = 25) {
    return this.request(`/stores?zip=${zipCode}&radius=${radius}`);
  }

  async getProductAvailability(productId, storeId) {
    return this.request(`/products/${productId}/locations/${storeId}/availability`);
  }

  async getProductPrice(productId) {
    return this.request(`/products/${productId}/price`);
  }

  async getRecommendations(productId, type = 'similar') {
    return this.request(`/products/${productId}/recommendations?type=${type}`);
  }

  async getTrendingProducts(options = {}) {
    const params = new URLSearchParams(options);
    return this.request(`/products/trending?${params}`);
  }

  async getCircular(locationId = 'store') {
    return this.request(`/circulars?location=${locationId}`);
  }

  async getRegistry(registryId) {
    return this.request(`/registries/${registryId}`);
  }

  async searchRegistry(type, query) {
    return this.request(`/registries/search?type=${type}&q=${encodeURIComponent(query)}`);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// TRIPADVISOR INTEGRATION
// ═══════════════════════════════════════════════════════════════════════════

export class TripAdvisorIntegration extends BaseIntegration {
  constructor(config = {}) {
    super({
      ...config,
      name: 'tripadvisor',
      type: 'travel',
      baseUrl: 'https://api.content.tripadvisor.com/api/v1'
    });
  }

  async searchLocations(query, options = {}) {
    const params = new URLSearchParams({ query, ...options });
    return this.request(`/locations/search?${params}`);
  }

  async getLocationDetails(locationId) {
    return this.request(`/locations/${locationId}/details`);
  }

  async getLocationPhotos(locationId, options = {}) {
    const params = new URLSearchParams(options);
    return this.request(`/locations/${locationId}/photos?${params}`);
  }

  async getLocationReviews(locationId, options = {}) {
    const params = new URLSearchParams(options);
    return this.request(`/locations/${locationId}/reviews?${params}`);
  }

  async getLocationAmenities(locationId) {
    return this.request(`/locations/${locationId}/amenities`);
  }

  async getNearbyLocations(lat, lng, options = {}) {
    const params = new URLSearchParams({ lat, lng, ...options });
    return this.request(`/locations/nearby?${params}`);
  }

  async getAttractions(lat, lng, options = {}) {
    const params = new URLSearchParams({ lat, lng, ...options });
    return this.request(`/attractions/list?${params}`);
  }

  async getRestaurants(lat, lng, options = {}) {
    const params = new URLSearchParams({ lat, lng, ...options });
    return this.request(`/restaurants/list?${params}`);
  }

  async getHotels(lat, lng, options = {}) {
    const params = new URLSearchParams({ lat, lng, ...options });
    return this.request(`/hotels/list?${params}`);
  }

  async getTours(lat, lng, options = {}) {
    const params = new URLSearchParams({ lat, lng, ...options });
    return this.request(`/tours/list?${params}`);
  }

  async getCurrencies() {
    return this.request('/currencies');
  }

  async getLanguages() {
    return this.request('/languages');
  }

  async getCategories() {
    return this.request('/categories');
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// ZILLOW INTEGRATION
// ═══════════════════════════════════════════════════════════════════════════

export class ZillowIntegration extends BaseIntegration {
  constructor(config = {}) {
    super({
      ...config,
      name: 'zillow',
      type: 'real_estate',
      baseUrl: 'https://api.bridgedataoficial.com/api/v2'
    });
    this.accessToken = config.accessToken || config.apiKey;
  }

  getAuthHeaders() {
    return { 'Authorization': `Bearer ${this.accessToken}` };
  }

  async searchProperties(query, options = {}) {
    const params = new URLSearchParams({ address: query, ...options });
    return this.request(`/properties/search?${params}`);
  }

  async getProperty(propertyId) {
    return this.request(`/properties/${propertyId}`);
  }

  async getPropertyByZpid(zpid) {
    return this.request(`/properties/${zpid}`);
  }

  async getPropertyImages(propertyId) {
    return this.request(`/properties/${propertyId}/images`);
  }

  async getPropertyEstimate(propertyId) {
    return this.request(`/properties/${propertyId}/estimate`);
  }

  async getPropertyComps(propertyId, options = {}) {
    const params = new URLSearchParams(options);
    return this.request(`/properties/${propertyId}/comps?${params}`);
  }

  async getPropertyDeepComps(propertyId, options = {}) {
    const params = new URLSearchParams(options);
    return this.request(`/properties/${propertyId}/deepComps?${params}`);
  }

  async getPropertyCharts(propertyId, chartType = 'priceHistory') {
    return this.request(`/properties/${propertyId}/charts/${chartType}`);
  }

  async getRegionData(regionId, options = {}) {
    const params = new URLSearchParams(options);
    return this.request(`/regions/${regionId}?${params}`);
  }

  async getMarketTrends(regionId, options = {}) {
    const params = new URLSearchParams(options);
    return this.request(`/regions/${regionId}/market-trends?${params}`);
  }

  async getSchools(lat, lng, radius = 5) {
    return this.request(`/schools?lat=${lat}&lng=${lng}&radius=${radius}`);
  }

  async getNearbyHomes(lat, lng, options = {}) {
    const params = new URLSearchParams({ lat, lng, ...options });
    return this.request(`/homes/nearby?${params}`);
  }

  async getMortgageRates() {
    return this.request('/mortgage/rates');
  }

  async getPropertyUpdates(email, options = {}) {
    const params = new URLSearchParams({ email, ...options });
    return this.request(`/alerts/property?${params}`);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// BASE44 (AI STUDIO) INTEGRATION
// ═══════════════════════════════════════════════════════════════════════════

export class Base44Integration extends BaseIntegration {
  constructor(config = {}) {
    super({
      ...config,
      name: 'base44',
      type: 'ai',
      baseUrl: 'https://api.base44.ai/v1'
    });
  }

  // Apps
  async listApps() {
    return this.request('/apps');
  }

  async getApp(appId) {
    return this.request(`/apps/${appId}`);
  }

  async createApp(name, template = null) {
    const body = { name };
    if (template) body.template = template;
    return this.request('/apps', { method: 'POST', body: JSON.stringify(body) });
  }

  async deleteApp(appId) {
    return this.request(`/apps/${appId}`, { method: 'DELETE' });
  }

  // AI Studio
  async generateContent(prompt, type = 'text', options = {}) {
    return this.request('/ai/generate', {
      method: 'POST',
      body: JSON.stringify({ prompt, type, ...options })
    });
  }

  async generateImage(prompt, options = {}) {
    return this.request('/ai/generate/image', {
      method: 'POST',
      body: JSON.stringify({ prompt, ...options })
    });
  }

  async generateCode(description, language = 'javascript') {
    return this.request('/ai/generate/code', {
      method: 'POST',
      body: JSON.stringify({ description, language })
    });
  }

  async analyzeImage(imageUrl, prompt = 'Describe this image') {
    return this.request('/ai/analyze/image', {
      method: 'POST',
      body: JSON.stringify({ imageUrl, prompt })
    });
  }

  async chat(message, context = {}) {
    return this.request('/ai/chat', {
      method: 'POST',
      body: JSON.stringify({ message, context })
    });
  }

  // Database
  async getRecords(collection, options = {}) {
    const params = new URLSearchParams(options);
    return this.request(`/data/${collection}?${params}`);
  }

  async createRecord(collection, data) {
    return this.request(`/data/${collection}`, {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  async updateRecord(collection, id, data) {
    return this.request(`/data/${collection}/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data)
    });
  }

  async deleteRecord(collection, id) {
    return this.request(`/data/${collection}/${id}`, { method: 'DELETE' });
  }

  // Deployments
  async deploy(appId) {
    return this.request(`/apps/${appId}/deploy`, { method: 'POST' });
  }

  async getDeployments(appId) {
    return this.request(`/apps/${appId}/deployments`);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// BOTPRESS INTEGRATION
// ═══════════════════════════════════════════════════════════════════════════

export class BotpressIntegration extends BaseIntegration {
  constructor(config = {}) {
    super({
      ...config,
      name: 'botpress',
      type: 'ai',
      baseUrl: 'https://api.botpress.cloud/v1'
    });
    this.botId = config.botId;
  }

  // Conversations
  async createConversation(userId) {
    return this.request('/conversations', {
      method: 'POST',
      body: JSON.stringify({ userId })
    });
  }

  async getConversation(conversationId) {
    return this.request(`/conversations/${conversationId}`);
  }

  async listConversations(options = {}) {
    const params = new URLSearchParams(options);
    return this.request(`/conversations?${params}`);
  }

  // Messages
  async sendMessage(conversationId, content, options = {}) {
    return this.request(`/conversations/${conversationId}/messages`, {
      method: 'POST',
      body: JSON.stringify({ content, ...options })
    });
  }

  async getMessages(conversationId, options = {}) {
    const params = new URLSearchParams(options);
    return this.request(`/conversations/${conversationId}/messages?${params}`);
  }

  async updateMessage(conversationId, messageId, content) {
    return this.request(`/conversations/${conversationId}/messages/${messageId}`, {
      method: 'PATCH',
      body: JSON.stringify({ content })
    });
  }

  async deleteMessage(conversationId, messageId) {
    return this.request(`/conversations/${conversationId}/messages/${messageId}`, { method: 'DELETE' });
  }

  // Users
  async createUser(userId, profile = {}) {
    return this.request('/users', {
      method: 'POST',
      body: JSON.stringify({ userId, profile })
    });
  }

  async getUser(userId) {
    return this.request(`/users/${userId}`);
  }

  async updateUser(userId, profile) {
    return this.request(`/users/${userId}`, {
      method: 'PATCH',
      body: JSON.stringify({ profile })
    });
  }

  // AI Responses
  async generateResponse(prompt, context = {}) {
    return this.request('/ai/generate', {
      method: 'POST',
      body: JSON.stringify({ prompt, context, botId: this.botId })
    });
  }

  // Webhooks
  async listWebhooks() {
    return this.request('/webhooks');
  }

  async createWebhook(url, events) {
    return this.request('/webhooks', {
      method: 'POST',
      body: JSON.stringify({ url, events })
    });
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// BOX INTEGRATION
// ═══════════════════════════════════════════════════════════════════════════

export class BoxIntegration extends BaseIntegration {
  constructor(config = {}) {
    super({
      ...config,
      name: 'box',
      type: 'storage',
      baseUrl: 'https://api.box.com/2.0'
    });
    this.accessToken = config.accessToken;
  }

  getAuthHeaders() {
    return { 'Authorization': `Bearer ${this.accessToken}` };
  }

  // Files
  async getFile(fileId) {
    return this.request(`/files/${fileId}`);
  }

  async getFileContent(fileId) {
    return this.request(`/files/${fileId}/content`);
  }

  async uploadFile(folderId, name, content) {
    const formData = new FormData();
    formData.append('attributes', JSON.stringify({ name, parent: { id: folderId } }));
    formData.append('file', new Blob([content]), name);
    return fetch(`${this.baseUrl}/files/content`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${this.accessToken}` },
      body: formData
    });
  }

  async updateFile(fileId, updates) {
    return this.request(`/files/${fileId}`, {
      method: 'PUT',
      body: JSON.stringify(updates)
    });
  }

  async deleteFile(fileId) {
    return this.request(`/files/${fileId}`, { method: 'DELETE' });
  }

  async getFileVersions(fileId) {
    return this.request(`/files/${fileId}/versions`);
  }

  async getFileCollaborations(fileId) {
    return this.request(`/files/${fileId}/collaborations`);
  }

  async getFileComments(fileId) {
    return this.request(`/files/${fileId}/comments`);
  }

  async addComment(fileId, message) {
    return this.request('/comments', {
      method: 'POST',
      body: JSON.stringify({ item: { type: 'file', id: fileId }, message })
    });
  }

  // Folders
  async getFolder(folderId) {
    return this.request(`/folders/${folderId}`);
  }

  async getFolderItems(folderId, options = {}) {
    const params = new URLSearchParams(options);
    return this.request(`/folders/${folderId}/items?${params}`);
  }

  async createFolder(name, parentId = '0') {
    return this.request('/folders', {
      method: 'POST',
      body: JSON.stringify({ name, parent: { id: parentId } })
    });
  }

  async deleteFolder(folderId) {
    return this.request(`/folders/${folderId}`, { method: 'DELETE' });
  }

  async copyFolder(folderId, destinationId, name = null) {
    const body = { parent: { id: destinationId } };
    if (name) body.name = name;
    return this.request(`/folders/${folderId}/copy`, {
      method: 'POST',
      body: JSON.stringify(body)
    });
  }

  // Search
  async search(query, options = {}) {
    const params = new URLSearchParams({ query, ...options });
    return this.request(`/search?${params}`);
  }

  // Users
  async getCurrentUser() {
    return this.request('/users/me');
  }

  async getUsers(options = {}) {
    const params = new URLSearchParams(options);
    return this.request(`/users?${params}`);
  }

  // Collaborations
  async createCollaboration(itemType, itemId, accessibleBy, role = 'viewer') {
    return this.request('/collaborations', {
      method: 'POST',
      body: JSON.stringify({
        item: { type: itemType, id: itemId },
        accessible_by: { type: 'user', id: accessibleBy },
        role
      })
    });
  }

  async getCollaboration(collaborationId) {
    return this.request(`/collaborations/${collaborationId}`);
  }

  async updateCollaboration(collaborationId, role) {
    return this.request(`/collaborations/${collaborationId}`, {
      method: 'PUT',
      body: JSON.stringify({ role })
    });
  }

  async deleteCollaboration(collaborationId) {
    return this.request(`/collaborations/${collaborationId}`, { method: 'DELETE' });
  }

  // Tasks
  async createTask(fileId, options = {}) {
    return this.request('/tasks', {
      method: 'POST',
      body: JSON.stringify({ item: { type: 'file', id: fileId }, ...options })
    });
  }

  async getFileTasks(fileId) {
    return this.request(`/files/${fileId}/tasks`);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// BRAND24 INTEGRATION
// ═══════════════════════════════════════════════════════════════════════════

export class Brand24Integration extends BaseIntegration {
  constructor(config = {}) {
    super({
      ...config,
      name: 'brand24',
      type: 'social_media',
      baseUrl: 'https://api.brand24.com/v3'
    });
  }

  // Projects
  async listProjects() {
    return this.request('/projects');
  }

  async getProject(projectId) {
    return this.request(`/projects/${projectId}`);
  }

  async createProject(name, keywords = []) {
    return this.request('/projects', {
      method: 'POST',
      body: JSON.stringify({ name, keywords })
    });
  }

  async updateProject(projectId, updates) {
    return this.request(`/projects/${projectId}`, {
      method: 'PATCH',
      body: JSON.stringify(updates)
    });
  }

  async deleteProject(projectId) {
    return this.request(`/projects/${projectId}`, { method: 'DELETE' });
  }

  // Mentions
  async getMentions(projectId, options = {}) {
    const params = new URLSearchParams({ project_id: projectId, ...options });
    return this.request(`/mentions?${params}`);
  }

  async getMention(mentionId) {
    return this.request(`/mentions/${mentionId}`);
  }

  async getMentionSentiment(mentionId) {
    return this.request(`/mentions/${mentionId}/sentiment`);
  }

  async addTagsToMention(mentionId, tags) {
    return this.request(`/mentions/${mentionId}/tags`, {
      method: 'POST',
      body: JSON.stringify({ tags })
    });
  }

  async removeTagFromMention(mentionId, tag) {
    return this.request(`/mentions/${mentionId}/tags/${tag}`, { method: 'DELETE' });
  }

  async getMentionAuthor(mentionId) {
    return this.request(`/mentions/${mentionId}/author`);
  }

  // Analytics
  async getProjectAnalytics(projectId, options = {}) {
    const params = new URLSearchParams({ project_id: projectId, ...options });
    return this.request(`/analytics?${params}`);
  }

  async getSentimentAnalysis(projectId, options = {}) {
    const params = new URLSearchParams({ project_id: projectId, ...options });
    return this.request(`/analytics/sentiment?${params}`);
  }

  async getInfluencers(projectId, options = {}) {
    const params = new URLSearchParams({ project_id: projectId, ...options });
    return this.request(`/analytics/influencers?${params}`);
  }

  async getHashtagPerformance(projectId, options = {}) {
    const params = new URLSearchParams({ project_id: projectId, ...options });
    return this.request(`/analytics/hashtags?${params}`);
  }

  // Reports
  async getReport(projectId, reportType = 'summary') {
    return this.request(`/reports/${reportType}?project_id=${projectId}`);
  }

  async exportMentions(projectId, format = 'csv') {
    return this.request(`/export/mentions?project_id=${projectId}&format=${format}`);
  }

  // Tags
  async listTags(projectId) {
    return this.request(`/projects/${projectId}/tags`);
  }

  async createTag(projectId, name, color = null) {
    return this.request(`/projects/${projectId}/tags`, {
      method: 'POST',
      body: JSON.stringify({ name, color })
    });
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// BREX INTEGRATION
// ═══════════════════════════════════════════════════════════════════════════

export class BrexIntegration extends BaseIntegration {
  constructor(config = {}) {
    super({
      ...config,
      name: 'brex',
      type: 'finance',
      baseUrl: 'https://platform.brex.com/api'
    });
    this.accessToken = config.accessToken;
  }

  getAuthHeaders() {
    return { 'Authorization': `Bearer ${this.accessToken}` };
  }

  // Users
  async getCurrentUser() {
    return this.request('/users/me');
  }

  async listUsers() {
    return this.request('/users');
  }

  async getUser(userId) {
    return this.request(`/users/${userId}`);
  }

  // Cards
  async listCards() {
    return this.request('/cards');
  }

  async getCard(cardId) {
    return this.request(`/cards/${cardId}`);
  }

  async createCard(userId, cardType = 'physical') {
    return this.request('/cards', {
      method: 'POST',
      body: JSON.stringify({ user_id: userId, card_type: cardType })
    });
  }

  async updateCard(cardId, updates) {
    return this.request(`/cards/${cardId}`, {
      method: 'PATCH',
      body: JSON.stringify(updates)
    });
  }

  async deactivateCard(cardId) {
    return this.request(`/cards/${cardId}`, {
      method: 'DELETE'
    });
  }

  // Transactions
  async listTransactions(options = {}) {
    const params = new URLSearchParams(options);
    return this.request(`/transactions?${params}`);
  }

  async getTransaction(transactionId) {
    return this.request(`/transactions/${transactionId}`);
  }

  async createTransaction(data) {
    return this.request('/transactions', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  async updateTransaction(transactionId, data) {
    return this.request(`/transactions/${transactionId}`, {
      method: 'PATCH',
      body: JSON.stringify(data)
    });
  }

  async categorizeTransaction(transactionId, categoryId) {
    return this.request(`/transactions/${transactionId}/categorize`, {
      method: 'POST',
      body: JSON.stringify({ category_id: categoryId })
    });
  }

  // Expenses
  async listExpenses(options = {}) {
    const params = new URLSearchParams(options);
    return this.request(`/expenses?${params}`);
  }

  async getExpense(expenseId) {
    return this.request(`/expenses/${expenseId}`);
  }

  async createExpense(data) {
    return this.request('/expenses', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  async approveExpense(expenseId) {
    return this.request(`/expenses/${expenseId}/approve`, { method: 'POST' });
  }

  async rejectExpense(expenseId, reason) {
    return this.request(`/expenses/${expenseId}/reject`, {
      method: 'POST',
      body: JSON.stringify({ reason })
    });
  }

  // Transfers
  async listTransfers(options = {}) {
    const params = new URLSearchParams(options);
    return this.request(`/transfers?${params}`);
  }

  async createTransfer(data) {
    return this.request('/transfers', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  // Reimbursements
  async listReimbursements(options = {}) {
    const params = new URLSearchParams(options);
    return this.request(`/reimbursements?${params}`);
  }

  async createReimbursement(data) {
    return this.request('/reimbursements', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// CLOUDFLARE INTEGRATION
// ═══════════════════════════════════════════════════════════════════════════

export class CloudflareIntegration extends BaseIntegration {
  constructor(config = {}) {
    super({
      ...config,
      name: 'cloudflare',
      type: 'infrastructure',
      baseUrl: `https://api.cloudflare.com/client/v4`
    });
    this.email = config.email;
    this.apiKey = config.apiKey;
  }

  getAuthHeaders() {
    return {
      'X-Auth-Email': this.email,
      'X-Auth-Key': this.apiKey,
      'Content-Type': 'application/json'
    };
  }

  // Zones
  async listZones(options = {}) {
    const params = new URLSearchParams(options);
    return this.request(`/zones?${params}`);
  }

  async getZone(zoneId) {
    return this.request(`/zones/${zoneId}`);
  }

  async createZone(name, accountId = null) {
    const body = { name, jump_start: true };
    if (accountId) body.account = { id: accountId };
    return this.request('/zones', {
      method: 'POST',
      body: JSON.stringify(body)
    });
  }

  async deleteZone(zoneId) {
    return this.request(`/zones/${zoneId}`, { method: 'DELETE' });
  }

  async pauseZone(zoneId) {
    return this.request(`/zones/${zoneId}`, {
      method: 'PATCH',
      body: JSON.stringify({ paused: true })
    });
  }

  // DNS Records
  async listDnsRecords(zoneId, options = {}) {
    const params = new URLSearchParams(options);
    return this.request(`/zones/${zoneId}/dns_records?${params}`);
  }

  async getDnsRecord(zoneId, recordId) {
    return this.request(`/zones/${zoneId}/dns_records/${recordId}`);
  }

  async createDnsRecord(zoneId, data) {
    return this.request(`/zones/${zoneId}/dns_records`, {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  async updateDnsRecord(zoneId, recordId, data) {
    return this.request(`/zones/${zoneId}/dns_records/${recordId}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  }

  async deleteDnsRecord(zoneId, recordId) {
    return this.request(`/zones/${zoneId}/dns_records/${recordId}`, { method: 'DELETE' });
  }

  // Workers
  async listWorkersScripts() {
    return this.request('/workers/scripts');
  }

  async getWorkerScript(scriptName) {
    return this.request(`/workers/scripts/${scriptName}`);
  }

  async uploadWorkerScript(scriptName, script) {
    return this.request(`/workers/scripts/${scriptName}`, {
      method: 'PUT',
      body: script
    });
  }

  async deleteWorkerScript(scriptName) {
    return this.request(`/workers/scripts/${scriptName}`, { method: 'DELETE' });
  }

  // Pages
  async listPagesProjects() {
    return this.request('/pages/projects');
  }

  async getPagesProject(accountId, projectName) {
    return this.request(`/accounts/${accountId}/pages/projects/${projectName}`);
  }

  // Analytics
  async getZoneAnalytics(zoneId, options = {}) {
    const params = new URLSearchParams(options);
    return this.request(`/zones/${zoneId}/analytics/dashboard?${params}`);
  }

  // SSL/TLS
  async getSslSettings(zoneId) {
    return this.request(`/zones/${zoneId}/settings/ssl`);
  }

  async updateSslSettings(zoneId, settings) {
    return this.request(`/zones/${zoneId}/settings/ssl`, {
      method: 'PATCH',
      body: JSON.stringify(settings)
    });
  }

  // Firewall
  async listFirewallRules(zoneId) {
    return this.request(`/zones/${zoneId}/firewall/rules`);
  }

  async createFirewallRule(zoneId, rules) {
    return this.request(`/zones/${zoneId}/firewall/rules`, {
      method: 'POST',
      body: JSON.stringify({ rules })
    });
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// CLOUDINARY INTEGRATION
// ═══════════════════════════════════════════════════════════════════════════

export class CloudinaryIntegration extends BaseIntegration {
  constructor(config = {}) {
    super({
      ...config,
      name: 'cloudinary',
      type: 'media',
      baseUrl: `https://api.cloudinary.com/v1_1/${config.cloudName}`
    });
    this.cloudName = config.cloudName;
    this.apiKey = config.apiKey;
    this.apiSecret = config.apiSecret;
  }

  getAuthHeaders() {
    return { 'Authorization': `Basic ${Buffer.from(`${this.apiKey}:${this.apiSecret}`).toString('base64')}` };
  }

  async upload(image, options = {}) {
    const formData = new FormData();
    if (typeof image === 'string') {
      formData.append('file', image);
    } else {
      formData.append('file', new Blob([image]), 'upload');
    }
    Object.entries(options).forEach(([k, v]) => formData.append(k, v));
    
    return fetch(`${this.baseUrl}/image/upload`, {
      method: 'POST',
      headers: { 'Authorization': this.getAuthHeaders()['Authorization'] },
      body: formData
    }).then(r => r.json());
  }

  async destroy(publicId, options = {}) {
    return this.request('/image/destroy', {
      method: 'POST',
      body: JSON.stringify({ public_id: publicId, ...options })
    });
  }

  async listResources(options = {}) {
    return this.request('/resources/image', { method: 'GET' });
  }

  async getResource(publicId) {
    return this.request(`/resources/image/upload/${publicId}`, { method: 'GET' });
  }

  async updateResource(publicId, updates) {
    return this.request(`/resources/image/upload/${publicId}`, {
      method: 'POST',
      body: JSON.stringify(updates)
    });
  }

  async deleteResources(publicIds, options = {}) {
    return this.request('/resources/image/destroy', {
      method: 'POST',
      body: JSON.stringify({ public_ids: publicIds, ...options })
    });
  }

  // Transformations
  async listTransformations() {
    return this.request('/transformations');
  }

  async createTransformation(name, definition) {
    return this.request('/transformations', {
      method: 'POST',
      body: JSON.stringify({ name, definition })
    });
  }

  // Folders
  async createFolder(path) {
    return this.request('/folders', {
      method: 'POST',
      body: JSON.stringify({ path })
    });
  }

  async deleteFolder(path) {
    return this.request(`/folders/${path}`, { method: 'DELETE' });
  }

  // Tags
  async addTag(tag, publicIds) {
    return this.request('/tags/add', {
      method: 'POST',
      body: JSON.stringify({ tag, public_ids: publicIds })
    });
  }

  async removeTag(tag, publicIds) {
    return this.request('/tags/remove', {
      method: 'POST',
      body: JSON.stringify({ tag, public_ids: publicIds })
    });
  }

  async listByTag(tag, options = {}) {
    const params = new URLSearchParams({ tag, ...options });
    return this.request(`/resources/image/tag/${tag}?${params}`);
  }

  // Search
  async search(query, options = {}) {
    return this.request('/resources/search', {
      method: 'POST',
      body: JSON.stringify({ expression: query, ...options })
    });
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// COURSERA INTEGRATION
// ═══════════════════════════════════════════════════════════════════════════

export class CourseraIntegration extends BaseIntegration {
  constructor(config = {}) {
    super({
      ...config,
      name: 'coursera',
      type: 'education',
      baseUrl: 'https://api.coursera.com/api'
    });
    this.oauthToken = config.oauthToken;
  }

  getAuthHeaders() {
    return { 'Authorization': `Bearer ${this.oauthToken}` };
  }

  async getCatalogs() {
    return this.request('/catalogs');
  }

  async getCategories() {
    return this.request('/categories');
  }

  async searchCourses(query, options = {}) {
    const params = new URLSearchParams({ q: 'search', query, ...options });
    return this.request(`/courses?${params}`);
  }

  async getCourse(courseId) {
    return this.request(`/courses/${courseId}`);
  }

  async getCourseDetails(courseId) {
    return this.request(`/courses/${courseId}/details`);
  }

  async getCourseSyllabus(courseId) {
    return this.request(`/courses/${courseId}/syllabus`);
  }

  async getCourseReviews(courseId, options = {}) {
    const params = new URLSearchParams(options);
    return this.request(`/courses/${courseId}/reviews?${params}`);
  }

  async getInstructor(instructorId) {
    return this.request(`/instructors/${instructorId}`);
  }

  async getInstructors(courseId) {
    return this.request(`/courses/${courseId}/instructors`);
  }

  async getPrograms() {
    return this.request('/programs');
  }

  async getProgram(programId) {
    return this.request(`/programs/${programId}`);
  }

  async getDegrees() {
    return this.request('/degrees');
  }

  async getDegree(degreeId) {
    return this.request(`/degrees/${degreeId}`);
  }

  async enroll(courseId) {
    return this.request(`/courses/${courseId}/enroll`, { method: 'POST' });
  }

  async getEnrollments() {
    return this.request('/sessions');
  }

  async getSession(sessionId) {
    return this.request(`/sessions/${sessionId}`);
  }

  async getWeekMaterials(sessionId, weekNumber) {
    return this.request(`/sessions/${sessionId}/weeks/${weekNumber}/materials`);
  }

  async submitQuiz(quizId, answers) {
    return this.request(`/quizzes/${quizId}/submissions`, {
      method: 'POST',
      body: JSON.stringify({ answers })
    });
  }

  async getCertificates(userId = 'me') {
    return this.request(`/certificates?userId=${userId}`);
  }

  async getCertificate(certificateId) {
    return this.request(`/certificates/${certificateId}`);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// DROPBOX INTEGRATION
// ═══════════════════════════════════════════════════════════════════════════

export class DropboxIntegration extends BaseIntegration {
  constructor(config = {}) {
    super({
      ...config,
      name: 'dropbox',
      type: 'storage',
      baseUrl: 'https://api.dropboxapi.com/2'
    });
    this.accessToken = config.accessToken;
  }

  getAuthHeaders() {
    return { 'Authorization': `Bearer ${this.accessToken}`, 'Content-Type': 'application/json' };
  }

  async request(endpoint, options = {}) {
    const url = `${this.baseUrl}${endpoint}`;
    const headers = { 'Authorization': `Bearer ${this.accessToken}`, 'Content-Type': 'application/json' };
    if (options.dropboxApiArg) headers['Dropbox-API-Arg'] = options.dropboxApiArg;
    
    const response = await fetch(url, { ...options, headers });
    this.stats.apiCalls++;
    
    if (!response.ok) {
      this.stats.errors++;
      const err = await response.json().catch(() => ({}));
      throw new Error(`${this.name} API error: ${response.status} - ${err.error_summary || ''}`);
    }
    
    return response.json();
  }

  // Files
  async uploadFile(path, content, options = {}) {
    const headers = { 'Authorization': `Bearer ${this.accessToken}`, 'Content-Type': 'application/octet-stream', 'Dropbox-API-Arg': JSON.stringify({ path, mode: options.mode || 'add', autorename: true }) };
    return fetch('https://content.dropboxapi.com/2/files/upload', { method: 'POST', headers, body: content }).then(r => r.json());
  }

  async downloadFile(path) {
    const headers = { 'Authorization': `Bearer ${this.accessToken}`, 'Dropbox-API-Arg': JSON.stringify({ path }) };
    return fetch('https://content.dropboxapi.com/2/files/download', { method: 'POST', headers }).then(r => r.json());
  }

  async getFileMetadata(path) {
    return this.request('/files/get_metadata', { method: 'POST', body: JSON.stringify({ path }) });
  }

  async listFolder(path = '') {
    return this.request('/files/list_folder', { method: 'POST', body: JSON.stringify({ path }) });
  }

  async listFolderContinue(cursor) {
    return this.request('/files/list_folder/continue', { method: 'POST', body: JSON.stringify({ cursor }) });
  }

  async createFolder(path) {
    return this.request('/files/create_folder_v2', { method: 'POST', body: JSON.stringify({ path }) });
  }

  async deleteFile(path) {
    return this.request('/files/delete_v2', { method: 'POST', body: JSON.stringify({ path }) });
  }

  async moveFile(fromPath, toPath) {
    return this.request('/files/move_v2', { method: 'POST', body: JSON.stringify({ from_path: fromPath, to_path: toPath }) });
  }

  async copyFile(fromPath, toPath) {
    return this.request('/files/copy_v2', { method: 'POST', body: JSON.stringify({ from_path: fromPath, to_path: toPath }) });
  }

  async getTemporaryLink(path) {
    return this.request('/files/get_temporary_link', { method: 'POST', body: JSON.stringify({ path }) });
  }

  async getSharedLinkFile(url) {
    const headers = { 'Authorization': `Bearer ${this.accessToken}`, 'Dropbox-API-Arg': JSON.stringify({ url }) };
    return fetch('https://content.dropboxapi.com/2/sharing/get_shared_link_file', { method: 'POST', headers }).then(r => r.json());
  }

  // Sharing
  async createSharedLink(path, options = {}) {
    return this.request('/sharing/create_shared_link_with_settings', { method: 'POST', body: JSON.stringify({ path, settings: options }) });
  }

  async listSharedLinks(path = null) {
    return this.request('/sharing/list_shared_links', { method: 'POST', body: JSON.stringify({ path }) });
  }

  // Search
  async search(query, options = {}) {
    return this.request('/files/search_v2', { method: 'POST', body: JSON.stringify({ query: { query }, ...options }) });
  }

  // Users
  async getCurrentUser() {
    return this.request('/users/get_current_account');
  }

  async getSpaceUsage() {
    return this.request('/users/get_space_usage');
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

  register(name, integration) {
    this.integrations.set(name, integration);
    integration.on('error', (error) => this.emit('error', { integration: name, ...error }));
    this.emit('registered', { name });
    return this;
  }

  get(name) {
    return this.integrations.get(name);
  }

  getAll() {
    return Array.from(this.integrations.entries()).map(([name, integration]) => ({ name, ...integration.getStatus() }));
  }

  getConfigured() {
    return this.getAll().filter(i => i.configured);
  }

  getStatusSummary() {
    const all = this.getAll();
    return { total: all.length, configured: all.filter(i => i.configured).length, integrations: all };
  }
}

export function getIntegrationManager() {
  let manager = null;
  if (!manager) {
    manager = new IntegrationManager();
  }
  return manager;
}

export default {
  BaseIntegration,
  SpotifyIntegration,
  TargetIntegration,
  TripAdvisorIntegration,
  ZillowIntegration,
  Base44Integration,
  BotpressIntegration,
  BoxIntegration,
  Brand24Integration,
  BrexIntegration,
  CloudflareIntegration,
  CloudinaryIntegration,
  CourseraIntegration,
  DropboxIntegration,
  IntegrationManager,
  getIntegrationManager
};
