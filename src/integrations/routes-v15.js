#!/usr/bin/env node

import { getLifestyleIntegrationManager } from './lifestyle-integrations.js';
import {
  RobinhoodIntegration,
  CoinbaseIntegration,
  RevolutIntegration,
  WiseIntegration,
  PlaidIntegration,
  StripeAtlasIntegration,
  FitbitIntegration,
  GarminIntegration,
  OuraRingIntegration,
  WhoopIntegration,
  WithingsIntegration,
  SleepNumberIntegration,
  PelotonIntegration,
  CalmIntegration,
  HeadspaceIntegration,
  MyFitnessPalIntegration,
  StravaIntegration,
  NikeRunClubIntegration,
  ZwiftIntegration,
  MindbodyIntegration,
  VagaroIntegration,
  BookerIntegration,
  SquareIntegration,
  LightspeedIntegration,
  CloverIntegration,
  ToastIntegration,
  DoorDashIntegration,
  UberEatsIntegration,
  InstacartIntegration,
  TaskRabbitIntegration
} from './lifestyle-integrations.js';

export function createLifestyleRoutes(app) {
  const manager = getLifestyleIntegrationManager();

  const robinhood = new RobinhoodIntegration({ accessToken: process.env.ROBINHOOD_TOKEN });
  const coinbase = new CoinbaseIntegration({ apiKey: process.env.COINBASE_KEY, apiSecret: process.env.COINBASE_SECRET });
  const revolut = new RevolutIntegration({ accessToken: process.env.REVOLUT_TOKEN });
  const wise = new WiseIntegration({ accessToken: process.env.WISE_TOKEN });
  const plaid = new PlaidIntegration({ clientId: process.env.PLAID_CLIENT_ID, secret: process.env.PLAID_SECRET });
  const stripeatlas = new StripeAtlasIntegration({ apiKey: process.env.STRIPE_ATLAS_KEY });
  const fitbit = new FitbitIntegration({ accessToken: process.env.FITBIT_TOKEN });
  const garmin = new GarminIntegration({ consumerKey: process.env.GARMIN_KEY, consumerSecret: process.env.GARMIN_SECRET });
  const oura = new OuraRingIntegration({ accessToken: process.env.OURA_TOKEN });
  const whoop = new WhoopIntegration({ accessToken: process.env.WHOOP_TOKEN });
  const withings = new WithingsIntegration({ accessToken: process.env.WITHINGS_TOKEN });
  const sleepnumber = new SleepNumberIntegration({ email: process.env.SLEEPNUMBER_EMAIL, password: process.env.SLEEPNUMBER_PASSWORD });
  const peloton = new PelotonIntegration({ accessToken: process.env.PELOTON_TOKEN });
  const calm = new CalmIntegration({ accessToken: process.env.CALM_TOKEN });
  const headspace = new HeadspaceIntegration({ accessToken: process.env.HEADSPACE_TOKEN });
  const myfitnesspal = new MyFitnessPalIntegration({ accessToken: process.env.MFP_TOKEN });
  const strava = new StravaIntegration({ accessToken: process.env.STRAVA_TOKEN });
  const nikerunclub = new NikeRunClubIntegration({ accessToken: process.env.NRC_TOKEN });
  const zwift = new ZwiftIntegration({ accessToken: process.env.ZWIFT_TOKEN });
  const mindbody = new MindbodyIntegration({ apiKey: process.env.MINDBODY_KEY, siteId: process.env.MINDBODY_SITE_ID });
  const vagaro = new VagaroIntegration({ accessToken: process.env.VAGARO_TOKEN });
  const booker = new BookerIntegration({ accessToken: process.env.BOOKER_TOKEN });
  const square = new SquareIntegration({ accessToken: process.env.SQUARE_TOKEN });
  const lightspeed = new LightspeedIntegration({ accessToken: process.env.LIGHTSPEED_TOKEN });
  const clover = new CloverIntegration({ accessToken: process.env.CLOVER_TOKEN });
  const toast = new ToastIntegration({ accessToken: process.env.TOAST_TOKEN });
  const doordash = new DoorDashIntegration({ accessToken: process.env.DOORDASH_TOKEN });
  const ubereats = new UberEatsIntegration({ accessToken: process.env.UBEREATS_TOKEN });
  const instacart = new InstacartIntegration({ accessToken: process.env.INSTACART_TOKEN });
  const taskrabbit = new TaskRabbitIntegration({ accessToken: process.env.TASKRABBIT_TOKEN });

  manager.register('robinhood', robinhood);
  manager.register('coinbase', coinbase);
  manager.register('revolut', revolut);
  manager.register('wise', wise);
  manager.register('plaid', plaid);
  manager.register('stripeatlas', stripeatlas);
  manager.register('fitbit', fitbit);
  manager.register('garmin', garmin);
  manager.register('oura', oura);
  manager.register('whoop', whoop);
  manager.register('withings', withings);
  manager.register('sleepnumber', sleepnumber);
  manager.register('peloton', peloton);
  manager.register('calm', calm);
  manager.register('headspace', headspace);
  manager.register('myfitnesspal', myfitnesspal);
  manager.register('strava', strava);
  manager.register('nikerunclub', nikerunclub);
  manager.register('zwift', zwift);
  manager.register('mindbody', mindbody);
  manager.register('vagaro', vagaro);
  manager.register('booker', booker);
  manager.register('square', square);
  manager.register('lightspeed', lightspeed);
  manager.register('clover', clover);
  manager.register('toast', toast);
  manager.register('doordash', doordash);
  manager.register('ubereats', ubereats);
  manager.register('instacart', instacart);
  manager.register('taskrabbit', taskrabbit);

  // ═══════════════════════════════════════════════════════════════════════════
  // ROBINHOOD
  // ═══════════════════════════════════════════════════════════════════════════

  app.get('/api/v15/robinhood/accounts', async (req, res) => {
    try { res.json({ success: true, data: await robinhood.getAccounts() }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.get('/api/v15/robinhood/positions', async (req, res) => {
    try { res.json({ success: true, data: await robinhood.getPositions() }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.get('/api/v15/robinhood/portfolio', async (req, res) => {
    try { res.json({ success: true, data: await robinhood.getPortfolio() }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.post('/api/v15/robinhood/orders', async (req, res) => {
    try { res.json({ success: true, data: await robinhood.placeOrder(req.body) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.get('/api/v15/robinhood/orders', async (req, res) => {
    try { res.json({ success: true, data: await robinhood.getOrders() }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // COINBASE
  // ═══════════════════════════════════════════════════════════════════════════

  app.get('/api/v15/coinbase/accounts', async (req, res) => {
    try { res.json({ success: true, data: await coinbase.getAccounts() }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.get('/api/v15/coinbase/prices', async (req, res) => {
    try { res.json({ success: true, data: await coinbase.getPrices(req.query.currency) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.post('/api/v15/coinbase/orders', async (req, res) => {
    try { res.json({ success: true, data: await coinbase.placeOrder(req.body) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.get('/api/v15/coinbase/orders', async (req, res) => {
    try { res.json({ success: true, data: await coinbase.getOrders() }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.get('/api/v15/coinbase/transactions', async (req, res) => {
    try { res.json({ success: true, data: await coinbase.getTransactions() }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // REVOLUT
  // ═══════════════════════════════════════════════════════════════════════════

  app.get('/api/v15/revolut/accounts', async (req, res) => {
    try { res.json({ success: true, data: await revolut.getAccounts() }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.get('/api/v15/revolut/transactions', async (req, res) => {
    try { res.json({ success: true, data: await revolut.getTransactions(req.query.accountId) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.get('/api/v15/revolut/cards', async (req, res) => {
    try { res.json({ success: true, data: await revolut.getCards() }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.post('/api/v15/revolut/transfer', async (req, res) => {
    try { res.json({ success: true, data: await revolut.transferMoney(req.body.to, req.body.amount) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // WISE
  // ═══════════════════════════════════════════════════════════════════════════

  app.get('/api/v15/wise/accounts', async (req, res) => {
    try { res.json({ success: true, data: await wise.getAccounts() }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.post('/api/v15/wise/quote', async (req, res) => {
    try { res.json({ success: true, data: await wise.createQuote(req.body.fromCurrency, req.body.toCurrency, req.body.amount) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.post('/api/v15/wise/transfer', async (req, res) => {
    try { res.json({ success: true, data: await wise.createTransfer(req.body.quoteId, req.body.targetAccountId) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // PLAID
  // ═══════════════════════════════════════════════════════════════════════════

  app.get('/api/v15/plaid/accounts', async (req, res) => {
    try { res.json({ success: true, data: await plaid.getAccounts() }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.get('/api/v15/plaid/transactions', async (req, res) => {
    try { res.json({ success: true, data: await plaid.getTransactions(req.query.startDate, req.query.endDate) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.get('/api/v15/plaid/balance', async (req, res) => {
    try { res.json({ success: true, data: await plaid.getBalance() }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // FITBIT
  // ═══════════════════════════════════════════════════════════════════════════

  app.get('/api/v15/fitbit/profile', async (req, res) => {
    try { res.json({ success: true, data: await fitbit.getProfile() }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.get('/api/v15/fitbit/activities', async (req, res) => {
    try { res.json({ success: true, data: await fitbit.getActivities(req.query.date) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.get('/api/v15/fitbit/heartrate', async (req, res) => {
    try { res.json({ success: true, data: await fitbit.getHeartRate(req.query.date) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.get('/api/v15/fitbit/sleep', async (req, res) => {
    try { res.json({ success: true, data: await fitbit.getSleep(req.query.date) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // GARMIN
  // ═══════════════════════════════════════════════════════════════════════════

  app.get('/api/v15/garmin/activities', async (req, res) => {
    try { res.json({ success: true, data: await garmin.getActivities() }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.get('/api/v15/garmin/daily', async (req, res) => {
    try { res.json({ success: true, data: await garmin.getDailySummaries(req.query.date) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.get('/api/v15/garmin/sleep', async (req, res) => {
    try { res.json({ success: true, data: await garmin.getSleepData(req.query.date) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // OURA
  // ═══════════════════════════════════════════════════════════════════════════

  app.get('/api/v15/oura/sleep', async (req, res) => {
    try { res.json({ success: true, data: await oura.getSleepSummary(req.query.date) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.get('/api/v15/oura/activity', async (req, res) => {
    try { res.json({ success: true, data: await oura.getActivitySummary(req.query.date) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.get('/api/v15/oura/readiness', async (req, res) => {
    try { res.json({ success: true, data: await oura.getReadinessSummary(req.query.date) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // WHOOP
  // ═══════════════════════════════════════════════════════════════════════════

  app.get('/api/v15/whoop/user', async (req, res) => {
    try { res.json({ success: true, data: await whoop.getUser() }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.get('/api/v15/whoop/activity', async (req, res) => {
    try { res.json({ success: true, data: await whoop.getDailyActivity(req.query.date) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.get('/api/v15/whoop/recovery', async (req, res) => {
    try { res.json({ success: true, data: await whoop.getRecovery(req.query.date) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // WITHINGS
  // ═══════════════════════════════════════════════════════════════════════════

  app.get('/api/v15/withings/measurements', async (req, res) => {
    try { res.json({ success: true, data: await withings.getMeasurements() }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.get('/api/v15/withings/activity', async (req, res) => {
    try { res.json({ success: true, data: await withings.getActivity(req.query.date) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.get('/api/v15/withings/sleep', async (req, res) => {
    try { res.json({ success: true, data: await withings.getSleep(req.query.date) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // SLEEP NUMBER
  // ═══════════════════════════════════════════════════════════════════════════

  app.get('/api/v15/sleepnumber/bed', async (req, res) => {
    try { res.json({ success: true, data: await sleepnumber.getBedStatus() }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.get('/api/v15/sleepnumber/sleep', async (req, res) => {
    try { res.json({ success: true, data: await sleepnumber.getSleepData(req.query.date) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // PELOTON
  // ═══════════════════════════════════════════════════════════════════════════

  app.get('/api/v15/peloton/user', async (req, res) => {
    try { res.json({ success: true, data: await peloton.getUser() }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.get('/api/v15/peloton/workouts', async (req, res) => {
    try { res.json({ success: true, data: await peloton.getWorkouts() }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.get('/api/v15/peloton/workouts/:id', async (req, res) => {
    try { res.json({ success: true, data: await peloton.getWorkout(req.params.id) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // CALM
  // ═══════════════════════════════════════════════════════════════════════════

  app.get('/api/v15/calm/user', async (req, res) => {
    try { res.json({ success: true, data: await calm.getUser() }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.get('/api/v15/calm/sessions', async (req, res) => {
    try { res.json({ success: true, data: await calm.getSessions() }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.get('/api/v15/calm/daily', async (req, res) => {
    try { res.json({ success: true, data: await calm.getDailyCalm() }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // HEADSPACE
  // ═══════════════════════════════════════════════════════════════════════════

  app.get('/api/v15/headspace/user', async (req, res) => {
    try { res.json({ success: true, data: await headspace.getUser() }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.get('/api/v15/headspace/meditations', async (req, res) => {
    try { res.json({ success: true, data: await headspace.getMeditations() }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // MYFITNESSPAL
  // ═══════════════════════════════════════════════════════════════════════════

  app.get('/api/v15/myfitnesspal/diary', async (req, res) => {
    try { res.json({ success: true, data: await myfitnesspal.getDiary(req.query.date) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.post('/api/v15/myfitnesspal/food', async (req, res) => {
    try { res.json({ success: true, data: await myfitnesspal.addFoodEntry(req.body) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.get('/api/v15/myfitnesspal/goals', async (req, res) => {
    try { res.json({ success: true, data: await myfitnesspal.getGoals() }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // STRAVA
  // ═══════════════════════════════════════════════════════════════════════════

  app.get('/api/v15/strava/athlete', async (req, res) => {
    try { res.json({ success: true, data: await strava.getAthlete() }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.get('/api/v15/strava/activities', async (req, res) => {
    try { res.json({ success: true, data: await strava.getActivities() }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.get('/api/v15/strava/activities/:id', async (req, res) => {
    try { res.json({ success: true, data: await strava.getActivity(req.params.id) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // NIKE RUN CLUB
  // ═══════════════════════════════════════════════════════════════════════════

  app.get('/api/v15/nikerunclub/user', async (req, res) => {
    try { res.json({ success: true, data: await nikerunclub.getUser() }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.get('/api/v15/nikerunclub/runs', async (req, res) => {
    try { res.json({ success: true, data: await nikerunclub.getRuns() }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // ZWIFT
  // ═══════════════════════════════════════════════════════════════════════════

  app.get('/api/v15/zwift/profile', async (req, res) => {
    try { res.json({ success: true, data: await zwift.getProfile() }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.get('/api/v15/zwift/activities', async (req, res) => {
    try { res.json({ success: true, data: await zwift.getActivities() }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // MINDBODY
  // ═══════════════════════════════════════════════════════════════════════════

  app.get('/api/v15/mindbody/locations', async (req, res) => {
    try { res.json({ success: true, data: await mindbody.getLocations() }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.get('/api/v15/mindbody/classes', async (req, res) => {
    try { res.json({ success: true, data: await mindbody.getClasses(req.query) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.get('/api/v15/mindbody/staff', async (req, res) => {
    try { res.json({ success: true, data: await mindbody.getStaff() }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // SQUARE
  // ═══════════════════════════════════════════════════════════════════════════

  app.get('/api/v15/square/payments', async (req, res) => {
    try { res.json({ success: true, data: await square.getPayments(req.query) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.get('/api/v15/square/orders', async (req, res) => {
    try { res.json({ success: true, data: await square.getOrders() }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.get('/api/v15/square/items', async (req, res) => {
    try { res.json({ success: true, data: await square.getItems() }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.get('/api/v15/square/customers', async (req, res) => {
    try { res.json({ success: true, data: await square.getCustomers() }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // CLOVER
  // ═══════════════════════════════════════════════════════════════════════════

  app.get('/api/v15/clover/orders', async (req, res) => {
    try { res.json({ success: true, data: await clover.getOrders(req.query) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.get('/api/v15/clover/items', async (req, res) => {
    try { res.json({ success: true, data: await clover.getItems() }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.get('/api/v15/clover/employees', async (req, res) => {
    try { res.json({ success: true, data: await clover.getEmployees() }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // TOAST
  // ═══════════════════════════════════════════════════════════════════════════

  app.get('/api/v15/toast/orders', async (req, res) => {
    try { res.json({ success: true, data: await toast.getOrders() }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.get('/api/v15/toast/menu', async (req, res) => {
    try { res.json({ success: true, data: await toast.getMenu() }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // DOORDASH
  // ═══════════════════════════════════════════════════════════════════════════

  app.get('/api/v15/doordash/stores', async (req, res) => {
    try { res.json({ success: true, data: await doordash.getStores() }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.get('/api/v15/doordash/menu/:storeId', async (req, res) => {
    try { res.json({ success: true, data: await doordash.getMenu(req.params.storeId) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.post('/api/v15/doordash/orders', async (req, res) => {
    try { res.json({ success: true, data: await doordash.createOrder(req.body) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // UBER EATS
  // ═══════════════════════════════════════════════════════════════════════════

  app.get('/api/v15/ubereats/products', async (req, res) => {
    try { res.json({ success: true, data: await ubereats.getProducts() }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.post('/api/v15/ubereats/orders', async (req, res) => {
    try { res.json({ success: true, data: await ubereats.createOrder(req.body) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // INSTACART
  // ═══════════════════════════════════════════════════════════════════════════

  app.get('/api/v15/instacart/products', async (req, res) => {
    try { res.json({ success: true, data: await instacart.getProducts(req.query.q) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.get('/api/v15/instacart/stores', async (req, res) => {
    try { res.json({ success: true, data: await instacart.getStores() }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.post('/api/v15/instacart/orders', async (req, res) => {
    try { res.json({ success: true, data: await instacart.createOrder(req.body) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // TASKRABBIT
  // ═══════════════════════════════════════════════════════════════════════════

  app.get('/api/v15/taskrabbit/tasks', async (req, res) => {
    try { res.json({ success: true, data: await taskrabbit.getTasks(req.query) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.post('/api/v15/taskrabbit/tasks', async (req, res) => {
    try { res.json({ success: true, data: await taskrabbit.postTask(req.body) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.get('/api/v15/taskrabbit/mytasks', async (req, res) => {
    try { res.json({ success: true, data: await taskrabbit.getMyTasks() }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // STATUS
  // ═══════════════════════════════════════════════════════════════════════════

  app.get('/api/v15/integrations', (req, res) => {
    res.json({ success: true, ...manager.getStatusSummary() });
  });

  return { manager, robinhood, coinbase, revolut, wise, plaid, stripeatlas, fitbit, garmin, oura, whoop, withings, sleepnumber, peloton, calm, headspace, myfitnesspal, strava, nikerunclub, zwift, mindbody, vagaro, booker, square, lightspeed, clover, toast, doordash, ubereats, instacart, taskrabbit };
}

export default { createLifestyleRoutes };
