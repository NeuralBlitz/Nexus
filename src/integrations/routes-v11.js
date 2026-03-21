#!/usr/bin/env node

import { getMarketingIntegrationManager } from './marketing-integrations.js';
import {
  MailchimpIntegration,
  SendGridIntegration,
  TwilioIntegration,
  StripeIntegration,
  IntercomIntegration,
  FreshdeskIntegration,
  ZendeskIntegration,
  ActiveCampaignIntegration,
  ConvertKitIntegration,
  KlaviyoIntegration,
  MixpanelIntegration,
  AmplitudeIntegration,
  SegmentIntegration,
  BrazeIntegration,
  ClearbitIntegration,
  FullContactIntegration,
  HunterIntegration,
  SnovIOIntegration,
  ZeroBounceIntegration,
  NeverBounceIntegration
} from './marketing-integrations.js';

export function createMarketingRoutes(app) {
  const manager = getMarketingIntegrationManager();

  const mailchimp = new MailchimpIntegration({ apiKey: process.env.MAILCHIMP_API_KEY, serverPrefix: process.env.MAILCHIMP_SERVER_PREFIX });
  const sendgrid = new SendGridIntegration({ apiKey: process.env.SENDGRID_API_KEY });
  const twilio = new TwilioIntegration({ accountSid: process.env.TWILIO_ACCOUNT_SID, authToken: process.env.TWILIO_AUTH_TOKEN, fromNumber: process.env.TWILIO_FROM_NUMBER });
  const stripe = new StripeIntegration({ apiKey: process.env.STRIPE_API_KEY });
  const intercom = new IntercomIntegration({ accessToken: process.env.INTERCOM_ACCESS_TOKEN });
  const freshdesk = new FreshdeskIntegration({ apiKey: process.env.FRESHDESK_API_KEY, domain: process.env.FRESHDESK_DOMAIN });
  const zendesk = new ZendeskIntegration({ email: process.env.ZENDESK_EMAIL, apiToken: process.env.ZENDESK_TOKEN, subdomain: process.env.ZENDESK_SUBDOMAIN });
  const activecampaign = new ActiveCampaignIntegration({ apiKey: process.env.ACTIVE_CAMPAIGN_KEY, apiUrl: process.env.ACTIVE_CAMPAIGN_URL });
  const convertkit = new ConvertKitIntegration({ apiKey: process.env.CONVERTKIT_API_KEY, apiSecret: process.env.CONVERTKIT_API_SECRET });
  const klaviyo = new KlaviyoIntegration({ apiKey: process.env.KLAVIYO_API_KEY });
  const mixpanel = new MixpanelIntegration({ token: process.env.MIXPANEL_TOKEN, apiSecret: process.env.MIXPANEL_API_SECRET });
  const amplitude = new AmplitudeIntegration({ apiKey: process.env.AMPLITUDE_API_KEY, secretKey: process.env.AMPLITUDE_SECRET_KEY });
  const segment = new SegmentIntegration({ writeKey: process.env.SEGMENT_WRITE_KEY });
  const braze = new BrazeIntegration({ apiKey: process.env.BRAZE_API_KEY, appId: process.env.BRAZE_APP_ID, endpoint: process.env.BRAZE_ENDPOINT });
  const clearbit = new ClearbitIntegration({ apiKey: process.env.CLEARBIT_API_KEY });
  const fullcontact = new FullContactIntegration({ apiKey: process.env.FULLCONTACT_API_KEY });
  const hunter = new HunterIntegration({ apiKey: process.env.HUNTER_API_KEY });
  const snovio = new SnovIOIntegration({ clientId: process.env.SNOVIO_CLIENT_ID, clientSecret: process.env.SNOVIO_CLIENT_SECRET });
  const zerobounce = new ZeroBounceIntegration({ apiKey: process.env.ZEROBOUNCE_API_KEY });
  const neverbounce = new NeverBounceIntegration({ apiKey: process.env.NEVERBOUNCE_API_KEY, secretKey: process.env.NEVERBOUNCE_SECRET_KEY });

  manager.register('mailchimp', mailchimp);
  manager.register('sendgrid', sendgrid);
  manager.register('twilio', twilio);
  manager.register('stripe', stripe);
  manager.register('intercom', intercom);
  manager.register('freshdesk', freshdesk);
  manager.register('zendesk', zendesk);
  manager.register('activecampaign', activecampaign);
  manager.register('convertkit', convertkit);
  manager.register('klaviyo', klaviyo);
  manager.register('mixpanel', mixpanel);
  manager.register('amplitude', amplitude);
  manager.register('segment', segment);
  manager.register('braze', braze);
  manager.register('clearbit', clearbit);
  manager.register('fullcontact', fullcontact);
  manager.register('hunter', hunter);
  manager.register('snovio', snovio);
  manager.register('zerobounce', zerobounce);
  manager.register('neverbounce', neverbounce);

  // ═══════════════════════════════════════════════════════════════════════════
  // MAILCHIMP
  // ═══════════════════════════════════════════════════════════════════════════

  app.get('/api/v11/mailchimp/lists', async (req, res) => {
    try { res.json({ success: true, data: await mailchimp.getLists() }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.get('/api/v11/mailchimp/lists/:id', async (req, res) => {
    try { res.json({ success: true, data: await mailchimp.getList(req.params.id) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.post('/api/v11/mailchimp/lists/:id/members', async (req, res) => {
    try { res.json({ success: true, data: await mailchimp.addListMember(req.params.id, req.body.email, req.body.status) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.put('/api/v11/mailchimp/lists/:id/members/:memberId', async (req, res) => {
    try { res.json({ success: true, data: await mailchimp.updateListMember(req.params.id, req.params.memberId, req.body) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.get('/api/v11/mailchimp/campaigns', async (req, res) => {
    try { res.json({ success: true, data: await mailchimp.getCampaigns(req.query) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.post('/api/v11/mailchimp/campaigns', async (req, res) => {
    try { res.json({ success: true, data: await mailchimp.createCampaign(req.body.listId, req.body.subject, req.body.fromName, req.body.replyTo) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.post('/api/v11/mailchimp/campaigns/:id/send', async (req, res) => {
    try { res.json({ success: true, data: await mailchimp.sendCampaign(req.params.id) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.get('/api/v11/mailchimp/campaigns/:id/reports', async (req, res) => {
    try { res.json({ success: true, data: await mailchimp.getReports(req.params.id) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // SENDGRID
  // ═══════════════════════════════════════════════════════════════════════════

  app.post('/api/v11/sendgrid/send', async (req, res) => {
    try { res.json({ success: true, data: await sendgrid.sendEmail(req.body.to, req.body.subject, req.body.html, req.body.from) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.post('/api/v11/sendgrid/send-bulk', async (req, res) => {
    try { res.json({ success: true, data: await sendgrid.sendBulkEmail(req.body.messages) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.get('/api/v11/sendgrid/stats', async (req, res) => {
    try { res.json({ success: true, data: await sendgrid.getStats(req.query) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.get('/api/v11/sendgrid/suppressions', async (req, res) => {
    try { res.json({ success: true, data: await sendgrid.getSuppressions() }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.post('/api/v11/sendgrid/suppressions', async (req, res) => {
    try { res.json({ success: true, data: await sendgrid.addToSuppression(req.body.email, req.body.groupId) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // TWILIO
  // ═══════════════════════════════════════════════════════════════════════════

  app.post('/api/v11/twilio/sms', async (req, res) => {
    try { res.json({ success: true, data: await twilio.sendSms(req.body.to, req.body.body) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.post('/api/v11/twilio/sms-bulk', async (req, res) => {
    try { res.json({ success: true, data: await twilio.sendBulkSms(req.body.messages) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.get('/api/v11/twilio/messages', async (req, res) => {
    try { res.json({ success: true, data: await twilio.getMessages(req.query.to, req.query.from) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.get('/api/v11/twilio/messages/:sid', async (req, res) => {
    try { res.json({ success: true, data: await twilio.getMessage(req.params.sid) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // STRIPE
  // ═══════════════════════════════════════════════════════════════════════════

  app.post('/api/v11/stripe/customers', async (req, res) => {
    try { res.json({ success: true, data: await stripe.createCustomer(req.body.email, req.body.name, req.body.metadata) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.get('/api/v11/stripe/customers/:id', async (req, res) => {
    try { res.json({ success: true, data: await stripe.getCustomer(req.params.id) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.post('/api/v11/stripe/payment-intents', async (req, res) => {
    try { res.json({ success: true, data: await stripe.createPaymentIntent(req.body.amount, req.body.currency, req.body.customerId) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.post('/api/v11/stripe/payment-intents/:id/confirm', async (req, res) => {
    try { res.json({ success: true, data: await stripe.confirmPaymentIntent(req.params.id) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.post('/api/v11/stripe/subscriptions', async (req, res) => {
    try { res.json({ success: true, data: await stripe.createSubscription(req.body.customerId, req.body.priceId) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.delete('/api/v11/stripe/subscriptions/:id', async (req, res) => {
    try { res.json({ success: true, data: await stripe.cancelSubscription(req.params.id) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.get('/api/v11/stripe/invoices', async (req, res) => {
    try { res.json({ success: true, data: await stripe.getInvoices(req.query.customerId) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.get('/api/v11/stripe/products', async (req, res) => {
    try { res.json({ success: true, data: await stripe.listProducts() }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // INTERCOM
  // ═══════════════════════════════════════════════════════════════════════════

  app.get('/api/v11/intercom/users', async (req, res) => {
    try { res.json({ success: true, data: await intercom.getUsers(req.query) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.post('/api/v11/intercom/users', async (req, res) => {
    try { res.json({ success: true, data: await intercom.createUser(req.body.email, req.body.name, req.body.metadata) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.put('/api/v11/intercom/users/:id', async (req, res) => {
    try { res.json({ success: true, data: await intercom.updateUser(req.params.id, req.body) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.post('/api/v11/intercom/conversations', async (req, res) => {
    try { res.json({ success: true, data: await intercom.createConversation(req.body.userId, req.body.message, req.body.adminId) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.post('/api/v11/intercom/conversations/:id/reply', async (req, res) => {
    try { res.json({ success: true, data: await intercom.replyToConversation(req.params.id, req.body.message, req.body.adminId) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.get('/api/v11/intercom/conversations', async (req, res) => {
    try { res.json({ success: true, data: await intercom.getConversations(req.query) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // FRESHDESK
  // ═══════════════════════════════════════════════════════════════════════════

  app.get('/api/v11/freshdesk/tickets', async (req, res) => {
    try { res.json({ success: true, data: await freshdesk.getTickets(req.query) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.get('/api/v11/freshdesk/tickets/:id', async (req, res) => {
    try { res.json({ success: true, data: await freshdesk.getTicket(parseInt(req.params.id)) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.post('/api/v11/freshdesk/tickets', async (req, res) => {
    try { res.json({ success: true, data: await freshdesk.createTicket(req.body) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.put('/api/v11/freshdesk/tickets/:id', async (req, res) => {
    try { res.json({ success: true, data: await freshdesk.updateTicket(parseInt(req.params.id), req.body) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.get('/api/v11/freshdesk/contacts', async (req, res) => {
    try { res.json({ success: true, data: await freshdesk.getContacts() }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.post('/api/v11/freshdesk/contacts', async (req, res) => {
    try { res.json({ success: true, data: await freshdesk.createContact(req.body.email, req.body.name) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // ZENDESK
  // ═══════════════════════════════════════════════════════════════════════════

  app.get('/api/v11/zendesk/tickets', async (req, res) => {
    try { res.json({ success: true, data: await zendesk.getTickets() }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.get('/api/v11/zendesk/tickets/:id', async (req, res) => {
    try { res.json({ success: true, data: await zendesk.getTicket(parseInt(req.params.id)) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.post('/api/v11/zendesk/tickets', async (req, res) => {
    try { res.json({ success: true, data: await zendesk.createTicket(req.body) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.put('/api/v11/zendesk/tickets/:id', async (req, res) => {
    try { res.json({ success: true, data: await zendesk.updateTicket(parseInt(req.params.id), req.body) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.get('/api/v11/zendesk/users', async (req, res) => {
    try { res.json({ success: true, data: await zendesk.getUsers() }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.get('/api/v11/zendesk/search', async (req, res) => {
    try { res.json({ success: true, data: await zendesk.searchTickets(req.query.q) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // ACTIVE CAMPAIGN
  // ═══════════════════════════════════════════════════════════════════════════

  app.get('/api/v11/activecampaign/contacts', async (req, res) => {
    try { res.json({ success: true, data: await activecampaign.getContacts() }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.post('/api/v11/activecampaign/contacts', async (req, res) => {
    try { res.json({ success: true, data: await activecampaign.createContact(req.body.email, req.body.firstName, req.body.lastName) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.post('/api/v11/activecampaign/contacts/:id/tags', async (req, res) => {
    try { res.json({ success: true, data: await activecampaign.addTagToContact(parseInt(req.params.id), req.body.tagId) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.get('/api/v11/activecampaign/lists', async (req, res) => {
    try { res.json({ success: true, data: await activecampaign.getLists() }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.post('/api/v11/activecampaign/lists/:id/contacts', async (req, res) => {
    try { res.json({ success: true, data: await activecampaign.addContactToList(parseInt(req.params.id), req.body.contactId) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.post('/api/v11/activecampaign/deals', async (req, res) => {
    try { res.json({ success: true, data: await activecampaign.createDeal(req.body) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // CONVERTKIT
  // ═══════════════════════════════════════════════════════════════════════════

  app.get('/api/v11/convertkit/subscribers', async (req, res) => {
    try { res.json({ success: true, data: await convertkit.getSubscribers(req.query) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.post('/api/v11/convertkit/subscribers', async (req, res) => {
    try { res.json({ success: true, data: await convertkit.addSubscriber(req.body.email, req.body.firstName) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.get('/api/v11/convertkit/forms', async (req, res) => {
    try { res.json({ success: true, data: await convertkit.getForms() }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.get('/api/v11/convertkit/tags', async (req, res) => {
    try { res.json({ success: true, data: await convertkit.getTags() }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.post('/api/v11/convertkit/subscribers/:id/tags', async (req, res) => {
    try { res.json({ success: true, data: await convertkit.addTag(parseInt(req.params.id), req.body.tagId) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // KLAVIYO
  // ═══════════════════════════════════════════════════════════════════════════

  app.get('/api/v11/klaviyo/profiles', async (req, res) => {
    try { res.json({ success: true, data: await klaviyo.getProfiles(req.query) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.post('/api/v11/klaviyo/profiles', async (req, res) => {
    try { res.json({ success: true, data: await klaviyo.createProfile(req.body) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.get('/api/v11/klaviyo/lists', async (req, res) => {
    try { res.json({ success: true, data: await klaviyo.getLists() }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.post('/api/v11/klaviyo/lists/:id/subscribe', async (req, res) => {
    try { res.json({ success: true, data: await klaviyo.subscribeProfile(req.params.id, req.body.email) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.post('/api/v11/klaviyo/track', async (req, res) => {
    try { res.json({ success: true, data: await klaviyo.trackEvent(req.body.eventName, req.body.profileId, req.body.properties) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // MIXPANEL
  // ═══════════════════════════════════════════════════════════════════════════

  app.post('/api/v11/mixpanel/track', async (req, res) => {
    try { res.json({ success: true, data: await mixpanel.trackEvent(req.body.event, req.body.properties) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.get('/api/v11/mixpanel/people/:id', async (req, res) => {
    try { res.json({ success: true, data: await mixpanel.getPeople(req.params.id) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.post('/api/v11/mixpanel/people/:id', async (req, res) => {
    try { res.json({ success: true, data: await mixpanel.setPeople(req.params.id, req.body) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.get('/api/v11/mixpanel/events', async (req, res) => {
    try { res.json({ success: true, data: await mixpanel.getEvents(req.query) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.get('/api/v11/mixpanel/funnels/:id', async (req, res) => {
    try { res.json({ success: true, data: await mixpanel.getFunnels(req.params.id) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // AMPLITUDE
  // ═══════════════════════════════════════════════════════════════════════════

  app.post('/api/v11/amplitude/track', async (req, res) => {
    try { res.json({ success: true, data: await amplitude.trackEvent(req.body.userId, req.body.eventType, req.body.properties) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.get('/api/v11/amplitude/events/:userId', async (req, res) => {
    try { res.json({ success: true, data: await amplitude.getEvents(req.params.userId, req.query) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.get('/api/v11/amplitude/segments', async (req, res) => {
    try { res.json({ success: true, data: await amplitude.getUserSegments() }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.get('/api/v11/amplitude/cohorts', async (req, res) => {
    try { res.json({ success: true, data: await amplitude.getCohorts() }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // SEGMENT
  // ═══════════════════════════════════════════════════════════════════════════

  app.post('/api/v11/segment/track', async (req, res) => {
    try { res.json({ success: true, data: await segment.track(req.body.userId, req.body.event, req.body.properties) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.post('/api/v11/segment/identify', async (req, res) => {
    try { res.json({ success: true, data: await segment.identify(req.body.userId, req.body.traits) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.post('/api/v11/segment/group', async (req, res) => {
    try { res.json({ success: true, data: await segment.group(req.body.userId, req.body.groupId, req.body.traits) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.get('/api/v11/segment/destinations', async (req, res) => {
    try { res.json({ success: true, data: await segment.getDestinations() }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // BRAZE
  // ═══════════════════════════════════════════════════════════════════════════

  app.get('/api/v11/braze/users', async (req, res) => {
    try { res.json({ success: true, data: await braze.getUsers() }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.post('/api/v11/braze/events', async (req, res) => {
    try { res.json({ success: true, data: await braze.trackEvents(req.body.userId, req.body.events) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.post('/api/v11/braze/campaigns', async (req, res) => {
    try { res.json({ success: true, data: await braze.createCampaign(req.body.name, req.body.channels, req.body.schedule) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.post('/api/v11/braze/campaigns/:id/send', async (req, res) => {
    try { res.json({ success: true, data: await braze.sendCampaign(req.params.id, req.body.userIds) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // CLEARBIT
  // ═══════════════════════════════════════════════════════════════════════════

  app.get('/api/v11/clearbit/person', async (req, res) => {
    try { res.json({ success: true, data: await clearbit.enrichPerson(req.query.email) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.get('/api/v11/clearbit/company', async (req, res) => {
    try { res.json({ success: true, data: await clearbit.enrichCompany(req.query.domain) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.get('/api/v11/clearbit/logo', async (req, res) => {
    try { res.json({ success: true, data: await clearbit.getLogo(req.query.domain, req.query.size) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // FULLCONTACT
  // ═══════════════════════════════════════════════════════════════════════════

  app.get('/api/v11/fullcontact/email', async (req, res) => {
    try { res.json({ success: true, data: await fullcontact.enrichEmail(req.query.email) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.get('/api/v11/fullcontact/phone', async (req, res) => {
    try { res.json({ success: true, data: await fullcontact.enrichPhone(req.query.phone) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.get('/api/v11/fullcontact/social', async (req, res) => {
    try { res.json({ success: true, data: await fullcontact.getSocialProfiles(req.query.email) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // HUNTER
  // ═══════════════════════════════════════════════════════════════════════════

  app.get('/api/v11/hunter/find', async (req, res) => {
    try { res.json({ success: true, data: await hunter.findEmail(req.query.domain, req.query.firstName, req.query.lastName) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.get('/api/v11/hunter/verify', async (req, res) => {
    try { res.json({ success: true, data: await hunter.verifyEmail(req.query.email) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.get('/api/v11/hunter/domain-search', async (req, res) => {
    try { res.json({ success: true, data: await hunter.domainSearch(req.query.domain) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.get('/api/v11/hunter/leads', async (req, res) => {
    try { res.json({ success: true, data: await hunter.getLeads() }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // SNOV.IO
  // ═══════════════════════════════════════════════════════════════════════════

  app.get('/api/v11/snovio/domain-emails', async (req, res) => {
    try { res.json({ success: true, data: await snovio.getEmailsFromDomain(req.query.domain) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.get('/api/v11/snovio/find', async (req, res) => {
    try { res.json({ success: true, data: await snovio.findEmailByName(req.query.firstName, req.query.lastName, req.query.domain) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.get('/api/v11/snovio/verify', async (req, res) => {
    try { res.json({ success: true, data: await snovio.verifyEmail(req.query.email) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // ZEROBOUNCE
  // ═══════════════════════════════════════════════════════════════════════════

  app.get('/api/v11/zerobounce/validate', async (req, res) => {
    try { res.json({ success: true, data: await zerobounce.validateEmail(req.query.email) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.post('/api/v11/zerobounce/validate-bulk', async (req, res) => {
    try { res.json({ success: true, data: await zerobounce.validateBulk(req.body.emails) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.get('/api/v11/zerobounce/credits', async (req, res) => {
    try { res.json({ success: true, data: await zerobounce.getCredits() }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // NEVERBOUNCE
  // ═══════════════════════════════════════════════════════════════════════════

  app.get('/api/v11/neverbounce/verify', async (req, res) => {
    try { res.json({ success: true, data: await neverbounce.verify(req.query.email) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.post('/api/v11/neverbounce/verify-bulk', async (req, res) => {
    try { res.json({ success: true, data: await neverbounce.verifyBulk(req.body.emails) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.get('/api/v11/neverbounce/parse', async (req, res) => {
    try { res.json({ success: true, data: await neverbounce.parse(req.query.email) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // STATUS
  // ═══════════════════════════════════════════════════════════════════════════

  app.get('/api/v11/integrations', (req, res) => {
    res.json({ success: true, ...manager.getStatusSummary() });
  });

  return { manager, mailchimp, sendgrid, twilio, stripe, intercom, freshdesk, zendesk, activecampaign, convertkit, klaviyo, mixpanel, amplitude, segment, braze, clearbit, fullcontact, hunter, snovio, zerobounce, neverbounce };
}

export default { createMarketingRoutes };
