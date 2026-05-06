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
    }),
    notifications: i.entity({
      monitorId: i.string().indexed(),
      oldValue: i.string().optional(),
      newValue: i.string().optional(),
      sentAt: i.number().optional(),
    }),
    feeds: i.entity({
      userId: i.string().indexed(),
      name: i.string(),
      feedUrl: i.string(),
      active: i.boolean(),
      lastFetch: i.number().optional(),
      itemCount: i.number().optional(),
    }),
    feedItems: i.entity({
      feedId: i.string().indexed(),
      title: i.string(),
      link: i.string(),
      pubDate: i.number(),
      description: i.string().optional(),
      read: i.boolean(),
      addedAt: i.number(),
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
