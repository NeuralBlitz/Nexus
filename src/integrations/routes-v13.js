#!/usr/bin/env node

import { getDataIntegrationManager } from './data-integrations.js';
import {
  WolframAlphaIntegration,
  IBMWatsonIntegration,
  ClarifaiIntegration,
  DarkSkyIntegration,
  MapboxIntegration,
  OpenWeatherMapIntegration,
  HEREMapsIntegration,
  AlgoliaIntegration,
  ElasticsearchIntegration,
  PineconeIntegration,
  WeaviateIntegration,
  QdrantIntegration,
  MeilisearchIntegration,
  TypesenseIntegration,
  WolframCloudIntegration,
  DataRobotIntegration,
  KNIMEIntegration,
  RapidMinerIntegration,
  AlteryxIntegration,
  TrifactaIntegration
} from './data-integrations.js';

export function createDataRoutes(app) {
  const manager = getDataIntegrationManager();

  const wolframalpha = new WolframAlphaIntegration({ appId: process.env.WOLFRAM_APP_ID });
  const ibmwatson = new IBMWatsonIntegration({ apiKey: process.env.IBM_WATSON_API_KEY, url: process.env.IBM_WATSON_URL });
  const clarifai = new ClarifaiIntegration({ apiKey: process.env.CLARIFAI_API_KEY });
  const darksky = new DarkSkyIntegration({ apiKey: process.env.DARKSKY_API_KEY });
  const mapbox = new MapboxIntegration({ accessToken: process.env.MAPBOX_ACCESS_TOKEN });
  const openweathermap = new OpenWeatherMapIntegration({ apiKey: process.env.OWM_API_KEY });
  const heremaps = new HEREMapsIntegration({ apiKey: process.env.HERE_API_KEY });
  const algolia = new AlgoliaIntegration({ appId: process.env.ALGOLIA_APP_ID, apiKey: process.env.ALGOLIA_API_KEY });
  const elasticsearch = new ElasticsearchIntegration({ node: process.env.ES_NODE, username: process.env.ES_USERNAME, password: process.env.ES_PASSWORD });
  const pinecone = new PineconeIntegration({ apiKey: process.env.PINECONE_API_KEY });
  const weaviate = new WeaviateIntegration({ url: process.env.WEAVIATE_URL });
  const qdrant = new QdrantIntegration({ url: process.env.QDRANT_URL });
  const meilisearch = new MeilisearchIntegration({ host: process.env.MEILI_HOST, apiKey: process.env.MEILI_API_KEY });
  const typesense = new TypesenseIntegration({ host: process.env.TYPESENSE_HOST, apiKey: process.env.TYPESENSE_API_KEY });
  const wolframcloud = new WolframCloudIntegration({ apiKey: process.env.WOLFRAMCLOUD_API_KEY });
  const datarobot = new DataRobotIntegration({ apiKey: process.env.DATAROBOT_API_KEY });
  const knime = new KNIMEIntegration({ serverUrl: process.env.KNIME_SERVER_URL });
  const rapidminer = new RapidMinerIntegration({ apiKey: process.env.RAPIDMINER_API_KEY });
  const alteryx = new AlteryxIntegration({ apiKey: process.env.ALTERYX_API_KEY });
  const trifacta = new TrifactaIntegration({ apiKey: process.env.TRIFACTA_API_KEY });

  manager.register('wolframalpha', wolframalpha);
  manager.register('ibmwatson', ibmwatson);
  manager.register('clarifai', clarifai);
  manager.register('darksky', darksky);
  manager.register('mapbox', mapbox);
  manager.register('openweathermap', openweathermap);
  manager.register('heremaps', heremaps);
  manager.register('algolia', algolia);
  manager.register('elasticsearch', elasticsearch);
  manager.register('pinecone', pinecone);
  manager.register('weaviate', weaviate);
  manager.register('qdrant', qdrant);
  manager.register('meilisearch', meilisearch);
  manager.register('typesense', typesense);
  manager.register('wolframcloud', wolframcloud);
  manager.register('datarobot', datarobot);
  manager.register('knime', knime);
  manager.register('rapidminer', rapidminer);
  manager.register('alteryx', alteryx);
  manager.register('trifacta', trifacta);

  // ═══════════════════════════════════════════════════════════════════════════
  // WOLFRAM ALPHA
  // ═══════════════════════════════════════════════════════════════════════════

  app.get('/api/v13/wolfram/query', async (req, res) => {
    try { res.json({ success: true, data: await wolframalpha.query(req.query.question) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.get('/api/v13/wolfram/full', async (req, res) => {
    try { res.json({ success: true, data: await wolframalpha.fullResults(req.query.question) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.get('/api/v13/wolfram/simple', async (req, res) => {
    try { res.json({ success: true, data: await wolframalpha.simpleQuery(req.query.question) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // IBM WATSON
  // ═══════════════════════════════════════════════════════════════════════════

  app.post('/api/v13/watson/analyze', async (req, res) => {
    try { res.json({ success: true, data: await ibmwatson.analyzeText(req.body.text, req.body.features) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.post('/api/v13/watson/entities', async (req, res) => {
    try { res.json({ success: true, data: await ibmwatson.detectEntities(req.body.text) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.post('/api/v13/watson/sentiment', async (req, res) => {
    try { res.json({ success: true, data: await ibmwatson.detectSentiment(req.body.text) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.post('/api/v13/watson/classify', async (req, res) => {
    try { res.json({ success: true, data: await ibmwatson.classify(req.body.text, req.body.classifierId) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.post('/api/v13/watson/classifier', async (req, res) => {
    try { res.json({ success: true, data: await ibmwatson.createClassifier(req.body.trainingData) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // CLARIFAI
  // ═══════════════════════════════════════════════════════════════════════════

  app.post('/api/v13/clarifai/predict', async (req, res) => {
    try { res.json({ success: true, data: await clarifai.predictImage(req.body.imageUrl, req.body.modelId) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.post('/api/v13/clarifai/concepts', async (req, res) => {
    try { res.json({ success: true, data: await clarifai.predictConcepts(req.body.imageUrl) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.post('/api/v13/clarifai/faces', async (req, res) => {
    try { res.json({ success: true, data: await clarifai.detectFaces(req.body.imageUrl) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.get('/api/v13/clarifai/search', async (req, res) => {
    try { res.json({ success: true, data: await clarifai.searchInputs(req.query.query) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.post('/api/v13/clarifai/concepts', async (req, res) => {
    try { res.json({ success: true, data: await clarifai.createConcept(req.body.name) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // DARK SKY
  // ═══════════════════════════════════════════════════════════════════════════

  app.get('/api/v13/darksky/current', async (req, res) => {
    try { res.json({ success: true, data: await darksky.getCurrentWeather(parseFloat(req.query.lat), parseFloat(req.query.lon)) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.get('/api/v13/darksky/forecast', async (req, res) => {
    try { res.json({ success: true, data: await darksky.getForecast(parseFloat(req.query.lat), parseFloat(req.query.lon)) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.get('/api/v13/darksky/timemachine', async (req, res) => {
    try { res.json({ success: true, data: await darksky.getTimeMachine(parseFloat(req.query.lat), parseFloat(req.query.lon), req.query.time) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // MAPBOX
  // ═══════════════════════════════════════════════════════════════════════════

  app.get('/api/v13/mapbox/geocode', async (req, res) => {
    try { res.json({ success: true, data: await mapbox.geocode(req.query.address) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.get('/api/v13/mapbox/reverse-geocode', async (req, res) => {
    try { res.json({ success: true, data: await mapbox.reverseGeocode(parseFloat(req.query.lon), parseFloat(req.query.lat)) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.get('/api/v13/mapbox/directions', async (req, res) => {
    try { res.json({ success: true, data: await mapbox.directions(req.query.origin, req.query.destination, req.query.profile) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.get('/api/v13/mapbox/static', async (req, res) => {
    try { res.json({ success: true, data: await mapbox.staticMap(req.query.center.split(',').map(Number), parseInt(req.query.zoom) || 12) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.get('/api/v13/mapbox/matrix', async (req, res) => {
    try { res.json({ success: true, data: await mapbox.getMatrix(req.query.origins.split(';'), req.query.destinations.split(';')) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.get('/api/v13/mapbox/search', async (req, res) => {
    try { res.json({ success: true, data: await mapbox.searchPlaces(req.query.query, req.query.proximity) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // OPENWEATHERMAP
  // ═══════════════════════════════════════════════════════════════════════════

  app.get('/api/v13/openweathermap/current', async (req, res) => {
    try { res.json({ success: true, data: await openweathermap.getCurrentWeather(req.query.city) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.get('/api/v13/openweathermap/forecast', async (req, res) => {
    try { res.json({ success: true, data: await openweathermap.getForecast(req.query.city, parseInt(req.query.days) || 5) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.get('/api/v13/openweathermap/coordinates', async (req, res) => {
    try { res.json({ success: true, data: await openweathermap.getByCoordinates(parseFloat(req.query.lat), parseFloat(req.query.lon)) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.get('/api/v13/openweathermap/air', async (req, res) => {
    try { res.json({ success: true, data: await openweathermap.getAirPollution(parseFloat(req.query.lat), parseFloat(req.query.lon)) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // HERE MAPS
  // ═══════════════════════════════════════════════════════════════════════════

  app.get('/api/v13/heremaps/geocode', async (req, res) => {
    try { res.json({ success: true, data: await heremaps.geocode(req.query.address) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.get('/api/v13/heremaps/reverse-geocode', async (req, res) => {
    try { res.json({ success: true, data: await heremaps.reverseGeocode(parseFloat(req.query.lat), parseFloat(req.query.lon)) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.get('/api/v13/heremaps/route', async (req, res) => {
    try { res.json({ success: true, data: await heremaps.route(req.query.from, req.query.to, req.query.mode) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // ALGOLIA
  // ═══════════════════════════════════════════════════════════════════════════

  app.get('/api/v13/algolia/search', async (req, res) => {
    try { res.json({ success: true, data: await algolia.search(req.query.index, req.query.q) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.get('/api/v13/algolia/object', async (req, res) => {
    try { res.json({ success: true, data: await algolia.getObject(req.query.index, req.query.objectId) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.post('/api/v13/algolia/object', async (req, res) => {
    try { res.json({ success: true, data: await algolia.saveObject(req.body.index, req.body.object) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.delete('/api/v13/algolia/object', async (req, res) => {
    try { res.json({ success: true, data: await algolia.deleteObject(req.body.index, req.body.objectId) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.get('/api/v13/algolia/settings', async (req, res) => {
    try { res.json({ success: true, data: await algolia.getIndexSettings(req.query.index) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.put('/api/v13/algolia/settings', async (req, res) => {
    try { res.json({ success: true, data: await algolia.setIndexSettings(req.body.index, req.body.settings) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // ELASTICSEARCH
  // ═══════════════════════════════════════════════════════════════════════════

  app.get('/api/v13/elasticsearch/search', async (req, res) => {
    try { res.json({ success: true, data: await elasticsearch.search(req.query.index, req.body?.query) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.post('/api/v13/elasticsearch/index', async (req, res) => {
    try { res.json({ success: true, data: await elasticsearch.index(req.body.index, req.body.document) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.get('/api/v13/elasticsearch/document', async (req, res) => {
    try { res.json({ success: true, data: await elasticsearch.get(req.query.index, req.query.id) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.delete('/api/v13/elasticsearch/document', async (req, res) => {
    try { res.json({ success: true, data: await elasticsearch.delete(req.body.index, req.body.id) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.post('/api/v13/elasticsearch/index-create', async (req, res) => {
    try { res.json({ success: true, data: await elasticsearch.createIndex(req.body.index, req.body.mappings) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.get('/api/v13/elasticsearch/health', async (req, res) => {
    try { res.json({ success: true, data: await elasticsearch.clusterHealth() }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // PINECONE
  // ═══════════════════════════════════════════════════════════════════════════

  app.post('/api/v13/pinecone/upsert', async (req, res) => {
    try { res.json({ success: true, data: await pinecone.upsert(req.body.index, req.body.vectors) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.post('/api/v13/pinecone/query', async (req, res) => {
    try { res.json({ success: true, data: await pinecone.query(req.body.index, req.body.vector, req.body.topK) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.get('/api/v13/pinecone/fetch', async (req, res) => {
    try { res.json({ success: true, data: await pinecone.fetch(req.query.index, req.query.ids.split(',')) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.delete('/api/v13/pinecone/delete', async (req, res) => {
    try { res.json({ success: true, data: await pinecone.delete(req.body.index, req.body.ids) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.get('/api/v13/pinecone/index/:name', async (req, res) => {
    try { res.json({ success: true, data: await pinecone.describeIndex(req.params.name) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.get('/api/v13/pinecone/indexes', async (req, res) => {
    try { res.json({ success: true, data: await pinecone.listIndexes() }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // WEAVIATE
  // ═══════════════════════════════════════════════════════════════════════════

  app.get('/api/v13/weaviate/search', async (req, res) => {
    try { res.json({ success: true, data: await weaviate.search(req.query.class, req.query.query, req.query.properties?.split(',')) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.post('/api/v13/weaviate/object', async (req, res) => {
    try { res.json({ success: true, data: await weaviate.addObject(req.body.className, req.body.object) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.get('/api/v13/weaviate/object', async (req, res) => {
    try { res.json({ success: true, data: await weaviate.getObject(req.query.class, req.query.id) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.delete('/api/v13/weaviate/object', async (req, res) => {
    try { res.json({ success: true, data: await weaviate.deleteObject(req.body.class, req.body.id) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // QDRANT
  // ═══════════════════════════════════════════════════════════════════════════

  app.post('/api/v13/qdrant/upsert', async (req, res) => {
    try { res.json({ success: true, data: await qdrant.upsert(req.body.collection, req.body.points) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.post('/api/v13/qdrant/search', async (req, res) => {
    try { res.json({ success: true, data: await qdrant.search(req.body.collection, req.body.vector, req.body.limit) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.get('/api/v13/qdrant/point', async (req, res) => {
    try { res.json({ success: true, data: await qdrant.get(req.query.collection, req.query.id) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.delete('/api/v13/qdrant/points', async (req, res) => {
    try { res.json({ success: true, data: await qdrant.delete(req.body.collection, req.body.ids) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.get('/api/v13/qdrant/collections', async (req, res) => {
    try { res.json({ success: true, data: await qdrant.listCollections() }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // MEILISEARCH
  // ═══════════════════════════════════════════════════════════════════════════

  app.get('/api/v13/meilisearch/search', async (req, res) => {
    try { res.json({ success: true, data: await meilisearch.search(req.query.index, req.query.q) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.post('/api/v13/meilisearch/documents', async (req, res) => {
    try { res.json({ success: true, data: await meilisearch.addDocuments(req.body.index, req.body.documents) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.get('/api/v13/meilisearch/document', async (req, res) => {
    try { res.json({ success: true, data: await meilisearch.getDocument(req.query.index, req.query.id) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.delete('/api/v13/meilisearch/document', async (req, res) => {
    try { res.json({ success: true, data: await meilisearch.deleteDocument(req.body.index, req.body.id) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.get('/api/v13/meilisearch/stats', async (req, res) => {
    try { res.json({ success: true, data: await meilisearch.getStats(req.query.index) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // TYPESENSE
  // ═══════════════════════════════════════════════════════════════════════════

  app.get('/api/v13/typesense/search', async (req, res) => {
    try { res.json({ success: true, data: await typesense.search(req.query.collection, req.query.q) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.post('/api/v13/typesense/upsert', async (req, res) => {
    try { res.json({ success: true, data: await typesense.upsert(req.body.collection, req.body.document) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.get('/api/v13/typesense/document', async (req, res) => {
    try { res.json({ success: true, data: await typesense.get(req.query.collection, req.query.id) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.delete('/api/v13/typesense/document', async (req, res) => {
    try { res.json({ success: true, data: await typesense.delete(req.body.collection, req.body.id) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // WOLFRAM CLOUD
  // ═══════════════════════════════════════════════════════════════════════════

  app.post('/api/v13/wolframcloud/evaluate', async (req, res) => {
    try { res.json({ success: true, data: await wolframcloud.evaluate(req.body.expression) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.post('/api/v13/wolframcloud/deploy', async (req, res) => {
    try { res.json({ success: true, data: await wolframcloud.deployFunction(req.body.name, req.body.code) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.post('/api/v13/wolframcloud/invoke', async (req, res) => {
    try { res.json({ success: true, data: await wolframcloud.invokeFunction(req.body.name, req.body.args) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.get('/api/v13/wolframcloud/deployments', async (req, res) => {
    try { res.json({ success: true, data: await wolframcloud.listDeployments() }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // DATA ROBOT
  // ═══════════════════════════════════════════════════════════════════════════

  app.post('/api/v13/datarobot/predict', async (req, res) => {
    try { res.json({ success: true, data: await datarobot.predict(req.body.modelId, req.body.data) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.get('/api/v13/datarobot/models', async (req, res) => {
    try { res.json({ success: true, data: await datarobot.getModels() }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.get('/api/v13/datarobot/models/:id', async (req, res) => {
    try { res.json({ success: true, data: await datarobot.getModel(req.params.id) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.post('/api/v13/datarobot/train', async (req, res) => {
    try { res.json({ success: true, data: await datarobot.trainModel(req.body.datasetId, req.body.targetColumn) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.get('/api/v13/datarobot/predictions/:id', async (req, res) => {
    try { res.json({ success: true, data: await datarobot.getPredictions(req.params.id) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // KNIME
  // ═══════════════════════════════════════════════════════════════════════════

  app.get('/api/v13/knime/workflows', async (req, res) => {
    try { res.json({ success: true, data: await knime.listWorkflows() }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.get('/api/v13/knime/workflows/:id', async (req, res) => {
    try { res.json({ success: true, data: await knime.getWorkflow(req.params.id) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.post('/api/v13/knime/workflows/:id/execute', async (req, res) => {
    try { res.json({ success: true, data: await knime.executeWorkflow(req.params.id) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.get('/api/v13/knime/jobs/:id', async (req, res) => {
    try { res.json({ success: true, data: await knime.getJobStatus(req.params.id) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.get('/api/v13/knime/jobs/:id/results', async (req, res) => {
    try { res.json({ success: true, data: await knime.downloadResults(req.params.id) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // RAPIDMINER
  // ═══════════════════════════════════════════════════════════════════════════

  app.get('/api/v13/rapidminer/processes', async (req, res) => {
    try { res.json({ success: true, data: await rapidminer.getProcesses() }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.post('/api/v13/rapidminer/run', async (req, res) => {
    try { res.json({ success: true, data: await rapidminer.runProcess(req.body.processId, req.body.inputData) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.get('/api/v13/rapidminer/results/:id', async (req, res) => {
    try { res.json({ success: true, data: await rapidminer.getJobResult(req.params.id) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.post('/api/v13/rapidminer/predict', async (req, res) => {
    try { res.json({ success: true, data: await rapidminer.predict(req.body.modelId, req.body.data) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.get('/api/v13/rapidminer/models', async (req, res) => {
    try { res.json({ success: true, data: await rapidminer.getModels() }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // ALTERYX
  // ═══════════════════════════════════════════════════════════════════════════

  app.get('/api/v13/alteryx/workflows', async (req, res) => {
    try { res.json({ success: true, data: await alteryx.getWorkflows() }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.post('/api/v13/alteryx/run', async (req, res) => {
    try { res.json({ success: true, data: await alteryx.runWorkflow(req.body.workflowId) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.get('/api/v13/alteryx/output/:id', async (req, res) => {
    try { res.json({ success: true, data: await alteryx.getJobOutput(req.params.id) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.get('/api/v13/alteryx/apps', async (req, res) => {
    try { res.json({ success: true, data: await alteryx.getGalleryApps() }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.post('/api/v13/alteryx/schedule', async (req, res) => {
    try { res.json({ success: true, data: await alteryx.scheduleJob(req.body.workflowId, req.body.schedule) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // TRIFACTA
  // ═══════════════════════════════════════════════════════════════════════════

  app.get('/api/v13/trifacta/flows', async (req, res) => {
    try { res.json({ success: true, data: await trifacta.getFlows() }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.get('/api/v13/trifacta/flows/:id', async (req, res) => {
    try { res.json({ success: true, data: await trifacta.getFlow(req.params.id) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.post('/api/v13/trifacta/flows/:id/run', async (req, res) => {
    try { res.json({ success: true, data: await trifacta.runFlow(req.params.id) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.get('/api/v13/trifacta/runs/:id', async (req, res) => {
    try { res.json({ success: true, data: await trifacta.getRunStatus(req.params.id) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.get('/api/v13/trifacta/outputs/:id', async (req, res) => {
    try { res.json({ success: true, data: await trifacta.getOutputs(req.params.id) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.post('/api/v13/trifacta/recipe', async (req, res) => {
    try { res.json({ success: true, data: await trifacta.createRecipe(req.body.flowId, req.body.name) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // STATUS
  // ═══════════════════════════════════════════════════════════════════════════

  app.get('/api/v13/integrations', (req, res) => {
    res.json({ success: true, ...manager.getStatusSummary() });
  });

  return { manager, wolframalpha, ibmwatson, clarifai, darksky, mapbox, openweathermap, heremaps, algolia, elasticsearch, pinecone, weaviate, qdrant, meilisearch, typesense, wolframcloud, datarobot, knime, rapidminer, alteryx, trifacta };
}

export default { createDataRoutes };
