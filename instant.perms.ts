import type { InstantRules } from "@instantdb/react";

const rules = {
  monitors: {
    allow: {
      view: "auth.id != null && data.userId == auth.id",
      create: "auth.id != null && data.userId == auth.id",
      update: "auth.id != null && data.userId == auth.id",
      delete: "auth.id != null && data.userId == auth.id",
    },
  },
  notifications: {
    allow: {
      view: "auth.id != null",
      create: "auth.id != null",
      update: "auth.id != null",
      delete: "auth.id != null",
    },
  },
  feeds: {
    allow: {
      view: "auth.id != null && data.userId == auth.id",
      create: "auth.id != null && data.userId == auth.id",
      update: "auth.id != null && data.userId == auth.id",
      delete: "auth.id != null && data.userId == auth.id",
    },
  },
  feedTokens: {
    allow: {
      view: "auth.id != null && data.userId == auth.id",
      create: "auth.id != null && data.userId == auth.id",
      update: "auth.id != null && data.userId == auth.id",
      delete: "auth.id != null && data.userId == auth.id",
    },
  },
  feedItems: {
    allow: {
      view: "auth.id != null",
      create: "auth.id != null",
      update: "auth.id != null",
      delete: "auth.id != null",
    },
  },
} satisfies InstantRules;

export default rules;
