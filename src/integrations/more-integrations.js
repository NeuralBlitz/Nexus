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
    return {
      name: this.name,
      type: this.type,
      configured: this.isConfigured(),
      stats: this.stats
    };
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// ADOBE CREATIVE CLOUD INTEGRATION
// ═══════════════════════════════════════════════════════════════════════════

export class AdobeIntegration extends BaseIntegration {
  constructor(config = {}) {
    super({
      ...config,
      name: 'adobe',
      type: 'design',
      baseUrl: 'https://cc-api-frankfurt.adobe.io'
    });
    this.clientId = config.clientId;
    this.clientSecret = config.clientSecret;
  }

  // Assets
  async getAssets(options = {}) {
    return this.request('/v2/assets', {
      method: 'GET',
      body: options.query ? JSON.stringify({ query: options.query }) : undefined
    });
  }

  async getAsset(assetId) {
    return this.request(`/v2/assets/${assetId}`);
  }

  async createAsset(name, metadata) {
    return this.request('/v2/assets', {
      method: 'POST',
      body: JSON.stringify({ name, metadata })
    });
  }

  async deleteAsset(assetId) {
    return this.request(`/v2/assets/${assetId}`, {
      method: 'DELETE'
    });
  }

  // Photoshop Cloud Documents
  async getDocuments() {
    return this.request('/v1/photoshop/documents');
  }

  async getDocument(docId) {
    return this.request(`/v1/photoshop/documents/${docId}`);
  }

  async createDocument(width, height, resolution = 72) {
    return this.request('/v1/photoshop/documents', {
      method: 'POST',
      body: JSON.stringify({ width, height, resolution })
    });
  }

  async exportDocument(docId, format, options = {}) {
    return this.request(`/v1/photoshop/documents/${docId}/export`, {
      method: 'POST',
      body: JSON.stringify({ format, ...options })
    });
  }

  // Lightroom
  async getAlbums() {
    return this.request('/v1/lightroom/albums');
  }

  async getPhotos(albumId) {
    return this.request(`/v1/lightroom/albums/${albumId}/photos`);
  }

  async editPhoto(photoId, adjustments) {
    return this.request(`/v1/lightroom/photos/${photoId}/edit`, {
      method: 'POST',
      body: JSON.stringify({ adjustments })
    });
  }

  // Firefly (AI Image Generation)
  async generateImage(prompt, options = {}) {
    return this.request('/v1/firefly/generate', {
      method: 'POST',
      body: JSON.stringify({ prompt, ...options })
    });
  }

  async generateVariations(imageUrl, count = 4) {
    return this.request('/v1/firefly/variations', {
      method: 'POST',
      body: JSON.stringify({ imageUrl, count })
    });
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// ALLTRAILS INTEGRATION
// ═══════════════════════════════════════════════════════════════════════════

export class AllTrailsIntegration extends BaseIntegration {
  constructor(config = {}) {
    super({
      ...config,
      name: 'alltrails',
      type: 'travel',
      baseUrl: 'https://www.alltrails.com/api/v1'
    });
  }

  // Trails
  async searchTrails(query, options = {}) {
    const params = new URLSearchParams({
      q: query,
      lat: options.lat || '',
      lng: options.lng || '',
      radius: options.radius || '50'
    });
    return this.request(`/trails/search?${params}`);
  }

  async getTrail(trailId) {
    return this.request(`/trails/${trailId}`);
  }

  async getTrailsNearby(lat, lng, radius = 25, limit = 20) {
    return this.request(`/trails/nearby?lat=${lat}&lng=${lng}&radius=${radius}&limit=${limit}`);
  }

  async getTrailReviews(trailId) {
    return this.request(`/trails/${trailId}/reviews`);
  }

  async getTrailPhotos(trailId) {
    return this.request(`/trails/${trailId}/photos`);
  }

  async getTrailConditions(trailId) {
    return this.request(`/trails/${trailId}/conditions`);
  }

  async getTrailWeather(trailId) {
    return this.request(`/trails/${trailId}/weather`);
  }

  // Parks
  async searchParks(query, state = null) {
    const params = new URLSearchParams({ q: query });
    if (state) params.append('state', state);
    return this.request(`/parks/search?${params}`);
  }

  async getPark(parkId) {
    return this.request(`/parks/${parkId}`);
  }

  async getParkTrails(parkId, options = {}) {
    const params = new URLSearchParams({
      sort: options.sort || 'rating',
      difficulty: options.difficulty || '',
      limit: options.limit || '20'
    });
    return this.request(`/parks/${parkId}/trails?${params}`);
  }

  // User Activities
  async getUserActivities(userId) {
    return this.request(`/users/${userId}/activities`);
  }

  async logActivity(userId, trailId, data) {
    return this.request(`/users/${userId}/activities`, {
      method: 'POST',
      body: JSON.stringify({ trailId, ...data })
    });
  }

  // Favorites
  async getUserFavorites(userId) {
    return this.request(`/users/${userId}/favorites`);
  }

  async addFavorite(userId, trailId) {
    return this.request(`/users/${userId}/favorites`, {
      method: 'POST',
      body: JSON.stringify({ trailId })
    });
  }

  async removeFavorite(userId, trailId) {
    return this.request(`/users/${userId}/favorites/${trailId}`, {
      method: 'DELETE'
    });
  }

  // Lists
  async getUserLists(userId) {
    return this.request(`/users/${userId}/lists`);
  }

  async createList(userId, name, description = '') {
    return this.request(`/users/${userId}/lists`, {
      method: 'POST',
      body: JSON.stringify({ name, description })
    });
  }

  async addToList(listId, trailId) {
    return this.request(`/lists/${listId}/trails`, {
      method: 'POST',
      body: JSON.stringify({ trailId })
    });
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// APPLE MUSIC INTEGRATION
// ═══════════════════════════════════════════════════════════════════════════

export class AppleMusicIntegration extends BaseIntegration {
  constructor(config = {}) {
    super({
      ...config,
      name: 'apple_music',
      type: 'entertainment',
      baseUrl: 'https://api.music.apple.com/v1'
    });
    this.developerToken = config.developerToken;
    this.musicUserToken = config.musicUserToken;
  }

  getAuthHeaders() {
    const headers = { 'Authorization': `Bearer ${this.developerToken}` };
    if (this.musicUserToken) {
      headers['Music-User-Token'] = this.musicUserToken;
    }
    return headers;
  }

  // Catalog
  async getSong(storefront, songId) {
    return this.request(`/catalog/${storefront}/songs/${songId}`);
  }

  async getAlbum(storefront, albumId) {
    return this.request(`/catalog/${storefront}/albums/${albumId}`);
  }

  async getArtist(storefront, artistId) {
    return this.request(`/catalog/${storefront}/artists/${artistId}`);
  }

  async getPlaylist(storefront, playlistId) {
    return this.request(`/catalog/${storefront}/playlists/${playlistId}`);
  }

  async search(storefront, term, types = 'songs,albums,artists', limit = 25) {
    const params = new URLSearchParams({ term, types, limit });
    return this.request(`/catalog/${storefront}/search?${params}`);
  }

  async getCharts(storefront, types = 'songs', chart = 'most-played', limit = 20) {
    const params = new URLSearchParams({ types, chart, limit });
    return this.request(`/catalog/${storefront}/charts?${params}`);
  }

  async getRecommendations(storefront, types = 'albums', limit = 10) {
    return this.request(`/catalog/${storefront}/recommendations?types=${types}&limit=${limit}`);
  }

  // Library
  async getLibrary() {
    return this.request('/me/library');
  }

  async getLibrarySongs(limit = 25, offset = 0) {
    return this.request(`/me/library/songs?limit=${limit}&offset=${offset}`);
  }

  async getLibraryAlbums(limit = 25, offset = 0) {
    return this.request(`/me/library/albums?limit=${limit}&offset=${offset}`);
  }

  async getLibraryPlaylists(limit = 25) {
    return this.request(`/me/library/playlists?limit=${limit}`);
  }

  async addToLibrary(ids, type = 'songs') {
    return this.request('/me/library', {
      method: 'POST',
      body: JSON.stringify({
        [type]: ids.map(id => ({ id, type: 'library-' + type }))
      })
    });
  }

  // Playlists
  async createPlaylist(name, description = '', tracks = []) {
    return this.request('/me/library/playlists', {
      method: 'POST',
      body: JSON.stringify({
        attributes: { name, description },
        relationships: {
          tracks: { data: tracks.map(id => ({ id, type: 'songs' })) }
        }
      })
    });
  }

  async addTracksToPlaylist(playlistId, trackIds) {
    return this.request(`/me/library/playlists/${playlistId}/tracks`, {
      method: 'POST',
      body: JSON.stringify({
        data: trackIds.map(id => ({ id, type: 'songs' }))
      })
    });
  }

  // Ratings
  async getRating(type, id) {
    return this.request(`/me/ratings/${type}/${id}`);
  }

  async setRating(type, id, value) {
    return this.request(`/me/ratings/${type}/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ data: [{ id, type: 'ratings', attributes: { value } }] })
    });
  }

  // Recently Played
  async getRecentlyPlayed(limit = 10) {
    return this.request(`/me/recent/played?limit=${limit}`);
  }

  // Heavy Rotation
  async getHeavyRotation(limit = 10) {
    return this.request(`/me/history/heavy-rotation?limit=${limit}`);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// BOOKING.COM INTEGRATION
// ═══════════════════════════════════════════════════════════════════════════

export class BookingIntegration extends BaseIntegration {
  constructor(config = {}) {
    super({
      ...config,
      name: 'booking',
      type: 'travel',
      baseUrl: 'https://distribution-xml.booking.com/2.5'
    });
    this.partnerId = config.partnerId;
  }

  // Hotels
  async searchHotels(location, checkIn, checkOut, guests = 2, rooms = 1) {
    const params = new URLSearchParams({
      location,
      checkin: checkIn,
      checkout: checkOut,
      guests: guests.toString(),
      rooms: rooms.toString()
    });
    return this.request(`/hotels?${params}`);
  }

  async getHotelDetails(hotelId) {
    return this.request(`/hotels/${hotelId}`);
  }

  async getHotelAvailability(hotelId, checkIn, checkOut, rooms = 1) {
    return this.request(`/hotels/${hotelId}/availability?checkin=${checkIn}&checkout=${checkOut}&rooms=${rooms}`);
  }

  async getHotelPhotos(hotelId) {
    return this.request(`/hotels/${hotelId}/photos`);
  }

  async getHotelReviews(hotelId, limit = 20) {
    return this.request(`/hotels/${hotelId}/reviews?limit=${limit}`);
  }

  // Bookings
  async createBooking(hotelId, dates, guests, payment) {
    return this.request('/bookings', {
      method: 'POST',
      body: JSON.stringify({ hotelId, dates, guests, payment })
    });
  }

  async getBooking(bookingId) {
    return this.request(`/bookings/${bookingId}`);
  }

  async cancelBooking(bookingId, reason = '') {
    return this.request(`/bookings/${bookingId}`, {
      method: 'DELETE',
      body: JSON.stringify({ reason })
    });
  }

  async getUserBookings(userId) {
    return this.request(`/users/${userId}/bookings`);
  }

  // Destinations
  async searchDestinations(query) {
    return this.request(`/destinations/search?q=${encodeURIComponent(query)}`);
  }

  async getDestinationsPopularity(country) {
    return this.request(`/destinations/popularity?country=${country}`);
  }

  // Last Minute Deals
  async getLastMinuteDeals(location, checkIn) {
    return this.request(`/deals/last-minute?location=${location}&checkin=${checkIn}`);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// EXPEDIA INTEGRATION
// ═══════════════════════════════════════════════════════════════════════════

export class ExpediaIntegration extends BaseIntegration {
  constructor(config = {}) {
    super({
      ...config,
      name: 'expedia',
      type: 'travel',
      baseUrl: 'https://api.expediapartnercentral.com/3.3'
    });
  }

  // Hotels
  async searchHotels(location, checkIn, checkOut, guests = 2) {
    return this.request('/properties/search', {
      method: 'POST',
      body: JSON.stringify({ location, checkIn, checkOut, guests })
    });
  }

  async getProperty(propertyId) {
    return this.request(`/properties/${propertyId}`);
  }

  async getPropertyAvailability(propertyId, checkIn, checkOut) {
    return this.request(`/properties/${propertyId}/availability?checkin=${checkIn}&checkout=${checkOut}`);
  }

  async getPropertyReviews(propertyId, limit = 20) {
    return this.request(`/properties/${propertyId}/reviews?limit=${limit}`);
  }

  // Bookings
  async createBooking(propertyId, dates, guests, payment) {
    return this.request('/bookings', {
      method: 'POST',
      body: JSON.stringify({ propertyId, dates, guests, payment })
    });
  }

  async getBooking(bookingId) {
    return this.request(`/bookings/${bookingId}`);
  }

  async cancelBooking(bookingId) {
    return this.request(`/bookings/${bookingId}`, { method: 'DELETE' });
  }

  // Flights
  async searchFlights(origin, destination, departDate, returnDate = null, passengers = 1) {
    const body = { origin, destination, departDate, passengers };
    if (returnDate) body.returnDate = returnDate;
    return this.request('/flights/search', {
      method: 'POST',
      body: JSON.stringify(body)
    });
  }

  async getFlightDeal(origin, destination, month) {
    return this.request(`/flights/deals?origin=${origin}&destination=${destination}&month=${month}`);
  }

  // Packages
  async searchPackages(origin, destination, checkIn, checkOut, guests = 2) {
    return this.request('/packages/search', {
      method: 'POST',
      body: JSON.stringify({ origin, destination, checkIn, checkOut, guests })
    });
  }

  // Activities
  async searchActivities(location, date) {
    return this.request(`/activities/search?location=${location}&date=${date}`);
  }

  async getActivity(activityId) {
    return this.request(`/activities/${activityId}`);
  }

  // Points of Interest
  async getPointsOfInterest(location, radius = 10, type = null) {
    const params = new URLSearchParams({ location, radius: radius.toString() });
    if (type) params.append('type', type);
    return this.request(`/poi?${params}`);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// INSTACART INTEGRATION
// ═══════════════════════════════════════════════════════════════════════════

export class InstacartIntegration extends BaseIntegration {
  constructor(config = {}) {
    super({
      ...config,
      name: 'instacart',
      type: 'delivery',
      baseUrl: 'https://api.instacart.com/v2'
    });
  }

  // Products
  async searchProducts(query, storeId = null) {
    const params = new URLSearchParams({ q: query });
    if (storeId) params.append('store_id', storeId);
    return this.request(`/products/search?${params}`);
  }

  async getProduct(productId) {
    return this.request(`/products/${productId}`);
  }

  async getProductSuggestions(productId) {
    return this.request(`/products/${productId}/suggestions`);
  }

  // Stores
  async getStoresNearby(lat, lng, radius = 10) {
    return this.request(`/stores/nearby?lat=${lat}&lng=${lng}&radius=${radius}`);
  }

  async getStore(storeId) {
    return this.request(`/stores/${storeId}`);
  }

  async getStoreCategories(storeId) {
    return this.request(`/stores/${storeId}/categories`);
  }

  async getStoreProducts(storeId, categoryId = null) {
    const params = categoryId ? `?category_id=${categoryId}` : '';
    return this.request(`/stores/${storeId}/products${params}`);
  }

  // Cart
  async createCart(storeId) {
    return this.request('/carts', {
      method: 'POST',
      body: JSON.stringify({ store_id: storeId })
    });
  }

  async addToCart(cartId, items) {
    return this.request(`/carts/${cartId}/items`, {
      method: 'POST',
      body: JSON.stringify({ items })
    });
  }

  async updateCartItem(cartId, itemId, quantity) {
    return this.request(`/carts/${cartId}/items/${itemId}`, {
      method: 'PATCH',
      body: JSON.stringify({ quantity })
    });
  }

  async removeFromCart(cartId, itemId) {
    return this.request(`/carts/${cartId}/items/${itemId}`, {
      method: 'DELETE'
    });
  }

  async getCart(cartId) {
    return this.request(`/carts/${cartId}`);
  }

  // Orders
  async placeOrder(cartId, deliveryAddress, deliveryTime = null) {
    const body = { cart_id: cartId, delivery_address: deliveryAddress };
    if (deliveryTime) body.delivery_time = deliveryTime;
    return this.request('/orders', {
      method: 'POST',
      body: JSON.stringify(body)
    });
  }

  async getOrder(orderId) {
    return this.request(`/orders/${orderId}`);
  }

  async getOrderHistory(limit = 20) {
    return this.request(`/orders?limit=${limit}`);
  }

  async cancelOrder(orderId) {
    return this.request(`/orders/${orderId}/cancel`, {
      method: 'POST'
    });
  }

  // Recipes
  async searchRecipes(query) {
    return this.request(`/recipes/search?q=${encodeURIComponent(query)}`);
  }

  async getRecipe(recipeId) {
    return this.request(`/recipes/${recipeId}`);
  }

  async addRecipeToCart(cartId, recipeId) {
    return this.request(`/carts/${cartId}/recipes`, {
      method: 'POST',
      body: JSON.stringify({ recipe_id: recipeId })
    });
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// LOVABLE (AI App Builder) INTEGRATION
// ═══════════════════════════════════════════════════════════════════════════

export class LovableIntegration extends BaseIntegration {
  constructor(config = {}) {
    super({
      ...config,
      name: 'lovable',
      type: 'development',
      baseUrl: 'https://api.lovable.dev/v1'
    });
  }

  // Projects
  async listProjects() {
    return this.request('/projects');
  }

  async getProject(projectId) {
    return this.request(`/projects/${projectId}`);
  }

  async createProject(name, description = '', template = null) {
    const body = { name, description };
    if (template) body.template = template;
    return this.request('/projects', {
      method: 'POST',
      body: JSON.stringify(body)
    });
  }

  async deleteProject(projectId) {
    return this.request(`/projects/${projectId}`, {
      method: 'DELETE'
    });
  }

  async forkProject(projectId, name) {
    return this.request(`/projects/${projectId}/fork`, {
      method: 'POST',
      body: JSON.stringify({ name })
    });
  }

  // AI Generation
  async generateComponent(projectId, prompt) {
    return this.request(`/projects/${projectId}/generate/component`, {
      method: 'POST',
      body: JSON.stringify({ prompt })
    });
  }

  async generatePage(projectId, prompt) {
    return this.request(`/projects/${projectId}/generate/page`, {
      method: 'POST',
      body: JSON.stringify({ prompt })
    });
  }

  async refactorCode(projectId, filePath, instructions) {
    return this.request(`/projects/${projectId}/refactor`, {
      method: 'POST',
      body: JSON.stringify({ filePath, instructions })
    });
  }

  // Files
  async getFiles(projectId, path = '/') {
    return this.request(`/projects/${projectId}/files?path=${encodeURIComponent(path)}`);
  }

  async getFile(projectId, filePath) {
    return this.request(`/projects/${projectId}/files?path=${encodeURIComponent(filePath)}`);
  }

  async createFile(projectId, path, content) {
    return this.request(`/projects/${projectId}/files`, {
      method: 'POST',
      body: JSON.stringify({ path, content })
    });
  }

  async updateFile(projectId, path, content) {
    return this.request(`/projects/${projectId}/files`, {
      method: 'PUT',
      body: JSON.stringify({ path, content })
    });
  }

  async deleteFile(projectId, path) {
    return this.request(`/projects/${projectId}/files?path=${encodeURIComponent(path)}`, {
      method: 'DELETE'
    });
  }

  // Preview
  async getPreview(projectId) {
    return this.request(`/projects/${projectId}/preview`);
  }

  async deployPreview(projectId) {
    return this.request(`/projects/${projectId}/preview/deploy`, {
      method: 'POST'
    });
  }

  // Deployment
  async deploy(projectId, domain = null) {
    const body = {};
    if (domain) body.domain = domain;
    return this.request(`/projects/${projectId}/deploy`, {
      method: 'POST',
      body: JSON.stringify(body)
    });
  }

  async getDeployments(projectId) {
    return this.request(`/projects/${projectId}/deployments`);
  }

  // Chat
  async chat(projectId, message, context = {}) {
    return this.request(`/projects/${projectId}/chat`, {
      method: 'POST',
      body: JSON.stringify({ message, context })
    });
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// OPENTABLE INTEGRATION
// ═══════════════════════════════════════════════════════════════════════════

export class OpenTableIntegration extends BaseIntegration {
  constructor(config = {}) {
    super({
      ...config,
      name: 'opentable',
      type: 'dining',
      baseUrl: 'https://platform.opentable.com/api/v1'
    });
  }

  // Restaurants
  async searchRestaurants(location, cuisine = null, priceRange = null, date = null, time = null, guests = 2) {
    const params = new URLSearchParams({ location, guests: guests.toString() });
    if (cuisine) params.append('cuisine', cuisine);
    if (priceRange) params.append('price_range', priceRange);
    if (date) params.append('date', date);
    if (time) params.append('time', time);
    return this.request(`/restaurants/search?${params}`);
  }

  async getRestaurant(restaurantId) {
    return this.request(`/restaurants/${restaurantId}`);
  }

  async getRestaurantAvailability(restaurantId, date, time, guests = 2) {
    return this.request(`/restaurants/${restaurantId}/availability?date=${date}&time=${time}&guests=${guests}`);
  }

  async getRestaurantMenu(restaurantId) {
    return this.request(`/restaurants/${restaurantId}/menu`);
  }

  async getRestaurantPhotos(restaurantId) {
    return this.request(`/restaurants/${restaurantId}/photos`);
  }

  async getRestaurantReviews(restaurantId, limit = 20) {
    return this.request(`/restaurants/${restaurantId}/reviews?limit=${limit}`);
  }

  // Reservations
  async createReservation(restaurantId, date, time, guests, name, phone) {
    return this.request('/reservations', {
      method: 'POST',
      body: JSON.stringify({
        restaurant_id: restaurantId,
        date,
        time,
        guests,
        name,
        phone
      })
    });
  }

  async getReservation(reservationId) {
    return this.request(`/reservations/${reservationId}`);
  }

  async updateReservation(reservationId, updates) {
    return this.request(`/reservations/${reservationId}`, {
      method: 'PATCH',
      body: JSON.stringify(updates)
    });
  }

  async cancelReservation(reservationId) {
    return this.request(`/reservations/${reservationId}`, {
      method: 'DELETE'
    });
  }

  async getUpcomingReservations() {
    return this.request('/reservations?status=upcoming');
  }

  async getPastReservations(limit = 50) {
    return this.request(`/reservations?status=past&limit=${limit}`);
  }

  // Favorites
  async getFavorites() {
    return this.request('/favorites');
  }

  async addFavorite(restaurantId) {
    return this.request('/favorites', {
      method: 'POST',
      body: JSON.stringify({ restaurant_id: restaurantId })
    });
  }

  async removeFavorite(restaurantId) {
    return this.request(`/favorites/${restaurantId}`, {
      method: 'DELETE'
    });
  }

  // Waitlist
  async joinWaitlist(restaurantId, guests, name, phone) {
    return this.request('/waitlist', {
      method: 'POST',
      body: JSON.stringify({
        restaurant_id: restaurantId,
        guests,
        name,
        phone
      })
    });
  }

  async getWaitlistStatus(waitlistId) {
    return this.request(`/waitlist/${waitlistId}`);
  }

  async leaveWaitlist(waitlistId) {
    return this.request(`/waitlist/${waitlistId}`, {
      method: 'DELETE'
    });
  }

  // Points
  async getPoints() {
    return this.request('/points');
  }

  async redeemPoints(amount, reservationId) {
    return this.request('/points/redeem', {
      method: 'POST',
      body: JSON.stringify({ amount, reservation_id: reservationId })
    });
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// REPLIT INTEGRATION
// ═══════════════════════════════════════════════════════════════════════════

export class ReplitIntegration extends BaseIntegration {
  constructor(config = {}) {
    super({
      ...config,
      name: 'replit',
      type: 'development',
      baseUrl: 'https://replit.com/graphql'
    });
  }

  async query(operationName, query, variables = {}) {
    const response = await fetch(this.baseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Replit-User-Token': this.apiKey
      },
      body: JSON.stringify({ operationName, query, variables })
    });

    this.stats.apiCalls++;

    if (!response.ok) {
      this.stats.errors++;
      throw new Error(`Replit API error: ${response.status}`);
    }

    const data = await response.json();
    if (data.errors) {
      throw new Error(`GraphQL error: ${data.errors[0].message}`);
    }

    return data.data;
  }

  // Repls
  async getRepls(limit = 20) {
    return this.query('Repls', `
      query Repls($limit: Int) {
        currentUser {
          repls(count: $limit) {
            items {
              id
              title
              description
              url
              isPrivate
              language
              createdAt
              updatedAt
            }
          }
        }
      }
    `, { limit });
  }

  async getRepl(replId) {
    return this.query('GetRepl', `
      query GetRepl($id: String!) {
        repl(id: $id) {
          id
          title
          description
          url
          isPrivate
          language
          createdAt
          updatedAt
          files {
            path
            content
          }
        }
      }
    `, { id: replId });
  }

  async createRepl(title, language, isPrivate = false) {
    return this.query('CreateRepl', `
      mutation CreateRepl($input: CreateReplInput!) {
        createRepl(input: $input) {
          repl {
            id
            title
            url
          }
        }
      }
    `, { input: { title, languageName: language, isPrivate } });
  }

  async deleteRepl(replId) {
    return this.query('DeleteRepl', `
      mutation DeleteRepl($id: String!) {
        deleteRepl(id: $id) {
          success
        }
      }
    `, { id: replId });
  }

  async forkRepl(replId, title = null) {
    return this.query('ForkRepl', `
      mutation ForkRepl($input: ForkReplInput!) {
        forkRepl(input: $input) {
          repl {
            id
            title
            url
          }
        }
      }
    `, { input: { replId, title } });
  }

  // Files
  async getFiles(replId, path = '/') {
    return this.query('GetFiles', `
      query GetFiles($replId: String!, $path: String!) {
        repl(id: $replId) {
          fileSystem {
            entries(path: $path) {
              path
              type
              size
              modified
            }
          }
        }
      }
    `, { replId, path });
  }

  async getFile(replId, path) {
    return this.query('GetFile', `
      query GetFile($replId: String!, $path: String!) {
        repl(id: $replId) {
          fileSystem {
            file(path: $path) {
              path
              content
              size
              modified
            }
          }
        }
      }
    `, { replId, path });
  }

  async createFile(replId, path, content) {
    return this.query('CreateFile', `
      mutation CreateFile($input: CreateFileInput!) {
        createFile(input: $input) {
          file {
            path
          }
        }
      }
    `, { input: { replId, path, content } });
  }

  async updateFile(replId, path, content) {
    return this.query('UpdateFile', `
      mutation UpdateFile($input: UpdateFileInput!) {
        updateFile(input: $input) {
          file {
            path
          }
        }
      }
    `, { input: { replId, path, content } });
  }

  async deleteFile(replId, path) {
    return this.query('DeleteFile', `
      mutation DeleteFile($input: DeleteFileInput!) {
        deleteFile(input: $input) {
          success
        }
      }
    `, { input: { replId, path } });
  }

  // Deployments
  async getDeployments(replId) {
    return this.query('GetDeployments', `
      query GetDeployments($replId: String!) {
        repl(id: $replId) {
          deployments {
            items {
              id
              status
              url
              createdAt
            }
          }
        }
      }
    `, { replId });
  }

  async deploy(replId) {
    return this.query('Deploy', `
      mutation Deploy($input: DeployInput!) {
        deploy(input: $input) {
          deployment {
            id
            status
            url
          }
        }
      }
    `, { input: { replId } });
  }

  // AI Features
  async generateCode(prompt, language = 'javascript') {
    return this.query('GenerateCode', `
      mutation GenerateCode($input: GenerateCodeInput!) {
        generateCode(input: $input) {
          code
          explanation
        }
      }
    `, { input: { prompt, language } });
  }

  async explainCode(code) {
    return this.query('ExplainCode', `
      mutation ExplainCode($input: ExplainCodeInput!) {
        explainCode(input: $input) {
          explanation
        }
      }
    `, { input: { code } });
  }

  // User
  async getCurrentUser() {
    return this.query('CurrentUser', `
      query CurrentUser {
        currentUser {
          id
          username
          email
          createdAt
          reputation
          isHacker
        }
      }
    `);
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
    return Array.from(this.integrations.entries()).map(([name, integration]) => ({
      name,
      ...integration.getStatus()
    }));
  }

  getConfigured() {
    return this.getAll().filter(i => i.configured);
  }

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
  }
  return manager;
}

export default {
  BaseIntegration,
  AdobeIntegration,
  AllTrailsIntegration,
  AppleMusicIntegration,
  BookingIntegration,
  ExpediaIntegration,
  InstacartIntegration,
  LovableIntegration,
  OpenTableIntegration,
  ReplitIntegration,
  IntegrationManager,
  getIntegrationManager
};
