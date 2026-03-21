#!/usr/bin/env node

import { getIoTIntegrationManager } from './iot-integrations.js';
import {
  PhilipsHueIntegration,
  WemoIntegration,
  SmartThingsIntegration,
  RingIntegration,
  NestIntegration,
  EcobeeIntegration,
  TeslaIntegration,
  Control4Integration,
  CrestronIntegration,
  LutronIntegration
} from './iot-integrations.js';

export function createIoTRoutes(app) {
  const manager = getIoTIntegrationManager();

  const philipshue = new PhilipsHueIntegration({ bridgeIp: process.env.PHILIPSHUE_BRIDGE_IP, username: process.env.PHILIPSHUE_USERNAME });
  const wemo = new WemoIntegration({ ip: process.env.WEMO_IP, port: process.env.WEMO_PORT });
  const smartthings = new SmartThingsIntegration({ accessToken: process.env.SMARTTHINGS_ACCESS_TOKEN });
  const ring = new RingIntegration({ accessToken: process.env.RING_ACCESS_TOKEN, refreshToken: process.env.RING_REFRESH_TOKEN });
  const nest = new NestIntegration({ accessToken: process.env.NEST_ACCESS_TOKEN, projectId: process.env.NEST_PROJECT_ID });
  const ecobee = new EcobeeIntegration({ accessToken: process.env.ECOBEE_ACCESS_TOKEN, apiKey: process.env.ECOBEE_API_KEY });
  const tesla = new TeslaIntegration({ accessToken: process.env.TESLA_ACCESS_TOKEN, ownerToken: process.env.TESLA_OWNER_TOKEN });
  const control4 = new Control4Integration({ directorIp: process.env.CONTROL4_DIRECTOR_IP, username: process.env.CONTROL4_USERNAME, password: process.env.CONTROL4_PASSWORD });
  const crestron = new CrestronIntegration({ host: process.env.CRESTRON_HOST, username: process.env.CRESTRON_USERNAME, password: process.env.CRESTRON_PASSWORD });
  const lutron = new LutronIntegration({ host: process.env.LUTRON_HOST, username: process.env.LUTRON_USERNAME, password: process.env.LUTRON_PASSWORD });

  manager.register('philipshue', philipshue);
  manager.register('wemo', wemo);
  manager.register('smartthings', smartthings);
  manager.register('ring', ring);
  manager.register('nest', nest);
  manager.register('ecobee', ecobee);
  manager.register('tesla', tesla);
  manager.register('control4', control4);
  manager.register('crestron', crestron);
  manager.register('lutron', lutron);

  // ═══════════════════════════════════════════════════════════════════════════
  // PHILIPS HUE
  // ═══════════════════════════════════════════════════════════════════════════

  app.get('/api/v12/philipshue/bridge', async (req, res) => {
    try { res.json({ success: true, data: await philipshue.discoverBridge() }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.get('/api/v12/philipshue/lights', async (req, res) => {
    try { res.json({ success: true, data: await philipshue.getLights() }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.get('/api/v12/philipshue/lights/:id', async (req, res) => {
    try { res.json({ success: true, data: await philipshue.getLight(req.params.id) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.put('/api/v12/philipshue/lights/:id/state', async (req, res) => {
    try { res.json({ success: true, data: await philipshue.setLightState(req.params.id, req.body) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.get('/api/v12/philipshue/groups', async (req, res) => {
    try { res.json({ success: true, data: await philipshue.getGroups() }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.put('/api/v12/philipshue/groups/:id/state', async (req, res) => {
    try { res.json({ success: true, data: await philipshue.setGroupState(req.params.id, req.body) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.get('/api/v12/philipshue/scenes', async (req, res) => {
    try { res.json({ success: true, data: await philipshue.getScenes() }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.post('/api/v12/philipshue/scenes/:id/activate', async (req, res) => {
    try { res.json({ success: true, data: await philipshue.activateScene(req.params.id) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // WEMO
  // ═══════════════════════════════════════════════════════════════════════════

  app.get('/api/v12/wemo/devices', async (req, res) => {
    try { res.json({ success: true, data: await wemo.getDevices() }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.get('/api/v12/wemo/devices/:id/state', async (req, res) => {
    try { res.json({ success: true, data: await wemo.getDeviceState(req.params.id) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.post('/api/v12/wemo/devices/:id/state', async (req, res) => {
    try { res.json({ success: true, data: await wemo.setDeviceState(req.params.id, req.body.state) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.get('/api/v12/wemo/devices/:id/insight', async (req, res) => {
    try { res.json({ success: true, data: await wemo.getInsightParams(req.params.id) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // SMART THINGS
  // ═══════════════════════════════════════════════════════════════════════════

  app.get('/api/v12/smartthings/devices', async (req, res) => {
    try { res.json({ success: true, data: await smartthings.getDevices() }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.get('/api/v12/smartthings/devices/:id', async (req, res) => {
    try { res.json({ success: true, data: await smartthings.getDevice(req.params.id) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.post('/api/v12/smartthings/devices/:id/commands', async (req, res) => {
    try { res.json({ success: true, data: await smartthings.executeCommand(req.params.id, req.body) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.get('/api/v12/smartthings/locations', async (req, res) => {
    try { res.json({ success: true, data: await smartthings.getLocations() }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.get('/api/v12/smartthings/rooms', async (req, res) => {
    try { res.json({ success: true, data: await smartthings.getRooms() }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.get('/api/v12/smartthings/scenes', async (req, res) => {
    try { res.json({ success: true, data: await smartthings.getScenes() }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.post('/api/v12/smartthings/scenes/:id/execute', async (req, res) => {
    try { res.json({ success: true, data: await smartthings.executeScene(req.params.id) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // RING
  // ═══════════════════════════════════════════════════════════════════════════

  app.get('/api/v12/ring/devices', async (req, res) => {
    try { res.json({ success: true, data: await ring.getDevices() }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.get('/api/v12/ring/doorbots', async (req, res) => {
    try { res.json({ success: true, data: await ring.getDoorbots() }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.get('/api/v12/ring/history', async (req, res) => {
    try { res.json({ success: true, data: await ring.getDingHistory() }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.get('/api/v12/ring/alerts', async (req, res) => {
    try { res.json({ success: true, data: await ring.getAlerts() }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.get('/api/v12/ring/videos/:id', async (req, res) => {
    try { res.json({ success: true, data: await ring.getVideos(req.params.id) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // NEST
  // ═══════════════════════════════════════════════════════════════════════════

  app.get('/api/v12/nest/devices', async (req, res) => {
    try { res.json({ success: true, data: await nest.getDevices() }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.get('/api/v12/nest/thermostats/:id', async (req, res) => {
    try { res.json({ success: true, data: await nest.getThermostat(req.params.id) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.post('/api/v12/nest/thermostats/:id/temperature', async (req, res) => {
    try { res.json({ success: true, data: await nest.setTemperature(req.params.id, req.body.temp) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.get('/api/v12/nest/cameras', async (req, res) => {
    try { res.json({ success: true, data: await nest.getCameras() }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.get('/api/v12/nest/cameras/:id', async (req, res) => {
    try { res.json({ success: true, data: await nest.getCamera(req.params.id) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.get('/api/v12/nest/smoke-co-alarms', async (req, res) => {
    try { res.json({ success: true, data: await nest.getSmokeCoAlarms() }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.get('/api/v12/nest/structure', async (req, res) => {
    try { res.json({ success: true, data: await nest.getStructure() }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // ECOBEE
  // ═══════════════════════════════════════════════════════════════════════════

  app.get('/api/v12/ecobee/thermostats', async (req, res) => {
    try { res.json({ success: true, data: await ecobee.getThermostats() }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.get('/api/v12/ecobee/thermostats/:id', async (req, res) => {
    try { res.json({ success: true, data: await ecobee.getThermostat(req.params.id) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.post('/api/v12/ecobee/thermostats/:id', async (req, res) => {
    try { res.json({ success: true, data: await ecobee.setThermostat(req.params.id, req.body) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.get('/api/v12/ecobee/thermostats/:id/runtime', async (req, res) => {
    try { res.json({ success: true, data: await ecobee.getRuntimeReports(req.params.id, req.query.startDate, req.query.endDate) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.get('/api/v12/ecobee/thermostats/:id/weather', async (req, res) => {
    try { res.json({ success: true, data: await ecobee.getWeather(req.params.id) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.get('/api/v12/ecobee/thermostats/:id/vacations', async (req, res) => {
    try { res.json({ success: true, data: await ecobee.getVacations(req.params.id) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // TESLA
  // ═══════════════════════════════════════════════════════════════════════════

  app.get('/api/v12/tesla/vehicles', async (req, res) => {
    try { res.json({ success: true, data: await tesla.getVehicles() }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.get('/api/v12/tesla/vehicles/:id', async (req, res) => {
    try { res.json({ success: true, data: await tesla.getVehicleData(req.params.id) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.post('/api/v12/tesla/vehicles/:id/wake', async (req, res) => {
    try { res.json({ success: true, data: await tesla.wakeUp(req.params.id) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.post('/api/v12/tesla/vehicles/:id/honk', async (req, res) => {
    try { res.json({ success: true, data: await tesla.honkHorn(req.params.id) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.post('/api/v12/tesla/vehicles/:id/flash', async (req, res) => {
    try { res.json({ success: true, data: await tesla.flashLights(req.params.id) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.post('/api/v12/tesla/vehicles/:id/climate', async (req, res) => {
    try { res.json({ success: true, data: await tesla.setClimateTemp(req.params.id, req.body.temp) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.post('/api/v12/tesla/vehicles/:id/charge', async (req, res) => {
    try { res.json({ success: true, data: await tesla.startCharging(req.params.id) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.post('/api/v12/tesla/vehicles/:id/sentry', async (req, res) => {
    try { res.json({ success: true, data: await tesla.setSentryMode(req.params.id, req.body.enabled) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.get('/api/v12/tesla/vehicles/:id/charge-state', async (req, res) => {
    try { res.json({ success: true, data: await tesla.getChargeState(req.params.id) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // CONTROL4
  // ═══════════════════════════════════════════════════════════════════════════

  app.get('/api/v12/control4/nodes', async (req, res) => {
    try { res.json({ success: true, data: await control4.getNodes() }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.get('/api/v12/control4/nodes/:id', async (req, res) => {
    try { res.json({ success: true, data: await control4.getNode(req.params.id) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.post('/api/v12/control4/nodes/:id/level', async (req, res) => {
    try { res.json({ success: true, data: await control4.setNodeLevel(req.params.id, req.body.level) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.get('/api/v12/control4/scenes', async (req, res) => {
    try { res.json({ success: true, data: await control4.getScenes() }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.post('/api/v12/control4/scenes/:id/activate', async (req, res) => {
    try { res.json({ success: true, data: await control4.activateScene(req.params.id) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // CRESTRON
  // ═══════════════════════════════════════════════════════════════════════════

  app.get('/api/v12/crestron/devices', async (req, res) => {
    try { res.json({ success: true, data: await crestron.getDevices() }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.post('/api/v12/crestron/devices/:id/command', async (req, res) => {
    try { res.json({ success: true, data: await crestron.sendCommand(req.params.id, req.body.command) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.get('/api/v12/crestron/rooms/:id/status', async (req, res) => {
    try { res.json({ success: true, data: await crestron.getRoomStatus(req.params.id) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.post('/api/v12/crestron/rooms/:id/lighting', async (req, res) => {
    try { res.json({ success: true, data: await crestron.setRoomLighting(req.params.id, req.body.level) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.get('/api/v12/crestron/presets', async (req, res) => {
    try { res.json({ success: true, data: await crestron.getPresets() }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.post('/api/v12/crestron/rooms/:roomId/presets/:id/activate', async (req, res) => {
    try { res.json({ success: true, data: await crestron.activatePreset(req.params.roomId, req.params.id) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.get('/api/v12/crestron/routing', async (req, res) => {
    try { res.json({ success: true, data: await crestron.getRouting() }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.post('/api/v12/crestron/routing', async (req, res) => {
    try { res.json({ success: true, data: await crestron.setRouting(req.body.source, req.body.destination) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // LUTRON
  // ═══════════════════════════════════════════════════════════════════════════

  app.get('/api/v12/lutron/devices', async (req, res) => {
    try { res.json({ success: true, data: await lutron.getDevices() }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.get('/api/v12/lutron/devices/:id', async (req, res) => {
    try { res.json({ success: true, data: await lutron.getDevice(req.params.id) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.put('/api/v12/lutron/devices/:id/level', async (req, res) => {
    try { res.json({ success: true, data: await lutron.setDeviceLevel(req.params.id, req.body.level) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.get('/api/v12/lutron/rooms', async (req, res) => {
    try { res.json({ success: true, data: await lutron.getRooms() }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.get('/api/v12/lutron/areas', async (req, res) => {
    try { res.json({ success: true, data: await lutron.getRoomAreas() }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.get('/api/v12/lutron/scenes', async (req, res) => {
    try { res.json({ success: true, data: await lutron.getScenes() }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.post('/api/v12/lutron/scenes/:id/activate', async (req, res) => {
    try { res.json({ success: true, data: await lutron.activateScene(req.params.id) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.get('/api/v12/lutron/occupancy', async (req, res) => {
    try { res.json({ success: true, data: await lutron.getOccupancyGroups() }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.get('/api/v12/lutron/shades', async (req, res) => {
    try { res.json({ success: true, data: await lutron.getShades() }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.put('/api/v12/lutron/shades/:id/level', async (req, res) => {
    try { res.json({ success: true, data: await lutron.setShadeLevel(req.params.id, req.body.level) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // STATUS
  // ═══════════════════════════════════════════════════════════════════════════

  app.get('/api/v12/integrations', (req, res) => {
    res.json({ success: true, ...manager.getStatusSummary() });
  });

  return { manager, philipshue, wemo, smartthings, ring, nest, ecobee, tesla, control4, crestron, lutron };
}

export default { createIoTRoutes };
