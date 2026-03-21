#!/usr/bin/env node

import { getBusinessIntegrationManager } from './business-integrations.js';
import {
  GoDaddyIntegration,
  GranolaIntegration,
  GustoIntegration,
  HexIntegration,
  HeyGenIntegration,
  HighLevelIntegration,
  IndeedIntegration,
  CreditKarmaIntegration,
  InVideoIntegration,
  JotFormIntegration,
  KhanAcademyIntegration,
  KrakenIntegration,
  LegalZoomIntegration,
  LonaIntegration,
  NetlifyIntegration,
  NortonIntegration,
  PayPalIntegration,
  ChimeIntegration
} from './business-integrations.js';

export function createBusinessRoutes(app) {
  const manager = getBusinessIntegrationManager();

  const godaddy = new GoDaddyIntegration({ apiKey: process.env.GODADDY_API_KEY, apiSecret: process.env.GODADDY_API_SECRET });
  const granola = new GranolaIntegration({ apiKey: process.env.GRANOLA_API_KEY });
  const gusto = new GustoIntegration({ accessToken: process.env.GUSTO_ACCESS_TOKEN });
  const hex = new HexIntegration({ apiKey: process.env.HEX_API_KEY });
  const heygen = new HeyGenIntegration({ apiKey: process.env.HEYGEN_API_KEY });
  const highlevel = new HighLevelIntegration({ accessToken: process.env.HIGHLEVEL_ACCESS_TOKEN });
  const indeed = new IndeedIntegration({ publisherId: process.env.INDEED_PUBLISHER_ID });
  const creditkarma = new CreditKarmaIntegration({ clientId: process.env.CK_CLIENT_ID, clientSecret: process.env.CK_CLIENT_SECRET });
  const invideo = new InVideoIntegration({ apiKey: process.env.INVIDEO_API_KEY });
  const jotform = new JotFormIntegration({ apiKey: process.env.JOTFORM_API_KEY });
  const khanacademy = new KhanAcademyIntegration({ apiKey: process.env.KHAN_API_KEY });
  const kraken = new KrakenIntegration({ apiKey: process.env.KRAKEN_API_KEY, apiSecret: process.env.KRAKEN_API_SECRET });
  const legalzoom = new LegalZoomIntegration({ apiKey: process.env.LEGALZOOM_API_KEY });
  const lona = new LonaIntegration({ accessToken: process.env.LONA_ACCESS_TOKEN });
  const netlify = new NetlifyIntegration({ accessToken: process.env.NETLIFY_ACCESS_TOKEN });
  const norton = new NortonIntegration({ apiKey: process.env.NORTON_API_KEY });
  const paypal = new PayPalIntegration({ clientId: process.env.PAYPAL_CLIENT_ID, clientSecret: process.env.PAYPAL_CLIENT_SECRET });
  const chime = new ChimeIntegration({ accountId: process.env.CHIME_ACCOUNT_ID });

  manager.register('godaddy', godaddy);
  manager.register('granola', granola);
  manager.register('gusto', gusto);
  manager.register('hex', hex);
  manager.register('heygen', heygen);
  manager.register('highlevel', highlevel);
  manager.register('indeed', indeed);
  manager.register('creditkarma', creditkarma);
  manager.register('invideo', invideo);
  manager.register('jotform', jotform);
  manager.register('khanacademy', khanacademy);
  manager.register('kraken', kraken);
  manager.register('legalzoom', legalzoom);
  manager.register('lona', lona);
  manager.register('netlify', netlify);
  manager.register('norton', norton);
  manager.register('paypal', paypal);
  manager.register('chime', chime);

  // ═══════════════════════════════════════════════════════════════════════════
  // GODADDY
  // ═══════════════════════════════════════════════════════════════════════════

  app.get('/api/v10/godaddy/domains', async (req, res) => {
    try { res.json({ success: true, data: await godaddy.getDomains() }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.get('/api/v10/godaddy/domains/:name', async (req, res) => {
    try { res.json({ success: true, data: await godaddy.getDomain(req.params.name) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.post('/api/v10/godaddy/domains/availability', async (req, res) => {
    try { res.json({ success: true, data: await godaddy.checkAvailability(req.body.domain) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.get('/api/v10/godaddy/domains/:name/dns', async (req, res) => {
    try { res.json({ success: true, data: await godaddy.getDnsRecords(req.params.name) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // GRANOLA
  // ═══════════════════════════════════════════════════════════════════════════

  app.get('/api/v10/granola/meetings', async (req, res) => {
    try { res.json({ success: true, data: await granola.getMeetings(req.query) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.get('/api/v10/granola/meetings/:id/notes', async (req, res) => {
    try { res.json({ success: true, data: await granola.getMeetingNotes(req.params.id) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.post('/api/v10/granola/meetings/:id/summary', async (req, res) => {
    try { res.json({ success: true, data: await granola.generateSummary(req.params.id) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // GUSTO
  // ═══════════════════════════════════════════════════════════════════════════

  app.get('/api/v10/gusto/employees', async (req, res) => {
    try { res.json({ success: true, data: await gusto.getEmployees() }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.get('/api/v10/gusto/employees/:id', async (req, res) => {
    try { res.json({ success: true, data: await gusto.getEmployee(parseInt(req.params.id)) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.get('/api/v10/gusto/payrolls', async (req, res) => {
    try { res.json({ success: true, data: await gusto.getPayrolls(req.query) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.post('/api/v10/gusto/payrolls', async (req, res) => {
    try { res.json({ success: true, data: await gusto.runPayroll(req.body.employeeIds, req.body) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // HEX
  // ═══════════════════════════════════════════════════════════════════════════

  app.get('/api/v10/hex/projects', async (req, res) => {
    try { res.json({ success: true, data: await hex.getProjects() }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.get('/api/v10/hex/projects/:id', async (req, res) => {
    try { res.json({ success: true, data: await hex.getProject(req.params.id) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.post('/api/v10/hex/projects/:id/query', async (req, res) => {
    try { res.json({ success: true, data: await hex.runQuery(req.params.id, req.body.query) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // HEYGEN
  // ═══════════════════════════════════════════════════════════════════════════

  app.get('/api/v10/heygen/avatars', async (req, res) => {
    try { res.json({ success: true, data: await heygen.getAvatars() }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.get('/api/v10/heygen/voices', async (req, res) => {
    try { res.json({ success: true, data: await heygen.getVoices() }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.post('/api/v10/heygen/videos', async (req, res) => {
    try { res.json({ success: true, data: await heygen.createVideo(req.body) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.get('/api/v10/heygen/videos/:id', async (req, res) => {
    try { res.json({ success: true, data: await heygen.getVideo(req.params.id) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // HIGHLEVEL
  // ═══════════════════════════════════════════════════════════════════════════

  app.get('/api/v10/highlevel/contacts', async (req, res) => {
    try { res.json({ success: true, data: await highlevel.getContacts(req.query) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.get('/api/v10/highlevel/contacts/:id', async (req, res) => {
    try { res.json({ success: true, data: await highlevel.getContact(req.params.id) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.post('/api/v10/highlevel/contacts', async (req, res) => {
    try { res.json({ success: true, data: await highlevel.createContact(req.body) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.get('/api/v10/highlevel/pipelines', async (req, res) => {
    try { res.json({ success: true, data: await highlevel.getPipelines() }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.get('/api/v10/highlevel/campaigns', async (req, res) => {
    try { res.json({ success: true, data: await highlevel.getCampaigns() }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // INDEED
  // ═══════════════════════════════════════════════════════════════════════════

  app.get('/api/v10/indeed/jobs', async (req, res) => {
    try { res.json({ success: true, data: await indeed.searchJobs(req.query.q, req.query) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.get('/api/v10/indeed/jobs/:key', async (req, res) => {
    try { res.json({ success: true, data: await indeed.getJob(req.params.key) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.post('/api/v10/indeed/jobs', async (req, res) => {
    try { res.json({ success: true, data: await indeed.postJob(req.body) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // CREDIT KARMA
  // ═══════════════════════════════════════════════════════════════════════════

  app.get('/api/v10/creditkarma/score', async (req, res) => {
    try { res.json({ success: true, data: await creditkarma.getCreditScore() }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.get('/api/v10/creditkarma/report', async (req, res) => {
    try { res.json({ success: true, data: await creditkarma.getCreditReport() }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.get('/api/v10/creditkarma/accounts', async (req, res) => {
    try { res.json({ success: true, data: await creditkarma.getAccounts() }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // INVIDEO
  // ═══════════════════════════════════════════════════════════════════════════

  app.get('/api/v10/invideo/templates', async (req, res) => {
    try { res.json({ success: true, data: await invideo.getTemplates() }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.post('/api/v10/invideo/videos', async (req, res) => {
    try { res.json({ success: true, data: await invideo.createVideo(req.body) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.get('/api/v10/invideo/videos/:id', async (req, res) => {
    try { res.json({ success: true, data: await invideo.getVideo(req.params.id) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // JOTFORM
  // ═══════════════════════════════════════════════════════════════════════════

  app.get('/api/v10/jotform/forms', async (req, res) => {
    try { res.json({ success: true, data: await jotform.getForms() }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.get('/api/v10/jotform/forms/:id', async (req, res) => {
    try { res.json({ success: true, data: await jotform.getForm(req.params.id) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.get('/api/v10/jotform/forms/:id/submissions', async (req, res) => {
    try { res.json({ success: true, data: await jotform.getSubmissions(req.params.id, req.query) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // KHAN ACADEMY
  // ═══════════════════════════════════════════════════════════════════════════

  app.get('/api/v10/khanacademy/user', async (req, res) => {
    try { res.json({ success: true, data: await khanacademy.getUser() }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.get('/api/v10/khanacademy/progress', async (req, res) => {
    try { res.json({ success: true, data: await khanacademy.getProgress(req.query) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.get('/api/v10/khanacademy/exercises', async (req, res) => {
    try { res.json({ success: true, data: await khanacademy.getExercises(req.query) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // KRAKEN
  // ═══════════════════════════════════════════════════════════════════════════

  app.get('/api/v10/kraken/balance', async (req, res) => {
    try { res.json({ success: true, data: await kraken.getBalance() }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.get('/api/v10/kraken/ticker', async (req, res) => {
    try { res.json({ success: true, data: await kraken.getTicker(req.query.pair) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.get('/api/v10/kraken/ohlc', async (req, res) => {
    try { res.json({ success: true, data: await kraken.getOhlc(req.query.pair, parseInt(req.query.interval) || 1) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.get('/api/v10/kraken/orders', async (req, res) => {
    try { res.json({ success: true, data: await kraken.getOpenOrders() }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.post('/api/v10/kraken/orders', async (req, res) => {
    try { res.json({ success: true, data: await kraken.addOrder(req.body) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // LEGALZOOM
  // ═══════════════════════════════════════════════════════════════════════════

  app.get('/api/v10/legalzoom/services', async (req, res) => {
    try { res.json({ success: true, data: await legalzoom.getServices() }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.post('/api/v10/legalzoom/orders', async (req, res) => {
    try { res.json({ success: true, data: await legalzoom.createOrder(req.body.serviceId, req.body) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.get('/api/v10/legalzoom/orders/:id', async (req, res) => {
    try { res.json({ success: true, data: await legalzoom.getOrder(req.params.id) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // LONA
  // ═══════════════════════════════════════════════════════════════════════════

  app.get('/api/v10/lona/design-systems', async (req, res) => {
    try { res.json({ success: true, data: await lona.getDesignSystems() }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.get('/api/v10/lona/design-systems/:id', async (req, res) => {
    try { res.json({ success: true, data: await lona.getDesignSystem(req.params.id) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.get('/api/v10/lona/design-systems/:id/components', async (req, res) => {
    try { res.json({ success: true, data: await lona.getComponents(req.params.id) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // NETLIFY
  // ═══════════════════════════════════════════════════════════════════════════

  app.get('/api/v10/netlify/sites', async (req, res) => {
    try { res.json({ success: true, data: await netlify.getSites() }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.get('/api/v10/netlify/sites/:id', async (req, res) => {
    try { res.json({ success: true, data: await netlify.getSite(req.params.id) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.post('/api/v10/netlify/sites', async (req, res) => {
    try { res.json({ success: true, data: await netlify.createSite(req.body.name, req.body) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.post('/api/v10/netlify/sites/:id/deploys', async (req, res) => {
    try { res.json({ success: true, data: await netlify.deploySite(req.params.id, req.body) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.get('/api/v10/netlify/sites/:id/deploys', async (req, res) => {
    try { res.json({ success: true, data: await netlify.getDeploys(req.params.id) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // NORTON
  // ═══════════════════════════════════════════════════════════════════════════

  app.get('/api/v10/norton/devices', async (req, res) => {
    try { res.json({ success: true, data: await norton.getDevices() }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.get('/api/v10/norton/devices/:id', async (req, res) => {
    try { res.json({ success: true, data: await norton.getDevice(req.params.id) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.post('/api/v10/norton/devices/:id/scan', async (req, res) => {
    try { res.json({ success: true, data: await norton.runScan(req.params.id) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.get('/api/v10/norton/security', async (req, res) => {
    try { res.json({ success: true, data: await norton.getSecurityStatus() }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // PAYPAL
  // ═══════════════════════════════════════════════════════════════════════════

  app.post('/api/v10/paypal/orders', async (req, res) => {
    try { res.json({ success: true, data: await paypal.createOrder(req.body.amount, req.body.currency) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.post('/api/v10/paypal/orders/:id/capture', async (req, res) => {
    try { res.json({ success: true, data: await paypal.captureOrder(req.params.id) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.get('/api/v10/paypal/orders/:id', async (req, res) => {
    try { res.json({ success: true, data: await paypal.getOrder(req.params.id) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.post('/api/v10/paypal/subscriptions', async (req, res) => {
    try { res.json({ success: true, data: await paypal.createSubscription(req.body) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.get('/api/v10/paypal/transactions', async (req, res) => {
    try { res.json({ success: true, data: await paypal.getTransactions(req.query.startDate, req.query.endDate) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // CHIME
  // ═══════════════════════════════════════════════════════════════════════════

  app.get('/api/v10/chime/account', async (req, res) => {
    try { res.json({ success: true, data: await chime.getAccount() }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.get('/api/v10/chime/transactions', async (req, res) => {
    try { res.json({ success: true, data: await chime.getTransactions(req.query) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.post('/api/v10/chime/transfers', async (req, res) => {
    try { res.json({ success: true, data: await chime.sendMoney(req.body.toAccountId, req.body.amount, req.body) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.get('/api/v10/chime/card', async (req, res) => {
    try { res.json({ success: true, data: await chime.getCard() }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.get('/api/v10/chime/statements', async (req, res) => {
    try { res.json({ success: true, data: await chime.getStatements(req.query) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // STATUS
  // ═══════════════════════════════════════════════════════════════════════════

  app.get('/api/v10/integrations', (req, res) => {
    res.json({ success: true, ...manager.getStatusSummary() });
  });

  return { manager, godaddy, granola, gusto, hex, heygen, highlevel, indeed, creditkarma, invideo, jotform, khanacademy, kraken, legalzoom, lona, netlify, norton, paypal, chime };
}

export default { createBusinessRoutes };
