import { EventEmitter } from 'events';
import crypto from 'crypto';

export class OAuth2Provider {
  constructor(config) {
    this.name = config.name;
    this.clientId = config.clientId;
    this.clientSecret = config.clientSecret;
    this.authorizationUrl = config.authorizationUrl;
    this.tokenUrl = config.tokenUrl;
    this.scopes = config.scopes || ['read'];
    this.state = new Map();
  }

  getAuthorizationUrl(redirectUri, state = null) {
    const stateKey = state || crypto.randomBytes(16).toString('hex');
    this.state.set(stateKey, { redirectUri, timestamp: Date.now() });

    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: this.scopes.join(' '),
      state: stateKey
    });

    return `${this.authorizationUrl}?${params.toString()}`;
  }

  async exchangeCode(code, redirectUri) {
    const response = await fetch(this.tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        client_id: this.clientId,
        client_secret: this.clientSecret,
        code,
        grant_type: 'authorization_code',
        redirect_uri: redirectUri
      })
    });

    if (!response.ok) {
      throw new Error(`Token exchange failed: ${response.status}`);
    }

    return response.json();
  }

  async refreshToken(refreshToken) {
    const response = await fetch(this.tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        client_id: this.clientId,
        client_secret: this.clientSecret,
        refresh_token: refreshToken,
        grant_type: 'refresh_token'
      })
    });

    if (!response.ok) {
      throw new Error(`Token refresh failed: ${response.status}`);
    }

    return response.json();
  }

  validateState(state) {
    const data = this.state.get(state);
    if (!data) return false;

    const expired = Date.now() - data.timestamp > 600000;
    if (expired) {
      this.state.delete(state);
      return false;
    }

    this.state.delete(state);
    return true;
  }
}

export class OAuth2Manager extends EventEmitter {
  constructor() {
    super();

    this.providers = new Map();
    this.tokens = new Map();
    this.users = new Map();
  }

  registerProvider(name, config) {
    const provider = new OAuth2Provider(config);
    this.providers.set(name, provider);
    this.emit('provider:registered', { name });
    return provider;
  }

  getProvider(name) {
    return this.providers.get(name);
  }

  getAuthorizationUrl(providerName, redirectUri, options = {}) {
    const provider = this.providers.get(providerName);
    if (!provider) {
      throw new Error(`OAuth provider not found: ${providerName}`);
    }

    return provider.getAuthorizationUrl(redirectUri, options.state);
  }

  async handleCallback(providerName, code, redirectUri, options = {}) {
    const provider = this.providers.get(providerName);
    if (!provider) {
      throw new Error(`OAuth provider not found: ${providerName}`);
    }

    const tokenData = await provider.exchangeCode(code, redirectUri);

    const tokenKey = `${providerName}_${tokenData.access_token.substring(0, 16)}`;
    this.tokens.set(tokenKey, {
      provider: providerName,
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token,
      expiresAt: tokenData.expires_in ? Date.now() + (tokenData.expires_in * 1000) : null,
      scope: tokenData.scope?.split(' ') || provider.scopes
    });

    const userData = options.getUser
      ? await options.getUser(tokenData.access_token, providerName)
      : { provider: providerName };

    const userId = crypto.randomBytes(16).toString('hex');
    this.users.set(userId, {
      id: userId,
      provider: providerName,
      tokenKey,
      profile: userData,
      connectedAt: Date.now()
    });

    this.emit('user:connected', { userId, provider: providerName });

    return {
      user: this.users.get(userId),
      tokens: this.tokens.get(tokenKey)
    };
  }

  async refreshUserToken(userId) {
    const user = this.users.get(userId);
    if (!user) throw new Error('User not found');

    const tokenData = this.tokens.get(user.tokenKey);
    if (!tokenData?.refreshToken) throw new Error('No refresh token');

    const provider = this.providers.get(user.provider);
    const newTokens = await provider.refreshToken(tokenData.refreshToken);

    tokenData.accessToken = newTokens.access_token;
    if (newTokens.refresh_token) {
      tokenData.refreshToken = newTokens.refresh_token;
    }
    if (newTokens.expires_in) {
      tokenData.expiresAt = Date.now() + (newTokens.expires_in * 1000);
    }

    return tokenData;
  }

  getAccessToken(userId) {
    const user = this.users.get(userId);
    if (!user) return null;

    const tokenData = this.tokens.get(user.tokenKey);
    if (!tokenData) return null;

    if (tokenData.expiresAt && Date.now() > tokenData.expiresAt) {
      return null;
    }

    return tokenData.accessToken;
  }

  disconnect(userId) {
    const user = this.users.get(userId);
    if (!user) return false;

    this.tokens.delete(user.tokenKey);
    this.users.delete(userId);

    this.emit('user:disconnected', { userId, provider: user.provider });
    return true;
  }

  getUser(userId) {
    return this.users.get(userId);
  }

  listUsers(providerName = null) {
    let users = Array.from(this.users.values());
    if (providerName) {
      users = users.filter(u => u.provider === providerName);
    }
    return users;
  }

  getStats() {
    const byProvider = {};
    for (const user of this.users.values()) {
      byProvider[user.provider] = (byProvider[user.provider] || 0) + 1;
    }

    return {
      providers: this.providers.size,
      users: this.users.size,
      byProvider
    };
  }
}

let oauthManager = null;

export function getOAuthManager() {
  if (!oauthManager) {
    oauthManager = new OAuth2Manager();
  }
  return oauthManager;
}

export default { OAuth2Manager, OAuth2Provider, getOAuthManager };
