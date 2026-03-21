import { EventEmitter } from 'events';

export class Notification {
  constructor(config) {
    this.id = config.id || `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    this.type = config.type || 'info';
    this.title = config.title;
    this.message = config.message;
    this.data = config.data || {};
    this.priority = config.priority || 'normal';
    this.read = false;
    this.dismissed = false;
    this.createdAt = Date.now();
    this.readAt = null;
    this.expiresAt = config.expiresAt || null;
  }

  isExpired() {
    return this.expiresAt && Date.now() > this.expiresAt;
  }
}

export class NotificationChannel {
  constructor(name, sender) {
    this.name = name;
    this.sender = sender;
    this.enabled = true;
  }

  async send(notification) {
    if (!this.enabled) return;
    return this.sender(notification);
  }

  disable() {
    this.enabled = false;
  }

  enable() {
    this.enabled = true;
  }
}

export class NotificationCenter extends EventEmitter {
  constructor(options = {}) {
    super();

    this.notifications = new Map();
    this.channels = new Map();
    this.subscriptions = new Map();
    this.maxNotifications = options.maxNotifications || 1000;
    this.defaultTTL = options.defaultTTL || 604800000;

    this.stats = {
      totalSent: 0,
      totalRead: 0,
      totalDismissed: 0,
      byChannel: new Map(),
      byType: { info: 0, success: 0, warning: 0, error: 0 }
    };

    this.registerDefaultChannels();
  }

  registerDefaultChannels() {
    this.registerChannel('console', (notif) => {
      console.log(`[${notif.type.toUpperCase()}] ${notif.title}: ${notif.message}`);
    });

    this.registerChannel('memory', (notif) => {
      this.notifications.set(notif.id, notif);
      this.pruneNotifications();
    });
  }

  registerChannel(name, sender) {
    const channel = new NotificationChannel(name, sender);
    this.channels.set(name, channel);
    return channel;
  }

  removeChannel(name) {
    return this.channels.delete(name);
  }

  async send(config) {
    const notification = new Notification({
      ...config,
      expiresAt: config.expiresAt || (Date.now() + this.defaultTTL)
    });

    const channelName = config.channel || 'memory';
    const channel = this.channels.get(channelName);

    if (channel) {
      try {
        await channel.send(notification);
        this.stats.totalSent++;

        const count = this.stats.byChannel.get(channelName) || 0;
        this.stats.byChannel.set(channelName, count + 1);

        this.stats.byType[notification.type] = (this.stats.byType[notification.type] || 0) + 1;

        this.emit('sent', notification);
      } catch (error) {
        this.emit('error', { notification, error: error.message });
      }
    }

    return notification;
  }

  info(title, message, options = {}) {
    return this.send({ type: 'info', title, message, ...options });
  }

  success(title, message, options = {}) {
    return this.send({ type: 'success', title, message, ...options });
  }

  warning(title, message, options = {}) {
    return this.send({ type: 'warning', title, message, ...options });
  }

  error(title, message, options = {}) {
    return this.send({ type: 'error', title, message, ...options });
  }

  subscribe(userId, filters = {}) {
    if (!this.subscriptions.has(userId)) {
      this.subscriptions.set(userId, []);
    }

    const subscription = {
      id: `sub_${Date.now()}`,
      userId,
      filters,
      createdAt: Date.now()
    };

    this.subscriptions.get(userId).push(subscription);
    return subscription;
  }

  unsubscribe(userId, subscriptionId) {
    const subs = this.subscriptions.get(userId);
    if (subs) {
      const index = subs.findIndex(s => s.id === subscriptionId);
      if (index > -1) {
        subs.splice(index, 1);
        return true;
      }
    }
    return false;
  }

  getForUser(userId, filters = {}) {
    let results = Array.from(this.notifications.values())
      .filter(n => !n.dismissed && !n.isExpired());

    if (filters.unreadOnly) {
      results = results.filter(n => !n.read);
    }
    if (filters.type) {
      results = results.filter(n => n.type === filters.type);
    }
    if (filters.priority) {
      results = results.filter(n => n.priority === filters.priority);
    }

    return results.sort((a, b) => b.createdAt - a.createdAt);
  }

  markAsRead(notificationId) {
    const notification = this.notifications.get(notificationId);
    if (notification) {
      notification.read = true;
      notification.readAt = Date.now();
      this.stats.totalRead++;
      this.emit('read', notification);
      return true;
    }
    return false;
  }

  markAllAsRead(userId) {
    const notifications = this.getForUser(userId, { unreadOnly: true });
    for (const notif of notifications) {
      notif.read = true;
      notif.readAt = Date.now();
      this.stats.totalRead++;
    }
    return notifications.length;
  }

  dismiss(notificationId) {
    const notification = this.notifications.get(notificationId);
    if (notification) {
      notification.dismissed = true;
      this.stats.totalDismissed++;
      this.emit('dismissed', notification);
      return true;
    }
    return false;
  }

  pruneNotifications() {
    if (this.notifications.size <= this.maxNotifications) return;

    const sorted = Array.from(this.notifications.values())
      .sort((a, b) => b.createdAt - a.createdAt);

    const toRemove = sorted.slice(this.maxNotifications);
    for (const notif of toRemove) {
      this.notifications.delete(notif.id);
    }

    return toRemove.length;
  }

  getStats() {
    return {
      ...this.stats,
      byChannel: Object.fromEntries(this.stats.byChannel),
      totalStored: this.notifications.size,
      subscriptions: this.subscriptions.size
    };
  }

  clear(userId) {
    if (userId) {
      let count = 0;
      for (const notif of this.notifications.values()) {
        if (notif.userId === userId) {
          this.notifications.delete(notif.id);
          count++;
        }
      }
      return count;
    }
    const count = this.notifications.size;
    this.notifications.clear();
    return count;
  }
}

let notificationCenter = null;

export function getNotificationCenter(options = {}) {
  if (!notificationCenter) {
    notificationCenter = new NotificationCenter(options);
  }
  return notificationCenter;
}

export default { NotificationCenter, Notification, NotificationChannel, getNotificationCenter };
