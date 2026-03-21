#!/usr/bin/env node

import { getSocialIntegrationManager } from './social-integrations.js';
import {
  TwitterIntegration,
  InstagramIntegration,
  WhatsAppIntegration,
  LinkedInIntegration,
  TelegramBotIntegration,
  SlackBotIntegration,
  DiscordBotIntegration,
  TeamsBotIntegration,
  ZoomBotIntegration
} from './social-integrations.js';

export function createSocialRoutes(app) {
  const manager = getSocialIntegrationManager();

  // Initialize integrations
  const twitter = new TwitterIntegration({ apiKey: process.env.TWITTER_API_KEY, apiSecret: process.env.TWITTER_API_SECRET, accessToken: process.env.TWITTER_ACCESS_TOKEN, accessSecret: process.env.TWITTER_ACCESS_SECRET });
  const instagram = new InstagramIntegration({ accessToken: process.env.INSTAGRAM_ACCESS_TOKEN });
  const whatsapp = new WhatsAppIntegration({ accessToken: process.env.WHATSAPP_ACCESS_TOKEN, phoneNumberId: process.env.WHATSAPP_PHONE_ID });
  const linkedin = new LinkedInIntegration({ accessToken: process.env.LINKEDIN_ACCESS_TOKEN });
  const telegram = new TelegramBotIntegration({ botToken: process.env.TELEGRAM_BOT_TOKEN });
  const slack = new SlackBotIntegration({ botToken: process.env.SLACK_BOT_TOKEN, signingSecret: process.env.SLACK_SIGNING_SECRET });
  const discord = new DiscordBotIntegration({ token: process.env.DISCORD_BOT_TOKEN });
  const teams = new TeamsBotIntegration({ appId: process.env.TEAMS_APP_ID, appPassword: process.env.TEAMS_APP_PASSWORD });
  const zoom = new ZoomBotIntegration({ botToken: process.env.ZOOM_BOT_TOKEN });

  // Register all
  manager.register('twitter', twitter);
  manager.register('instagram', instagram);
  manager.register('whatsapp', whatsapp);
  manager.register('linkedin', linkedin);
  manager.register('telegram-bot', telegram);
  manager.register('slack-bot', slack);
  manager.register('discord-bot', discord);
  manager.register('teams-bot', teams);
  manager.register('zoom-bot', zoom);

  // ═══════════════════════════════════════════════════════════════════════════
  // TWITTER/X
  // ═══════════════════════════════════════════════════════════════════════════

  app.get('/api/v8/twitter/me', async (req, res) => {
    try { res.json({ success: true, data: await twitter.getMe() }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.get('/api/v8/twitter/tweets', async (req, res) => {
    try { res.json({ success: true, data: await twitter.getTweets(req.query.q, req.query) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.post('/api/v8/twitter/tweets', async (req, res) => {
    try { res.json({ success: true, data: await twitter.postTweet(req.body.text, req.body) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.get('/api/v8/twitter/search', async (req, res) => {
    try { res.json({ success: true, data: await twitter.searchTweets(req.query.q, req.query) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // INSTAGRAM
  // ═══════════════════════════════════════════════════════════════════════════

  app.get('/api/v8/instagram/profile', async (req, res) => {
    try { res.json({ success: true, data: await instagram.getProfile() }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.get('/api/v8/instagram/media', async (req, res) => {
    try { res.json({ success: true, data: await instagram.getMedia(req.query) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.post('/api/v8/instagram/media', async (req, res) => {
    try { res.json({ success: true, data: await instagram.uploadMedia(req.body.imageUrl, req.body.caption) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.get('/api/v8/instagram/insights', async (req, res) => {
    try { res.json({ success: true, data: await instagram.getInsights(req.query) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // WHATSAPP
  // ═══════════════════════════════════════════════════════════════════════════

  app.post('/api/v8/whatsapp/messages', async (req, res) => {
    try { res.json({ success: true, data: await whatsapp.sendMessage(req.body.to, req.body.text, req.body) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.post('/api/v8/whatsapp/messages/template', async (req, res) => {
    try { res.json({ success: true, data: await whatsapp.sendTemplate(req.body.to, req.body.template, req.body.components) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.post('/api/v8/whatsapp/messages/media', async (req, res) => {
    try { res.json({ success: true, data: await whatsapp.sendMedia(req.body.to, req.body.mediaUrl, req.body.type, req.body.caption) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // LINKEDIN
  // ═══════════════════════════════════════════════════════════════════════════

  app.get('/api/v8/linkedin/profile', async (req, res) => {
    try { res.json({ success: true, data: await linkedin.getProfile() }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.get('/api/v8/linkedin/posts', async (req, res) => {
    try { res.json({ success: true, data: await linkedin.getPosts(req.query) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.post('/api/v8/linkedin/posts', async (req, res) => {
    try { res.json({ success: true, data: await linkedin.createPost(req.body.text, req.body) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.get('/api/v8/linkedin/connections', async (req, res) => {
    try { res.json({ success: true, data: await linkedin.getConnections(req.query) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // TELEGRAM BOT
  // ═══════════════════════════════════════════════════════════════════════════

  app.get('/api/v8/telegram/me', async (req, res) => {
    try { res.json({ success: true, data: await telegram.getMe() }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.post('/api/v8/telegram/messages', async (req, res) => {
    try { res.json({ success: true, data: await telegram.sendMessage(req.body.chatId, req.body.text, req.body) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.post('/api/v8/telegram/webhook', async (req, res) => {
    try {
      const { setWebhook } = await telegram.setWebhook(req.body.url);
      res.json({ success: true, webhook: setWebhook });
    } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // SLACK BOT
  // ═══════════════════════════════════════════════════════════════════════════

  app.get('/api/v8/slack/auth', async (req, res) => {
    try { res.json({ success: true, data: await slack.authTest() }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.post('/api/v8/slack/messages', async (req, res) => {
    try { res.json({ success: true, data: await slack.postMessage(req.body.channel, req.body.text, req.body) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.post('/api/v8/slack/schedule', async (req, res) => {
    try { res.json({ success: true, data: await slack.scheduleMessage(req.body.channel, req.body.text, req.body.postAt) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.post('/api/v8/slack/files', async (req, res) => {
    try { res.json({ success: true, data: await slack.uploadFile(req.body.channel, req.body.file, req.body) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // DISCORD BOT
  // ═══════════════════════════════════════════════════════════════════════════

  app.get('/api/v8/discord/me', async (req, res) => {
    try { res.json({ success: true, data: await discord.getCurrentUser() }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.post('/api/v8/discord/messages', async (req, res) => {
    try { res.json({ success: true, data: await discord.sendMessage(req.body.channelId, req.body.content, req.body) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.post('/api/v8/discord/dm', async (req, res) => {
    try { res.json({ success: true, data: await discord.createDM(req.body.userId) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.post('/api/v8/discord/roles', async (req, res) => {
    try { res.json({ success: true, data: await discord.addRole(req.body.guildId, req.body.userId, req.body.roleId) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // MICROSOFT TEAMS BOT
  // ═══════════════════════════════════════════════════════════════════════════

  app.get('/api/v8/teams/me', async (req, res) => {
    try { res.json({ success: true, data: await teams.getBotUserInfo() }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.post('/api/v8/teams/messages', async (req, res) => {
    try { res.json({ success: true, data: await teams.sendMessage(req.body.conversationId, req.body.text, req.body) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.post('/api/v8/teams/cards', async (req, res) => {
    try { res.json({ success: true, data: await teams.sendCard(req.body.conversationId, req.body.card, req.body) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // ZOOM BOT
  // ═══════════════════════════════════════════════════════════════════════════

  app.get('/api/v8/zoom/me', async (req, res) => {
    try { res.json({ success: true, data: await zoom.getBotUserInfo() }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.post('/api/v8/zoom/channel', async (req, res) => {
    try { res.json({ success: true, data: await zoom.sendChannelMessage(req.body.channelId, req.body.content) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.get('/api/v8/zoom/meetings/:id', async (req, res) => {
    try { res.json({ success: true, data: await zoom.getMeeting(req.params.id) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.post('/api/v8/zoom/meetings', async (req, res) => {
    try { res.json({ success: true, data: await zoom.createMeeting(req.body.topic, req.body) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // STATUS
  // ═══════════════════════════════════════════════════════════════════════════

  app.get('/api/v8/integrations', (req, res) => {
    res.json({ success: true, ...manager.getStatusSummary() });
  });

  return { manager, twitter, instagram, whatsapp, linkedin, telegram, slack, discord, teams, zoom };
}

export default { createSocialRoutes };
