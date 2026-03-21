#!/usr/bin/env node

import { getIntegrationManager } from './enterprise-integrations.js';
import {
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
  DropboxIntegration
} from './enterprise-integrations.js';

export function createEnterpriseRoutes(app) {
  const manager = getIntegrationManager();

  // Initialize integrations
  const spotify = new SpotifyIntegration({ accessToken: process.env.SPOTIFY_ACCESS_TOKEN, clientId: process.env.SPOTIFY_CLIENT_ID, clientSecret: process.env.SPOTIFY_CLIENT_SECRET });
  const target = new TargetIntegration({ apiKey: process.env.TARGET_API_KEY });
  const tripadvisor = new TripAdvisorIntegration({ apiKey: process.env.TRIPADVISOR_API_KEY });
  const zillow = new ZillowIntegration({ accessToken: process.env.ZILLOW_ACCESS_TOKEN });
  const base44 = new Base44Integration({ apiKey: process.env.BASE44_API_KEY });
  const botpress = new BotpressIntegration({ apiKey: process.env.BOTPRESS_API_KEY, botId: process.env.BOTPRESS_BOT_ID });
  const box = new BoxIntegration({ accessToken: process.env.BOX_ACCESS_TOKEN });
  const brand24 = new Brand24Integration({ apiKey: process.env.BRAND24_API_KEY });
  const brex = new BrexIntegration({ accessToken: process.env.BREX_ACCESS_TOKEN });
  const cloudflare = new CloudflareIntegration({ email: process.env.CF_EMAIL, apiKey: process.env.CF_API_KEY });
  const cloudinary = new CloudinaryIntegration({ cloudName: process.env.CLOUDINARY_CLOUD, apiKey: process.env.CLOUDINARY_KEY, apiSecret: process.env.CLOUDINARY_SECRET });
  const coursera = new CourseraIntegration({ oauthToken: process.env.COURSERA_TOKEN });
  const dropbox = new DropboxIntegration({ accessToken: process.env.DROPBOX_ACCESS_TOKEN });

  // Register all
  manager.register('spotify', spotify);
  manager.register('target', target);
  manager.register('tripadvisor', tripadvisor);
  manager.register('zillow', zillow);
  manager.register('base44', base44);
  manager.register('botpress', botpress);
  manager.register('box', box);
  manager.register('brand24', brand24);
  manager.register('brex', brex);
  manager.register('cloudflare', cloudflare);
  manager.register('cloudinary', cloudinary);
  manager.register('coursera', coursera);
  manager.register('dropbox', dropbox);

  // ═══════════════════════════════════════════════════════════════════════════
  // SPOTIFY
  // ═══════════════════════════════════════════════════════════════════════════

  app.get('/api/v7/spotify/me', async (req, res) => {
    try { res.json({ success: true, data: await spotify.getMe() }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.get('/api/v7/spotify/playlists', async (req, res) => {
    try { res.json({ success: true, data: await spotify.getPlaylists() }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.post('/api/v7/spotify/playlists', async (req, res) => {
    try { res.json({ success: true, data: await spotify.createPlaylist(req.body.name, req.body.description, req.body.isPublic) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.get('/api/v7/spotify/search', async (req, res) => {
    try { res.json({ success: true, data: await spotify.search(req.query.q, req.query.types?.split(','), parseInt(req.query.limit) || 20) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.get('/api/v7/spotify/tracks/:id', async (req, res) => {
    try { res.json({ success: true, data: await spotify.getTrack(req.params.id) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.get('/api/v7/spotify/artists/:id', async (req, res) => {
    try { res.json({ success: true, data: await spotify.getArtist(req.params.id) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.get('/api/v7/spotify/recommendations', async (req, res) => {
    try { res.json({ success: true, data: await spotify.getRecommendations(req.query.seed?.split(','), req.query.artists?.split(','), req.query.genres?.split(',')) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.get('/api/v7/spotify/player', async (req, res) => {
    try { res.json({ success: true, data: await spotify.getPlaybackState() }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.post('/api/v7/spotify/player/play', async (req, res) => {
    try { await spotify.startPlayback(req.body.deviceId, req.body.contextUri, req.body.uris); res.json({ success: true }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.post('/api/v7/spotify/player/pause', async (req, res) => {
    try { await spotify.pausePlayback(req.body.deviceId); res.json({ success: true }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // TARGET
  // ═══════════════════════════════════════════════════════════════════════════

  app.get('/api/v7/target/search', async (req, res) => {
    try { res.json({ success: true, data: await target.searchProducts(req.query.q, req.query) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.get('/api/v7/target/products/:id', async (req, res) => {
    try { res.json({ success: true, data: await target.getProduct(req.params.id) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.get('/api/v7/target/stores', async (req, res) => {
    try { res.json({ success: true, data: await target.searchStores(req.query.zip, req.query.radius) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.get('/api/v7/target/deals', async (req, res) => {
    try { res.json({ success: true, data: await target.getDeals(req.query) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // TRIPADVISOR
  // ═══════════════════════════════════════════════════════════════════════════

  app.get('/api/v7/tripadvisor/search', async (req, res) => {
    try { res.json({ success: true, data: await tripadvisor.searchLocations(req.query.q, req.query) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.get('/api/v7/tripadvisor/locations/:id', async (req, res) => {
    try { res.json({ success: true, data: await tripadvisor.getLocationDetails(req.params.id) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.get('/api/v7/tripadvisor/nearby', async (req, res) => {
    try { res.json({ success: true, data: await tripadvisor.getNearbyLocations(req.query.lat, req.query.lng, req.query) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.get('/api/v7/tripadvisor/restaurants', async (req, res) => {
    try { res.json({ success: true, data: await tripadvisor.getRestaurants(req.query.lat, req.query.lng, req.query) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.get('/api/v7/tripadvisor/attractions', async (req, res) => {
    try { res.json({ success: true, data: await tripadvisor.getAttractions(req.query.lat, req.query.lng, req.query) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // ZILLOW
  // ═══════════════════════════════════════════════════════════════════════════

  app.get('/api/v7/zillow/search', async (req, res) => {
    try { res.json({ success: true, data: await zillow.searchProperties(req.query.q, req.query) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.get('/api/v7/zillow/properties/:id', async (req, res) => {
    try { res.json({ success: true, data: await zillow.getProperty(req.params.id) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.get('/api/v7/zillow/properties/:id/estimate', async (req, res) => {
    try { res.json({ success: true, data: await zillow.getPropertyEstimate(req.params.id) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // BASE44
  // ═══════════════════════════════════════════════════════════════════════════

  app.get('/api/v7/base44/apps', async (req, res) => {
    try { res.json({ success: true, data: await base44.listApps() }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.post('/api/v7/base44/ai/generate', async (req, res) => {
    try { res.json({ success: true, data: await base44.generateContent(req.body.prompt, req.body.type, req.body) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.post('/api/v7/base44/ai/image', async (req, res) => {
    try { res.json({ success: true, data: await base44.generateImage(req.body.prompt, req.body) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.post('/api/v7/base44/chat', async (req, res) => {
    try { res.json({ success: true, data: await base44.chat(req.body.message, req.body.context) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // BOTPRESS
  // ═══════════════════════════════════════════════════════════════════════════

  app.get('/api/v7/botpress/conversations', async (req, res) => {
    try { res.json({ success: true, data: await botpress.listConversations(req.query) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.post('/api/v7/botpress/conversations', async (req, res) => {
    try { res.json({ success: true, data: await botpress.createConversation(req.body.userId) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.post('/api/v7/botpress/conversations/:id/messages', async (req, res) => {
    try { res.json({ success: true, data: await botpress.sendMessage(req.params.id, req.body.content, req.body) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.post('/api/v7/botpress/ai/generate', async (req, res) => {
    try { res.json({ success: true, data: await botpress.generateResponse(req.body.prompt, req.body.context) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // BOX
  // ═══════════════════════════════════════════════════════════════════════════

  app.get('/api/v7/box/files/:id', async (req, res) => {
    try { res.json({ success: true, data: await box.getFile(req.params.id) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.get('/api/v7/box/folders/:id/items', async (req, res) => {
    try { res.json({ success: true, data: await box.getFolderItems(req.params.id, req.query) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.post('/api/v7/box/folders', async (req, res) => {
    try { res.json({ success: true, data: await box.createFolder(req.body.name, req.body.parentId) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.get('/api/v7/box/search', async (req, res) => {
    try { res.json({ success: true, data: await box.search(req.query.q, req.query) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.get('/api/v7/box/user', async (req, res) => {
    try { res.json({ success: true, data: await box.getCurrentUser() }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // BRAND24
  // ═══════════════════════════════════════════════════════════════════════════

  app.get('/api/v7/brand24/projects', async (req, res) => {
    try { res.json({ success: true, data: await brand24.listProjects() }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.get('/api/v7/brand24/projects/:id', async (req, res) => {
    try { res.json({ success: true, data: await brand24.getProject(req.params.id) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.get('/api/v7/brand24/mentions', async (req, res) => {
    try { res.json({ success: true, data: await brand24.getMentions(req.query.projectId, req.query) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.get('/api/v7/brand24/analytics', async (req, res) => {
    try { res.json({ success: true, data: await brand24.getProjectAnalytics(req.query.projectId, req.query) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // BREX
  // ═══════════════════════════════════════════════════════════════════════════

  app.get('/api/v7/brex/user', async (req, res) => {
    try { res.json({ success: true, data: await brex.getCurrentUser() }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.get('/api/v7/brex/cards', async (req, res) => {
    try { res.json({ success: true, data: await brex.listCards() }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.get('/api/v7/brex/transactions', async (req, res) => {
    try { res.json({ success: true, data: await brex.listTransactions(req.query) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.get('/api/v7/brex/expenses', async (req, res) => {
    try { res.json({ success: true, data: await brex.listExpenses(req.query) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // CLOUDFLARE
  // ═══════════════════════════════════════════════════════════════════════════

  app.get('/api/v7/cloudflare/zones', async (req, res) => {
    try { res.json({ success: true, data: await cloudflare.listZones(req.query) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.get('/api/v7/cloudflare/zones/:id', async (req, res) => {
    try { res.json({ success: true, data: await cloudflare.getZone(req.params.id) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.get('/api/v7/cloudflare/zones/:id/dns', async (req, res) => {
    try { res.json({ success: true, data: await cloudflare.listDnsRecords(req.params.id, req.query) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.post('/api/v7/cloudflare/zones/:id/dns', async (req, res) => {
    try { res.json({ success: true, data: await cloudflare.createDnsRecord(req.params.id, req.body) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // CLOUDINARY
  // ═══════════════════════════════════════════════════════════════════════════

  app.post('/api/v7/cloudinary/upload', async (req, res) => {
    try { res.json({ success: true, data: await cloudinary.upload(req.body.file, req.body) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.get('/api/v7/cloudinary/resources', async (req, res) => {
    try { res.json({ success: true, data: await cloudinary.listResources(req.query) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.get('/api/v7/cloudinary/transformations', async (req, res) => {
    try { res.json({ success: true, data: await cloudinary.listTransformations() }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // COURSERA
  // ═══════════════════════════════════════════════════════════════════════════

  app.get('/api/v7/coursera/courses', async (req, res) => {
    try { res.json({ success: true, data: await coursera.searchCourses(req.query.q, req.query) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.get('/api/v7/coursera/courses/:id', async (req, res) => {
    try { res.json({ success: true, data: await coursera.getCourse(req.params.id) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.get('/api/v7/coursera/categories', async (req, res) => {
    try { res.json({ success: true, data: await coursera.getCategories() }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // DROPBOX
  // ═══════════════════════════════════════════════════════════════════════════

  app.get('/api/v7/dropbox/files', async (req, res) => {
    try { res.json({ success: true, data: await dropbox.listFolder(req.query.path || '') }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.post('/api/v7/dropbox/files', async (req, res) => {
    try { res.json({ success: true, data: await dropbox.uploadFile(req.body.path, req.body.content) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.get('/api/v7/dropbox/search', async (req, res) => {
    try { res.json({ success: true, data: await dropbox.search(req.query.q, req.query) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.get('/api/v7/dropbox/user', async (req, res) => {
    try { res.json({ success: true, data: await dropbox.getCurrentUser() }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // STATUS
  // ═══════════════════════════════════════════════════════════════════════════

  app.get('/api/v7/integrations', (req, res) => {
    res.json({ success: true, ...manager.getStatusSummary() });
  });

  return { manager, spotify, target, tripadvisor, zillow, base44, botpress, box, brand24, brex, cloudflare, cloudinary, coursera, dropbox };
}

export default { createEnterpriseRoutes };
