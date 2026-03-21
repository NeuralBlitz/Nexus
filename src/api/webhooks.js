#!/usr/bin/env node

import { Router } from 'express';
import crypto from 'crypto';

const router = Router();

const webhooks = new Map();

function verifyGitHubSignature(payload, signature, secret) {
  const hmac = crypto.createHmac('sha256', secret);
  const digest = 'sha256=' + hmac.update(payload).digest('hex');
  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(digest));
}

function verifySlackSignature(signingSecret, timestamp, body) {
  const base = `v0:${timestamp}:${body}`;
  const mySignature = 'v0=' + crypto.createHmac('sha256', signingSecret).update(base).digest('hex');
  return crypto.timingSafeEqual(Buffer.from(mySignature), Buffer.from(signingSecret));
}

router.post('/github', async (req, res) => {
  const secret = req.app.get('webhookSecret') || process.env.GITHUB_WEBHOOK_SECRET;
  
  if (secret) {
    const signature = req.headers['x-hub-signature-256'];
    if (!signature) {
      return res.status(401).json({ error: 'Missing signature' });
    }
    
    const payload = JSON.stringify(req.body);
    if (!verifyGitHubSignature(payload, signature, secret)) {
      return res.status(401).json({ error: 'Invalid signature' });
    }
  }
  
  const event = req.headers['x-github-event'];
  const deliveryId = req.headers['x-github-delivery'];
  
  const webhook = {
    id: deliveryId,
    source: 'github',
    event,
    payload: req.body,
    timestamp: new Date().toISOString(),
    headers: req.headers
  };
  
  webhooks.set(deliveryId, webhook);
  
  console.log(`[Webhook] GitHub ${event} event received: ${deliveryId}`);
  
  res.status(200).json({ received: true, id: deliveryId });
});

router.post('/slack', async (req, res) => {
  const signingSecret = req.app.get('slackSigningSecret') || process.env.SLACK_SIGNING_SECRET;
  
  if (signingSecret) {
    const timestamp = req.headers['x-slack-request-timestamp'];
    const signature = req.headers['x-slack-signature'];
    
    if (!timestamp || !signature) {
      return res.status(401).json({ error: 'Missing signature' });
    }
    
    if (Math.abs(Date.now() / 1000 - parseInt(timestamp)) > 300) {
      return res.status(401).json({ error: 'Request too old' });
    }
    
    const body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
    if (!verifySlackSignature(signingSecret, timestamp, body)) {
      return res.status(401).json({ error: 'Invalid signature' });
    }
  }
  
  if (req.body.type === 'url_verification') {
    return res.status(200).json({ challenge: req.body.challenge });
  }
  
  const webhook = {
    id: `slack_${Date.now()}`,
    source: 'slack',
    event: req.body.event?.type || 'unknown',
    payload: req.body,
    timestamp: new Date().toISOString()
  };
  
  webhooks.set(webhook.id, webhook);
  
  console.log(`[Webhook] Slack event received: ${webhook.event}`);
  
  res.status(200).json({ ok: true });
});

router.post('/discord', async (req, res) => {
  const webhook = {
    id: `discord_${Date.now()}`,
    source: 'discord',
    event: req.body.t ? req.body.t : 'unknown',
    payload: req.body,
    timestamp: new Date().toISOString()
  };
  
  webhooks.set(webhook.id, webhook);
  
  console.log(`[Webhook] Discord event received: ${webhook.event}`);
  
  res.status(200).json({ ok: true });
});

router.post('/stripe', async (req, res) => {
  const secret = req.app.get('stripeWebhookSecret') || process.env.STRIPE_WEBHOOK_SECRET;
  
  if (secret) {
    const signature = req.headers['stripe-signature'];
    if (!signature) {
      return res.status(401).json({ error: 'Missing signature' });
    }
  }
  
  const webhook = {
    id: `stripe_${Date.now()}`,
    source: 'stripe',
    event: req.body.type,
    payload: req.body,
    timestamp: new Date().toISOString()
  };
  
  webhooks.set(webhook.id, webhook);
  
  console.log(`[Webhook] Stripe event received: ${webhook.event}`);
  
  res.status(200).json({ received: true });
});

router.post('/twilio', async (req, res) => {
  const authToken = req.app.get('twilioAuthToken') || process.env.TWILIO_AUTH_TOKEN;
  
  if (authToken) {
    const signature = req.headers['x-twilio-signature'];
    if (!signature) {
      return res.status(401).json({ error: 'Missing signature' });
    }
  }
  
  const webhook = {
    id: `twilio_${Date.now()}`,
    source: 'twilio',
    event: req.body.SmsStatus || 'message',
    payload: req.body,
    timestamp: new Date().toISOString()
  };
  
  webhooks.set(webhook.id, webhook);
  
  console.log(`[Webhook] Twilio event received: ${webhook.event}`);
  
  res.status(200).send('');
});

router.post('/generic', async (req, res) => {
  const webhook = {
    id: `generic_${Date.now()}`,
    source: 'generic',
    event: req.body.event || 'unknown',
    payload: req.body,
    timestamp: new Date().toISOString(),
    headers: req.headers
  };
  
  webhooks.set(webhook.id, webhook);
  
  console.log(`[Webhook] Generic event received: ${webhook.event}`);
  
  res.status(200).json({ received: true, id: webhook.id });
});

router.get('/list', async (req, res) => {
  const limit = parseInt(req.query.limit) || 100;
  const list = Array.from(webhooks.values())
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
    .slice(0, limit);
  
  res.json({
    count: webhooks.size,
    webhooks: list.map(w => ({
      id: w.id,
      source: w.source,
      event: w.event,
      timestamp: w.timestamp
    }))
  });
});

router.get('/:id', async (req, res) => {
  const webhook = webhooks.get(req.params.id);
  
  if (!webhook) {
    return res.status(404).json({ error: 'Webhook not found' });
  }
  
  res.json(webhook);
});

router.delete('/:id', async (req, res) => {
  if (webhooks.delete(req.params.id)) {
    res.json({ success: true, message: 'Webhook deleted' });
  } else {
    res.status(404).json({ error: 'Webhook not found' });
  }
});

router.delete('/', async (req, res) => {
  const before = webhooks.size;
  const threshold = Date.now() - 24 * 60 * 60 * 1000;
  
  for (const [id, webhook] of webhooks) {
    if (new Date(webhook.timestamp).getTime() < threshold) {
      webhooks.delete(id);
    }
  }
  
  res.json({ success: true, deleted: before - webhooks.size, remaining: webhooks.size });
});

export default router;
