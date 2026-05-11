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
      tags: i.string().optional(),
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
      tags: i.string().optional(),
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
      // "monitor" or "feed"
      sourceType: i.string(),
      // monitor-specific
      type: i.string().optional(),
      mode: i.string().optional(),
      selector: i.string().optional(),
      clickSelector: i.string().optional(),
      urlPlaceholder: i.string().optional(),
      // feed-specific
      feedUrl: i.string().optional(),
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
