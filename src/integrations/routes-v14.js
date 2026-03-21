#!/usr/bin/env node

import { getMediaIntegrationManager } from './media-integrations.js';
import {
  CourseraIntegration,
  UdemyIntegration,
  SkillshareIntegration,
  DuolingoIntegration,
  QuizletIntegration,
  EdmodoIntegration,
  CodecademyIntegration,
  DatacampIntegration,
  PluralsightIntegration,
  UdacityIntegration,
  MediumIntegration,
  SubstackIntegration,
  GhostIntegration,
  YouTubeIntegration,
  VimeoIntegration,
  TwitchIntegration,
  SpotifyIntegration,
  AppleMusicIntegration,
  SoundCloudIntegration,
  PandoraIntegration,
  BandcampIntegration,
  DiscordIntegration,
  SlackIntegration,
  ZoomIntegration,
  MicrosoftTeamsIntegration,
  SignalIntegration,
  ViberIntegration,
  LineIntegration,
  WeChatIntegration
} from './media-integrations.js';

export function createMediaRoutes(app) {
  const manager = getMediaIntegrationManager();

  const coursera = new CourseraIntegration({ accessToken: process.env.COURSERA_TOKEN });
  const udemy = new UdemyIntegration({ clientId: process.env.UDEMY_CLIENT_ID });
  const skillshare = new SkillshareIntegration({ apiKey: process.env.SKILLSHARE_API_KEY });
  const duolingo = new DuolingoIntegration({ accessToken: process.env.DUOLINGO_TOKEN });
  const quizlet = new QuizletIntegration({ accessToken: process.env.QUIZLET_TOKEN });
  const edmodo = new EdmodoIntegration({ apiKey: process.env.EDMODO_API_KEY });
  const codecademy = new CodecademyIntegration({ apiKey: process.env.CODECADEMY_API_KEY });
  const datacamp = new DatacampIntegration({ apiKey: process.env.DATACAMP_API_KEY });
  const pluralsight = new PluralsightIntegration({ apiKey: process.env.PLURALSIGHT_API_KEY });
  const udacity = new UdacityIntegration({ apiKey: process.env.UDACITY_API_KEY });
  const medium = new MediumIntegration({ integrationToken: process.env.MEDIUM_TOKEN });
  const substack = new SubstackIntegration({ apiKey: process.env.SUBSTACK_API_KEY });
  const ghost = new GhostIntegration({ adminApiKey: process.env.GHOST_ADMIN_KEY, url: process.env.GHOST_URL });
  const youtube = new YouTubeIntegration({ apiKey: process.env.YOUTUBE_API_KEY });
  const vimeo = new VimeoIntegration({ accessToken: process.env.VIMEO_TOKEN });
  const twitch = new TwitchIntegration({ clientId: process.env.TWITCH_CLIENT_ID });
  const spotify = new SpotifyIntegration({ accessToken: process.env.SPOTIFY_TOKEN });
  const applemusic = new AppleMusicIntegration({ developerToken: process.env.APPLE_MUSIC_TOKEN });
  const soundcloud = new SoundCloudIntegration({ clientId: process.env.SOUNDCLOUD_CLIENT_ID });
  const pandora = new PandoraIntegration({ partnerId: process.env.PANDORA_PARTNER_ID });
  const bandcamp = new BandcampIntegration({ apiKey: process.env.BANDCAMP_API_KEY });
  const discord = new DiscordIntegration({ botToken: process.env.DISCORD_BOT_TOKEN });
  const slack = new SlackIntegration({ botToken: process.env.SLACK_BOT_TOKEN });
  const zoom = new ZoomIntegration({ apiKey: process.env.ZOOM_API_KEY });
  const msteams = new MicrosoftTeamsIntegration({ clientId: process.env.MS_TEAMS_CLIENT_ID });
  const signal = new SignalIntegration({ serviceId: process.env.SIGNAL_SERVICE_ID });
  const viber = new ViberIntegration({ authToken: process.env.VIBER_TOKEN });
  const line = new LineIntegration({ channelSecret: process.env.LINE_CHANNEL_SECRET });
  const wechat = new WeChatIntegration({ appId: process.env.WECHAT_APP_ID });

  manager.register('coursera', coursera);
  manager.register('udemy', udemy);
  manager.register('skillshare', skillshare);
  manager.register('duolingo', duolingo);
  manager.register('quizlet', quizlet);
  manager.register('edmodo', edmodo);
  manager.register('codecademy', codecademy);
  manager.register('datacamp', datacamp);
  manager.register('pluralsight', pluralsight);
  manager.register('udacity', udacity);
  manager.register('medium', medium);
  manager.register('substack', substack);
  manager.register('ghost', ghost);
  manager.register('youtube', youtube);
  manager.register('vimeo', vimeo);
  manager.register('twitch', twitch);
  manager.register('spotify', spotify);
  manager.register('applemusic', applemusic);
  manager.register('soundcloud', soundcloud);
  manager.register('pandora', pandora);
  manager.register('bandcamp', bandcamp);
  manager.register('discord', discord);
  manager.register('slack', slack);
  manager.register('zoom', zoom);
  manager.register('msteams', msteams);
  manager.register('signal', signal);
  manager.register('viber', viber);
  manager.register('line', line);
  manager.register('wechat', wechat);

  // ═══════════════════════════════════════════════════════════════════════════
  // COURSERA
  // ═══════════════════════════════════════════════════════════════════════════

  app.get('/api/v14/coursera/courses', async (req, res) => {
    try { res.json({ success: true, data: await coursera.getCourses(req.query) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.get('/api/v14/coursera/courses/:id', async (req, res) => {
    try { res.json({ success: true, data: await coursera.getCourse(req.params.id) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.post('/api/v14/coursera/enroll', async (req, res) => {
    try { res.json({ success: true, data: await coursera.enroll(req.body.courseId) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.get('/api/v14/coursera/enrollments', async (req, res) => {
    try { res.json({ success: true, data: await coursera.getEnrollments() }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.get('/api/v14/coursera/search', async (req, res) => {
    try { res.json({ success: true, data: await coursera.searchCourses(req.query.q) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // UDEMY
  // ═══════════════════════════════════════════════════════════════════════════

  app.get('/api/v14/udemy/courses', async (req, res) => {
    try { res.json({ success: true, data: await udemy.getCourses(req.query) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.get('/api/v14/udemy/courses/:id', async (req, res) => {
    try { res.json({ success: true, data: await udemy.getCourse(req.params.id) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.post('/api/v14/udemy/enroll', async (req, res) => {
    try { res.json({ success: true, data: await udemy.enroll(req.body.courseId) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.get('/api/v14/udemy/search', async (req, res) => {
    try { res.json({ success: true, data: await udemy.searchCourses(req.query.q) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // SKILLSHARE
  // ═══════════════════════════════════════════════════════════════════════════

  app.get('/api/v14/skillshare/classes', async (req, res) => {
    try { res.json({ success: true, data: await skillshare.getClasses(req.query) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.get('/api/v14/skillshare/classes/:id', async (req, res) => {
    try { res.json({ success: true, data: await skillshare.getClass(req.params.id) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.post('/api/v14/skillshare/enroll', async (req, res) => {
    try { res.json({ success: true, data: await skillshare.enroll(req.body.classId) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // DUOLINGO
  // ═══════════════════════════════════════════════════════════════════════════

  app.get('/api/v14/duolingo/user', async (req, res) => {
    try { res.json({ success: true, data: await duolingo.getUser() }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.get('/api/v14/duolingo/progress', async (req, res) => {
    try { res.json({ success: true, data: await duolingo.getProgress() }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.get('/api/v14/duolingo/streak', async (req, res) => {
    try { res.json({ success: true, data: await duolingo.getStreak() }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.get('/api/v14/duolingo/vocabulary', async (req, res) => {
    try { res.json({ success: true, data: await duolingo.getVocabulary() }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // QUIZLET
  // ═══════════════════════════════════════════════════════════════════════════

  app.get('/api/v14/quizlet/sets', async (req, res) => {
    try { res.json({ success: true, data: await quizlet.getSets(req.query) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.get('/api/v14/quizlet/sets/:id', async (req, res) => {
    try { res.json({ success: true, data: await quizlet.getSet(req.params.id) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.post('/api/v14/quizlet/sets', async (req, res) => {
    try { res.json({ success: true, data: await quizlet.createSet(req.body) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.get('/api/v14/quizlet/search', async (req, res) => {
    try { res.json({ success: true, data: await quizlet.searchSets(req.query.q) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // CODECADEMY
  // ═══════════════════════════════════════════════════════════════════════════

  app.get('/api/v14/codecademy/user', async (req, res) => {
    try { res.json({ success: true, data: await codecademy.getUser() }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.get('/api/v14/codecademy/progress', async (req, res) => {
    try { res.json({ success: true, data: await codecademy.getProgress() }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.get('/api/v14/codecademy/streaks', async (req, res) => {
    try { res.json({ success: true, data: await codecademy.getStreaks() }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.get('/api/v14/codecademy/badges', async (req, res) => {
    try { res.json({ success: true, data: await codecademy.getBadges() }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // DATACAMP
  // ═══════════════════════════════════════════════════════════════════════════

  app.get('/api/v14/datacamp/user', async (req, res) => {
    try { res.json({ success: true, data: await datacamp.getUser() }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.get('/api/v14/datacamp/courses', async (req, res) => {
    try { res.json({ success: true, data: await datacamp.getCourses() }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.get('/api/v14/datacamp/progress', async (req, res) => {
    try { res.json({ success: true, data: await datacamp.getProgress() }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // PLURALSIGHT
  // ═══════════════════════════════════════════════════════════════════════════

  app.get('/api/v14/pluralsight/user', async (req, res) => {
    try { res.json({ success: true, data: await pluralsight.getUser() }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.get('/api/v14/pluralsight/courses', async (req, res) => {
    try { res.json({ success: true, data: await pluralsight.getCourses(req.query) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.get('/api/v14/pluralsight/skills', async (req, res) => {
    try { res.json({ success: true, data: await pluralsight.getSkills() }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // UDACITY
  // ═══════════════════════════════════════════════════════════════════════════

  app.get('/api/v14/udacity/nanodegrees', async (req, res) => {
    try { res.json({ success: true, data: await udacity.getNanodegrees() }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.get('/api/v14/udacity/nanodegrees/:id', async (req, res) => {
    try { res.json({ success: true, data: await udacity.getNanodegree(req.params.id) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.post('/api/v14/udacity/enroll', async (req, res) => {
    try { res.json({ success: true, data: await udacity.enroll(req.body.programId) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // MEDIUM
  // ═══════════════════════════════════════════════════════════════════════════

  app.get('/api/v14/medium/user', async (req, res) => {
    try { res.json({ success: true, data: await medium.getUser() }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.get('/api/v14/medium/posts', async (req, res) => {
    try { res.json({ success: true, data: await medium.getPosts(req.query) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.get('/api/v14/medium/posts/:id', async (req, res) => {
    try { res.json({ success: true, data: await medium.getPost(req.params.id) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.post('/api/v14/medium/posts', async (req, res) => {
    try { res.json({ success: true, data: await medium.createPost(req.body) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // SUBSTACK
  // ═══════════════════════════════════════════════════════════════════════════

  app.get('/api/v14/substack/posts', async (req, res) => {
    try { res.json({ success: true, data: await substack.getPosts(req.query) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.post('/api/v14/substack/posts', async (req, res) => {
    try { res.json({ success: true, data: await substack.createPost(req.body) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.get('/api/v14/substack/subscribers', async (req, res) => {
    try { res.json({ success: true, data: await substack.getSubscribers() }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.post('/api/v14/substack/send', async (req, res) => {
    try { res.json({ success: true, data: await substack.sendNewsletter(req.body.postId) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // GHOST
  // ═══════════════════════════════════════════════════════════════════════════

  app.get('/api/v14/ghost/posts', async (req, res) => {
    try { res.json({ success: true, data: await ghost.getPosts(req.query) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.get('/api/v14/ghost/posts/:id', async (req, res) => {
    try { res.json({ success: true, data: await ghost.getPost(req.params.id) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.post('/api/v14/ghost/posts', async (req, res) => {
    try { res.json({ success: true, data: await ghost.createPost(req.body) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.get('/api/v14/ghost/members', async (req, res) => {
    try { res.json({ success: true, data: await ghost.getMembers(req.query) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // YOUTUBE
  // ═══════════════════════════════════════════════════════════════════════════

  app.get('/api/v14/youtube/channel', async (req, res) => {
    try { res.json({ success: true, data: await youtube.getChannel(req.query.channelId) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.get('/api/v14/youtube/videos', async (req, res) => {
    try { res.json({ success: true, data: await youtube.getVideos(req.query) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.get('/api/v14/youtube/videos/:id', async (req, res) => {
    try { res.json({ success: true, data: await youtube.getVideo(req.params.id) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.get('/api/v14/youtube/search', async (req, res) => {
    try { res.json({ success: true, data: await youtube.searchVideos(req.query.q, parseInt(req.query.max) || 10) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.get('/api/v14/youtube/playlists', async (req, res) => {
    try { res.json({ success: true, data: await youtube.getPlaylists() }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // VIMEO
  // ═══════════════════════════════════════════════════════════════════════════

  app.get('/api/v14/vimeo/user', async (req, res) => {
    try { res.json({ success: true, data: await vimeo.getUser() }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.get('/api/v14/vimeo/videos', async (req, res) => {
    try { res.json({ success: true, data: await vimeo.getVideos(req.query) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.get('/api/v14/vimeo/videos/:id', async (req, res) => {
    try { res.json({ success: true, data: await vimeo.getVideo(req.params.id) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.get('/api/v14/vimeo/albums', async (req, res) => {
    try { res.json({ success: true, data: await vimeo.getAlbums() }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // TWITCH
  // ═══════════════════════════════════════════════════════════════════════════

  app.get('/api/v14/twitch/user', async (req, res) => {
    try { res.json({ success: true, data: await twitch.getUser(req.query.userId) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.get('/api/v14/twitch/channel', async (req, res) => {
    try { res.json({ success: true, data: await twitch.getChannel() }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.get('/api/v14/twitch/streams', async (req, res) => {
    try { res.json({ success: true, data: await twitch.getStreams() }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.get('/api/v14/twitch/videos', async (req, res) => {
    try { res.json({ success: true, data: await twitch.getVideos(req.query.userId) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // SPOTIFY
  // ═══════════════════════════════════════════════════════════════════════════

  app.get('/api/v14/spotify/me', async (req, res) => {
    try { res.json({ success: true, data: await spotify.getMe() }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.get('/api/v14/spotify/playlists', async (req, res) => {
    try { res.json({ success: true, data: await spotify.getPlaylists() }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.get('/api/v14/spotify/playing', async (req, res) => {
    try { res.json({ success: true, data: await spotify.getCurrentlyPlaying() }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.post('/api/v14/spotify/playlists', async (req, res) => {
    try { res.json({ success: true, data: await spotify.createPlaylist(req.body.name, req.body.description) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.get('/api/v14/spotify/search', async (req, res) => {
    try { res.json({ success: true, data: await spotify.search(req.query.q, req.query.type || 'track') }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.get('/api/v14/spotify/recommendations', async (req, res) => {
    try { res.json({ success: true, data: await spotify.getRecommendations(req.query.seeds?.split(',') || []) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // APPLE MUSIC
  // ═══════════════════════════════════════════════════════════════════════════

  app.get('/api/v14/applemusic/me', async (req, res) => {
    try { res.json({ success: true, data: await applemusic.getUserProfile() }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.get('/api/v14/applemusic/playlists', async (req, res) => {
    try { res.json({ success: true, data: await applemusic.getLibraryPlaylists() }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.get('/api/v14/applemusic/recent', async (req, res) => {
    try { res.json({ success: true, data: await applemusic.getRecentlyPlayed() }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // SOUNDCLOUD
  // ═══════════════════════════════════════════════════════════════════════════

  app.get('/api/v14/soundcloud/me', async (req, res) => {
    try { res.json({ success: true, data: await soundcloud.getUser(req.query.userId) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.get('/api/v14/soundcloud/tracks', async (req, res) => {
    try { res.json({ success: true, data: await soundcloud.getTracks(req.query) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.get('/api/v14/soundcloud/playlists', async (req, res) => {
    try { res.json({ success: true, data: await soundcloud.getPlaylists() }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // PANDORA
  // ═══════════════════════════════════════════════════════════════════════════

  app.get('/api/v14/pandora/stations', async (req, res) => {
    try { res.json({ success: true, data: await pandora.getStations() }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.get('/api/v14/pandora/stations/:id', async (req, res) => {
    try { res.json({ success: true, data: await pandora.getStation(req.params.id) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.post('/api/v14/pandora/stations', async (req, res) => {
    try { res.json({ success: true, data: await pandora.createStation(req.body.seed) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // BANDCAMP
  // ═══════════════════════════════════════════════════════════════════════════

  app.get('/api/v14/bandcamp/artist', async (req, res) => {
    try { res.json({ success: true, data: await bandcamp.getArtist(req.query.artistId) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.get('/api/v14/bandcamp/albums', async (req, res) => {
    try { res.json({ success: true, data: await bandcamp.getAlbums(req.query.artistId) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.get('/api/v14/bandcamp/albums/:id', async (req, res) => {
    try { res.json({ success: true, data: await bandcamp.getAlbum(req.params.id) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // DISCORD
  // ═══════════════════════════════════════════════════════════════════════════

  app.get('/api/v14/discord/guilds', async (req, res) => {
    try { res.json({ success: true, data: await discord.getGuilds() }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.get('/api/v14/discord/guilds/:id', async (req, res) => {
    try { res.json({ success: true, data: await discord.getGuild(req.params.id) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.get('/api/v14/discord/channels/:guildId', async (req, res) => {
    try { res.json({ success: true, data: await discord.getChannels(req.params.guildId) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.post('/api/v14/discord/messages', async (req, res) => {
    try { res.json({ success: true, data: await discord.sendMessage(req.body.channelId, req.body.content) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // SLACK
  // ═══════════════════════════════════════════════════════════════════════════

  app.get('/api/v14/slack/auth', async (req, res) => {
    try { res.json({ success: true, data: await slack.authTest() }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.get('/api/v14/slack/users', async (req, res) => {
    try { res.json({ success: true, data: await slack.getUsers() }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.get('/api/v14/slack/channels', async (req, res) => {
    try { res.json({ success: true, data: await slack.getChannels() }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.post('/api/v14/slack/message', async (req, res) => {
    try { res.json({ success: true, data: await slack.postMessage(req.body.channel, req.body.text) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // ZOOM
  // ═══════════════════════════════════════════════════════════════════════════

  app.get('/api/v14/zoom/users', async (req, res) => {
    try { res.json({ success: true, data: await zoom.getUsers() }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.get('/api/v14/zoom/meetings', async (req, res) => {
    try { res.json({ success: true, data: await zoom.listMeetings(req.query.userId) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.post('/api/v14/zoom/meetings', async (req, res) => {
    try { res.json({ success: true, data: await zoom.createMeeting(req.body) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.delete('/api/v14/zoom/meetings/:id', async (req, res) => {
    try { res.json({ success: true, data: await zoom.deleteMeeting(req.params.id) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // MICROSOFT TEAMS
  // ═══════════════════════════════════════════════════════════════════════════

  app.get('/api/v14/msteams/teams', async (req, res) => {
    try { res.json({ success: true, data: await msteams.getGroups() }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.get('/api/v14/msteams/channels/:teamId', async (req, res) => {
    try { res.json({ success: true, data: await msteams.getChannels(req.params.teamId) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.post('/api/v14/msteams/messages', async (req, res) => {
    try { res.json({ success: true, data: await msteams.sendMessage(req.body.channelId, req.body.message) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // SIGNAL
  // ═══════════════════════════════════════════════════════════════════════════

  app.get('/api/v14/signal/profile/:identifier', async (req, res) => {
    try { res.json({ success: true, data: await signal.getProfile(req.params.identifier) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.post('/api/v14/signal/send', async (req, res) => {
    try { res.json({ success: true, data: await signal.sendMessage(req.body.recipient, req.body.message) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // VIBER
  // ═══════════════════════════════════════════════════════════════════════════

  app.get('/api/v14/viber/account', async (req, res) => {
    try { res.json({ success: true, data: await viber.getAccountInfo() }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.post('/api/v14/viber/send', async (req, res) => {
    try { res.json({ success: true, data: await viber.sendMessage(req.body.to, req.body.message) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // LINE
  // ═══════════════════════════════════════════════════════════════════════════

  app.get('/api/v14/line/profile/:userId', async (req, res) => {
    try { res.json({ success: true, data: await line.getProfile(req.params.userId) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.post('/api/v14/line/push', async (req, res) => {
    try { res.json({ success: true, data: await line.pushMessage(req.body.to, req.body.messages) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.post('/api/v14/line/reply', async (req, res) => {
    try { res.json({ success: true, data: await line.replyMessage(req.body.replyToken, req.body.messages) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // WECHAT
  // ═══════════════════════════════════════════════════════════════════════════

  app.post('/api/v14/wechat/send', async (req, res) => {
    try { res.json({ success: true, data: await wechat.sendMessage(req.body.to, req.body.content) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.get('/api/v14/wechat/user/:openid', async (req, res) => {
    try { res.json({ success: true, data: await wechat.getUserInfo(req.params.openid) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.get('/api/v14/wechat/tags', async (req, res) => {
    try { res.json({ success: true, data: await wechat.getTags() }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // STATUS
  // ═══════════════════════════════════════════════════════════════════════════

  app.get('/api/v14/integrations', (req, res) => {
    res.json({ success: true, ...manager.getStatusSummary() });
  });

  return { manager, coursera, udemy, skillshare, duolingo, quizlet, edmodo, codecademy, datacamp, pluralsight, udacity, medium, substack, ghost, youtube, vimeo, twitch, spotify, applemusic, soundcloud, pandora, bandcamp, discord, slack, zoom, msteams, signal, viber, line, wechat };
}

export default { createMediaRoutes };
