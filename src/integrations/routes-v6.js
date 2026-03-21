#!/usr/bin/env node

import { Router } from 'express';
import { getIntegrationManager } from './app-integrations.js';
import { 
  AdobeIntegration,
  AllTrailsIntegration,
  AppleMusicIntegration,
  BookingIntegration,
  ExpediaIntegration,
  InstacartIntegration,
  LovableIntegration,
  OpenTableIntegration,
  ReplitIntegration
} from './more-integrations.js';

// ═══════════════════════════════════════════════════════════════════════════
// 10 MORE APP INTEGRATIONS API ROUTES
// ═══════════════════════════════════════════════════════════════════════════

export function createIntegrationRoutes(app) {
  const manager = getIntegrationManager();

  // Initialize new integrations
  const adobe = new AdobeIntegration({ clientId: process.env.ADOBE_CLIENT_ID, clientSecret: process.env.ADOBE_CLIENT_SECRET, apiKey: process.env.ADOBE_ACCESS_TOKEN });
  const alltrails = new AllTrailsIntegration({ apiKey: process.env.ALLTRAILS_API_KEY });
  const appleMusic = new AppleMusicIntegration({ developerToken: process.env.APPLE_MUSIC_TOKEN, musicUserToken: process.env.APPLE_MUSIC_USER_TOKEN });
  const booking = new BookingIntegration({ apiKey: process.env.BOOKING_API_KEY, partnerId: process.env.BOOKING_PARTNER_ID });
  const expedia = new ExpediaIntegration({ apiKey: process.env.EXPEDIA_API_KEY });
  const instacart = new InstacartIntegration({ apiKey: process.env.INSTACART_API_KEY });
  const lovable = new LovableIntegration({ apiKey: process.env.LOVABLE_API_KEY });
  const opentable = new OpenTableIntegration({ apiKey: process.env.OPENTABLE_API_KEY });
  const replit = new ReplitIntegration({ apiKey: process.env.REPLIT_TOKEN });

  // Register all integrations
  manager.register('adobe', adobe);
  manager.register('alltrails', alltrails);
  manager.register('apple_music', appleMusic);
  manager.register('booking', booking);
  manager.register('expedia', expedia);
  manager.register('instacart', instacart);
  manager.register('lovable', lovable);
  manager.register('opentable', opentable);
  manager.register('replit', replit);

  // ═══════════════════════════════════════════════════════════════════════════
  // ADOBE CREATIVE CLOUD
  // ═══════════════════════════════════════════════════════════════════════════

  app.get('/api/v6/adobe/assets', async (req, res) => {
    try {
      const result = await adobe.getAssets(req.query);
      res.json({ success: true, data: result });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.get('/api/v6/adobe/assets/:id', async (req, res) => {
    try {
      const result = await adobe.getAsset(req.params.id);
      res.json({ success: true, data: result });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.post('/api/v6/adobe/photoshop/documents', async (req, res) => {
    try {
      const result = await adobe.createDocument(req.body.width, req.body.height, req.body.resolution);
      res.json({ success: true, data: result });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.post('/api/v6/adobe/firefly/generate', async (req, res) => {
    try {
      const result = await adobe.generateImage(req.body.prompt, req.body);
      res.json({ success: true, data: result });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // ALLTRAILS
  // ═══════════════════════════════════════════════════════════════════════════

  app.get('/api/v6/alltrails/search', async (req, res) => {
    try {
      const result = await alltrails.searchTrails(req.query.q, req.query);
      res.json({ success: true, data: result });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.get('/api/v6/alltrails/trails/:id', async (req, res) => {
    try {
      const result = await alltrails.getTrail(req.params.id);
      res.json({ success: true, data: result });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.get('/api/v6/alltrails/trails/:id/conditions', async (req, res) => {
    try {
      const result = await alltrails.getTrailConditions(req.params.id);
      res.json({ success: true, data: result });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.get('/api/v6/alltrails/nearby', async (req, res) => {
    try {
      const result = await alltrails.getTrailsNearby(req.query.lat, req.query.lng, req.query.radius);
      res.json({ success: true, data: result });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // APPLE MUSIC
  // ═══════════════════════════════════════════════════════════════════════════

  app.get('/api/v6/apple-music/search', async (req, res) => {
    try {
      const storefront = req.query.storefront || 'us';
      const result = await appleMusic.search(storefront, req.query.term, req.query.types);
      res.json({ success: true, data: result });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.get('/api/v6/apple-music/charts', async (req, res) => {
    try {
      const storefront = req.query.storefront || 'us';
      const result = await appleMusic.getCharts(storefront, req.query.types, req.query.chart);
      res.json({ success: true, data: result });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.get('/api/v6/apple-music/library', async (req, res) => {
    try {
      const result = await appleMusic.getLibrary();
      res.json({ success: true, data: result });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.get('/api/v6/apple-music/library/songs', async (req, res) => {
    try {
      const result = await appleMusic.getLibrarySongs(req.query.limit, req.query.offset);
      res.json({ success: true, data: result });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // BOOKING.COM
  // ═══════════════════════════════════════════════════════════════════════════

  app.get('/api/v6/booking/search', async (req, res) => {
    try {
      const result = await booking.searchHotels(req.query.location, req.query.checkin, req.query.checkout, req.query.guests);
      res.json({ success: true, data: result });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.get('/api/v6/booking/hotels/:id', async (req, res) => {
    try {
      const result = await booking.getHotelDetails(req.params.id);
      res.json({ success: true, data: result });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.get('/api/v6/booking/hotels/:id/availability', async (req, res) => {
    try {
      const result = await booking.getHotelAvailability(req.params.id, req.query.checkin, req.query.checkout);
      res.json({ success: true, data: result });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // EXPEDIA
  // ═══════════════════════════════════════════════════════════════════════════

  app.get('/api/v6/expedia/search', async (req, res) => {
    try {
      const result = await expedia.searchHotels(req.query.location, req.query.checkin, req.query.checkout, req.query.guests);
      res.json({ success: true, data: result });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.get('/api/v6/expedia/properties/:id', async (req, res) => {
    try {
      const result = await expedia.getProperty(req.params.id);
      res.json({ success: true, data: result });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.get('/api/v6/expedia/flights/search', async (req, res) => {
    try {
      const result = await expedia.searchFlights(req.query.origin, req.query.destination, req.query.depart, req.query.return, req.query.passengers);
      res.json({ success: true, data: result });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // INSTACART
  // ═══════════════════════════════════════════════════════════════════════════

  app.get('/api/v6/instacart/search', async (req, res) => {
    try {
      const result = await instacart.searchProducts(req.query.q, req.query.storeId);
      res.json({ success: true, data: result });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.get('/api/v6/instacart/stores', async (req, res) => {
    try {
      const result = await instacart.getStoresNearby(req.query.lat, req.query.lng, req.query.radius);
      res.json({ success: true, data: result });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.post('/api/v6/instacart/cart', async (req, res) => {
    try {
      const result = await instacart.createCart(req.body.storeId);
      res.json({ success: true, data: result });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.post('/api/v6/instacart/cart/:id/items', async (req, res) => {
    try {
      const result = await instacart.addToCart(req.params.id, req.body.items);
      res.json({ success: true, data: result });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // LOVABLE
  // ═══════════════════════════════════════════════════════════════════════════

  app.get('/api/v6/lovable/projects', async (req, res) => {
    try {
      const result = await lovable.listProjects();
      res.json({ success: true, data: result });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.get('/api/v6/lovable/projects/:id', async (req, res) => {
    try {
      const result = await lovable.getProject(req.params.id);
      res.json({ success: true, data: result });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.post('/api/v6/lovable/projects', async (req, res) => {
    try {
      const result = await lovable.createProject(req.body.name, req.body.description, req.body.template);
      res.json({ success: true, data: result });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.post('/api/v6/lovable/projects/:id/generate', async (req, res) => {
    try {
      const result = await lovable.generateComponent(req.params.id, req.body.prompt);
      res.json({ success: true, data: result });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.post('/api/v6/lovable/projects/:id/deploy', async (req, res) => {
    try {
      const result = await lovable.deploy(req.params.id, req.body.domain);
      res.json({ success: true, data: result });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // OPENTABLE
  // ═══════════════════════════════════════════════════════════════════════════

  app.get('/api/v6/opentable/search', async (req, res) => {
    try {
      const result = await opentable.searchRestaurants(req.query.location, req.query.cuisine, req.query.price, req.query.date, req.query.time, req.query.guests);
      res.json({ success: true, data: result });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.get('/api/v6/opentable/restaurants/:id', async (req, res) => {
    try {
      const result = await opentable.getRestaurant(req.params.id);
      res.json({ success: true, data: result });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.post('/api/v6/opentable/reservations', async (req, res) => {
    try {
      const result = await opentable.createReservation(req.body.restaurantId, req.body.date, req.body.time, req.body.guests, req.body.name, req.body.phone);
      res.json({ success: true, data: result });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.get('/api/v6/opentable/reservations', async (req, res) => {
    try {
      const result = await opentable.getUpcomingReservations();
      res.json({ success: true, data: result });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // REPLIT
  // ═══════════════════════════════════════════════════════════════════════════

  app.get('/api/v6/replit/repls', async (req, res) => {
    try {
      const result = await replit.getRepls(req.query.limit);
      res.json({ success: true, data: result });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.get('/api/v6/replit/repls/:id', async (req, res) => {
    try {
      const result = await replit.getRepl(req.params.id);
      res.json({ success: true, data: result });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.post('/api/v6/replit/repls', async (req, res) => {
    try {
      const result = await replit.createRepl(req.body.title, req.body.language, req.body.isPrivate);
      res.json({ success: true, data: result });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.post('/api/v6/replit/repls/:id/deploy', async (req, res) => {
    try {
      const result = await replit.deploy(req.params.id);
      res.json({ success: true, data: result });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.post('/api/v6/replit/ai/generate', async (req, res) => {
    try {
      const result = await replit.generateCode(req.body.prompt, req.body.language);
      res.json({ success: true, data: result });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // INTEGRATION STATUS
  // ═══════════════════════════════════════════════════════════════════════════

  app.get('/api/v6/integrations', (req, res) => {
    const status = manager.getStatusSummary();
    res.json({ success: true, ...status });
  });

  app.get('/api/v6/integrations/:name', (req, res) => {
    const integration = manager.get(req.params.name);
    if (!integration) {
      return res.status(404).json({ success: false, error: 'Integration not found' });
    }
    res.json({ success: true, status: integration.getStatus() });
  });

  return {
    manager,
    adobe,
    alltrails,
    appleMusic,
    booking,
    expedia,
    instacart,
    lovable,
    opentable,
    replit
  };
}

export default { createIntegrationRoutes };
