#!/usr/bin/env node

import { getDevopsIntegrationManager } from './devops-integrations.js';
import {
  IONOSIntegration,
  DopplerIntegration,
  DatadogIntegration,
  DigitalOceanIntegration,
  VercelIntegration,
  HuggingFaceIntegration,
  DockerIntegration,
  PrismaIntegration,
  ObsidianIntegration,
  ZubeIntegration,
  BuildJetIntegration
} from './devops-integrations.js';

export function createDevopsRoutes(app) {
  const manager = getDevopsIntegrationManager();

  const ionos = new IONOSIntegration({ apiKey: process.env.IONOS_API_KEY });
  const doppler = new DopplerIntegration({ token: process.env.DOPPLER_TOKEN });
  const datadog = new DatadogIntegration({ apiKey: process.env.DATADOG_API_KEY, appKey: process.env.DATADOG_APP_KEY });
  const digitalocean = new DigitalOceanIntegration({ token: process.env.DO_TOKEN });
  const vercel = new VercelIntegration({ token: process.env.VERCEL_TOKEN });
  const huggingface = new HuggingFaceIntegration({ token: process.env.HF_TOKEN });
  const docker = new DockerIntegration({ host: process.env.DOCKER_HOST });
  const prisma = new PrismaIntegration({ connectionString: process.env.DATABASE_URL });
  const obsidian = new ObsidianIntegration({ vaultPath: process.env.OBSIDIAN_VAULT, apiKey: process.env.OBSIDIAN_API_KEY });
  const zube = new ZubeIntegration({ apiKey: process.env.ZUBE_API_KEY });
  const buildjet = new BuildJetIntegration({ apiKey: process.env.BUILDJET_API_KEY });

  manager.register('ionos', ionos);
  manager.register('doppler', doppler);
  manager.register('datadog', datadog);
  manager.register('digitalocean', digitalocean);
  manager.register('vercel', vercel);
  manager.register('huggingface', huggingface);
  manager.register('docker', docker);
  manager.register('prisma', prisma);
  manager.register('obsidian', obsidian);
  manager.register('zube', zube);
  manager.register('buildjet', buildjet);

  // ═══════════════════════════════════════════════════════════════════════════
  // IONOS
  // ═══════════════════════════════════════════════════════════════════════════

  app.get('/api/v9/ionos/servers', async (req, res) => {
    try { res.json({ success: true, data: await ionos.listServers(req.query) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.get('/api/v9/ionos/servers/:id', async (req, res) => {
    try { res.json({ success: true, data: await ionos.getServer(req.params.id) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.post('/api/v9/ionos/servers', async (req, res) => {
    try { res.json({ success: true, data: await ionos.createServer(req.body) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.delete('/api/v9/ionos/servers/:id', async (req, res) => {
    try { res.json({ success: true, data: await ionos.deleteServer(req.params.id) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // DOPPLER
  // ═══════════════════════════════════════════════════════════════════════════

  app.get('/api/v9/doppler/secrets', async (req, res) => {
    try { res.json({ success: true, data: await doppler.getSecrets(req.query) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.get('/api/v9/doppler/secrets/:key', async (req, res) => {
    try { res.json({ success: true, data: await doppler.getSecret(req.params.key, req.query) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.post('/api/v9/doppler/secrets', async (req, res) => {
    try { res.json({ success: true, data: await doppler.setSecret(req.body.key, req.body.value, req.body) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // DATADOG
  // ═══════════════════════════════════════════════════════════════════════════

  app.get('/api/v9/datadog/metrics', async (req, res) => {
    try { res.json({ success: true, data: await datadog.getMetrics(req.query.query, req.query) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.get('/api/v9/datadog/hosts', async (req, res) => {
    try { res.json({ success: true, data: await datadog.getHosts() }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.get('/api/v9/datadog/alerts', async (req, res) => {
    try { res.json({ success: true, data: await datadog.getAlerts() }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.post('/api/v9/datadog/alerts', async (req, res) => {
    try { res.json({ success: true, data: await datadog.createAlert(req.body.name, req.body.query, req.body) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.get('/api/v9/datadog/dashboards', async (req, res) => {
    try { res.json({ success: true, data: await datadog.listDashboards() }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // DIGITALOCEAN
  // ═══════════════════════════════════════════════════════════════════════════

  app.get('/api/v9/digitalocean/droplets', async (req, res) => {
    try { res.json({ success: true, data: await digitalocean.getDroplets() }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.get('/api/v9/digitalocean/droplets/:id', async (req, res) => {
    try { res.json({ success: true, data: await digitalocean.getDroplet(parseInt(req.params.id)) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.post('/api/v9/digitalocean/droplets', async (req, res) => {
    try { res.json({ success: true, data: await digitalocean.createDroplet(req.body) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.delete('/api/v9/digitalocean/droplets/:id', async (req, res) => {
    try { res.json({ success: true, data: await digitalocean.deleteDroplet(parseInt(req.params.id)) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.get('/api/v9/digitalocean/images', async (req, res) => {
    try { res.json({ success: true, data: await digitalocean.getImages() }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.get('/api/v9/digitalocean/domains', async (req, res) => {
    try { res.json({ success: true, data: await digitalocean.listDomains() }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // VERCEL
  // ═══════════════════════════════════════════════════════════════════════════

  app.get('/api/v9/vercel/projects', async (req, res) => {
    try { res.json({ success: true, data: await vercel.getProjects() }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.get('/api/v9/vercel/projects/:name', async (req, res) => {
    try { res.json({ success: true, data: await vercel.getProject(req.params.name) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.post('/api/v9/vercel/deployments', async (req, res) => {
    try { res.json({ success: true, data: await vercel.deploy(req.body.projectId, req.body) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.get('/api/v9/vercel/deployments/:id', async (req, res) => {
    try { res.json({ success: true, data: await vercel.getDeployment(req.params.id) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.get('/api/v9/vercel/deployments/:id/logs', async (req, res) => {
    try { res.json({ success: true, data: await vercel.getLogs(req.params.id) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // HUGGINGFACE
  // ═══════════════════════════════════════════════════════════════════════════

  app.get('/api/v9/huggingface/models', async (req, res) => {
    try { res.json({ success: true, data: await huggingface.getModels(req.query.filter, req.query) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.get('/api/v9/huggingface/models/:id', async (req, res) => {
    try { res.json({ success: true, data: await huggingface.getModel(req.params.id) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.post('/api/v9/huggingface/inference/:modelId', async (req, res) => {
    try { res.json({ success: true, data: await huggingface.inference(req.params.modelId, req.body.inputs, req.body) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.get('/api/v9/huggingface/spaces', async (req, res) => {
    try { res.json({ success: true, data: await huggingface.getSpaces() }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.get('/api/v9/huggingface/datasets', async (req, res) => {
    try { res.json({ success: true, data: await huggingface.getDatasets(req.query.filter) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // DOCKER
  // ═══════════════════════════════════════════════════════════════════════════

  app.get('/api/v9/docker/containers', async (req, res) => {
    try { res.json({ success: true, data: await docker.listContainers() }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.get('/api/v9/docker/containers/:id', async (req, res) => {
    try { res.json({ success: true, data: await docker.getContainer(req.params.id) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.post('/api/v9/docker/containers', async (req, res) => {
    try { res.json({ success: true, data: await docker.createContainer(req.body) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.post('/api/v9/docker/containers/:id/start', async (req, res) => {
    try { res.json({ success: true, data: await docker.startContainer(req.params.id) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.post('/api/v9/docker/containers/:id/stop', async (req, res) => {
    try { res.json({ success: true, data: await docker.stopContainer(req.params.id) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.delete('/api/v9/docker/containers/:id', async (req, res) => {
    try { res.json({ success: true, data: await docker.removeContainer(req.params.id) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.get('/api/v9/docker/images', async (req, res) => {
    try { res.json({ success: true, data: await docker.listImages() }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.post('/api/v9/docker/images/pull', async (req, res) => {
    try { res.json({ success: true, data: await docker.pullImage(req.body.image) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // PRISMA
  // ═══════════════════════════════════════════════════════════════════════════

  app.get('/api/v9/prisma/schema', async (req, res) => {
    try { res.json({ success: true, data: await prisma.getSchema() }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.post('/api/v9/prisma/query', async (req, res) => {
    try { res.json({ success: true, data: await prisma.executeQuery(req.body.query) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // OBSIDIAN
  // ═══════════════════════════════════════════════════════════════════════════

  app.get('/api/v9/obsidian/notes', async (req, res) => {
    try { res.json({ success: true, data: await obsidian.listNotes() }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.get('/api/v9/obsidian/notes/:path', async (req, res) => {
    try { res.json({ success: true, data: await obsidian.readNote(decodeURIComponent(req.params.path)) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.post('/api/v9/obsidian/notes', async (req, res) => {
    try { res.json({ success: true, data: await obsidian.createNote(req.body.path, req.body.content, req.body.frontmatter) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.put('/api/v9/obsidian/notes/:path', async (req, res) => {
    try { res.json({ success: true, data: await obsidian.updateNote(decodeURIComponent(req.params.path), req.body.content) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // ZUBE
  // ═══════════════════════════════════════════════════════════════════════════

  app.get('/api/v9/zube/projects', async (req, res) => {
    try { res.json({ success: true, data: await zube.getProjects() }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.get('/api/v9/zube/epics/:projectId', async (req, res) => {
    try { res.json({ success: true, data: await zube.getEpics(parseInt(req.params.projectId)) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.get('/api/v9/zube/tasks/:epicId', async (req, res) => {
    try { res.json({ success: true, data: await zube.getTasks(parseInt(req.params.epicId)) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.post('/api/v9/zube/tasks', async (req, res) => {
    try { res.json({ success: true, data: await zube.createTask(req.body) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // BUILDJET
  // ═══════════════════════════════════════════════════════════════════════════

  app.get('/api/v9/buildjet/builds', async (req, res) => {
    try { res.json({ success: true, data: await buildjet.getBuilds(req.query) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.post('/api/v9/buildjet/builds', async (req, res) => {
    try { res.json({ success: true, data: await buildjet.triggerBuild(req.body) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.get('/api/v9/buildjet/builds/:id/logs', async (req, res) => {
    try { res.json({ success: true, data: await buildjet.getBuildLogs(req.params.id) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // STATUS
  // ═══════════════════════════════════════════════════════════════════════════

  app.get('/api/v9/integrations', (req, res) => {
    res.json({ success: true, ...manager.getStatusSummary() });
  });

  return { manager, ionos, doppler, datadog, digitalocean, vercel, huggingface, docker, prisma, obsidian, zube, buildjet };
}

export default { createDevopsRoutes };
