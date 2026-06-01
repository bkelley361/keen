import { i } from "@instantdb/react";

const _schema = i.schema({
  entities: {
    $users: i.entity({
      email: i.string().unique().indexed(),
    }),
    monitors: i.entity({
      userId: i.string().indexed(),
      name: i.string(),
      type: i.string(),
      url: i.string(),
      selector: i.string().optional(),
      clickSelector: i.string().optional(),
      active: i.boolean(),
      lastValue: i.string().optional(),
      lastChecked: i.number().optional(),
      lastStatus: i.string().optional(),
      lastShortId: i.string().optional(),
      lastShortTitle: i.string().optional(),
      lastPostId: i.string().optional(),
      lastPostText: i.string().optional(),
      seenShortId: i.string().optional(),
      seenPostId: i.string().optional(),
      archived: i.boolean().optional(),
      group: i.string().optional(),
      tags: i.string().optional(),
      // Spaces
      spaceId: i.string().optional().indexed(),
      // Worker scheduling
      frequencySeconds: i.number().optional(),
      nextCheckAt: i.number().optional(),
      lastCheckedAt: i.number().optional(),
      status: i.string().optional(), // 'active' | 'paused' | 'error' | 'archived'
      costClass: i.string().optional(), // 'low' | 'medium' | 'high'
      // Advanced rules (stored as JSON string)
      rules: i.string().optional(),
    }),
    notifications: i.entity({
      monitorId: i.string().indexed(),
      oldValue: i.string().optional(),
      newValue: i.string().optional(),
      sentAt: i.number().optional(),
      kind: i.string().optional(),
      itemUrl: i.string().optional(),
    }),
    feedTokens: i.entity({
      token: i.string().unique().indexed(),
      userId: i.string().indexed(),
      createdAt: i.number(),
    }),
    feeds: i.entity({
      userId: i.string().indexed(),
      name: i.string(),
      feedUrl: i.string(),
      active: i.boolean(),
      lastFetch: i.number().optional(),
      itemCount: i.number().optional(),
      archived: i.boolean().optional(),
      group: i.string().optional(),
      tags: i.string().optional(),
      spaceId: i.string().optional().indexed(),
    }),
    feedItems: i.entity({
      feedId: i.string().indexed(),
      title: i.string(),
      link: i.string(),
      pubDate: i.number(),
      description: i.string().optional(),
      read: i.boolean(),
      addedAt: i.number(),
      bookmarked: i.boolean().optional(),
    }),
    userPrefs: i.entity({
      userId: i.string().unique().indexed(),
      notificationEmail: i.string().optional(),
      hideThumbnails: i.boolean().optional(),
      cardSort: i.string().optional(),
    }),
    monitorTemplates: i.entity({
      userId: i.string().indexed(),
      name: i.string(),
      description: i.string().optional(),
      icon: i.string().optional(),
      category: i.string().optional(),
      isPublic: i.boolean(),
      sourceType: i.string(),
      type: i.string().optional(),
      mode: i.string().optional(),
      selector: i.string().optional(),
      clickSelector: i.string().optional(),
      urlPlaceholder: i.string().optional(),
      feedUrl: i.string().optional(),
      createdAt: i.number(),
    }),
    // Spaces — organizational containers for monitors and feeds
    spaces: i.entity({
      userId: i.string().indexed(),
      name: i.string(),
      color: i.string().optional(),
      icon: i.string().optional(),
      archived: i.boolean().optional(),
      notificationSettings: i.string().optional(), // JSON string
      createdAt: i.number(),
    }),
    // Source deduplication for shared polling
    sourceEntities: i.entity({
      sourceType: i.string(), // 'rss' | 'youtube' | 'webpage'
      canonicalUrl: i.string().indexed(),
      lastPolledAt: i.number().optional(),
      lastHash: i.string().optional(),
    }),
    // Monitor change events
    monitorEvents: i.entity({
      monitorId: i.string().indexed(),
      eventType: i.string(), // e.g. 'website.changed', 'price.dropped', 'rss.new_item'
      payload: i.string(), // JSON string
      createdAt: i.number(),
    }),
    // Webhook endpoints configured by users
    webhookEndpoints: i.entity({
      userId: i.string().indexed(),
      url: i.string(),
      description: i.string().optional(),
      secret: i.string(),
      eventSubscriptions: i.string(), // JSON array of event type strings
      enabled: i.boolean(),
      createdAt: i.number(),
    }),
    // Webhook delivery log
    webhookDeliveries: i.entity({
      webhookId: i.string().indexed(),
      eventId: i.string().optional(),
      status: i.string(), // 'delivered' | 'failed' | 'pending'
      responseCode: i.number().optional(),
      attemptCount: i.number(),
      payload: i.string(), // JSON string of original payload
      createdAt: i.number(),
      lastAttemptAt: i.number().optional(),
    }),
    // Historical snapshots of monitored content
    snapshots: i.entity({
      monitorId: i.string().indexed(),
      contentHash: i.string(),
      contentText: i.string().optional(),
      numericValue: i.number().optional(),
      createdAt: i.number(),
    }),
    // Notification delivery channels per user
    notificationChannels: i.entity({
      userId: i.string().indexed(),
      type: i.string(), // 'email' | 'discord' | 'slack' | 'telegram' | 'webhook'
      config: i.string(), // JSON string of channel-specific config
      spaceId: i.string().optional(), // if set, only for this space
      enabled: i.boolean(),
      createdAt: i.number(),
    }),
  },
  links: {},
  rooms: {},
});

type _AppSchema = typeof _schema;
interface AppSchema extends _AppSchema {}
const schema: AppSchema = _schema;

export type { AppSchema };
export default schema;
