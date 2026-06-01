## Why

Keen is a capable monitoring tool but operates as a flat collection of monitors with no organization, no persistent worker infrastructure, and limited notification delivery. To grow into a composable monitoring platform, it needs Spaces for organization, a reliable worker/queue backend, webhooks, advanced filtering rules, and historical tracking.

## What Changes

- Introduce **Spaces** as organizational containers for monitors and feeds, replacing flat tag/group-based grouping
- Migrate background monitoring from external cron + single API route to a **persistent worker** on Fly.io with BullMQ queues on Upstash Redis
- Add **shared source polling** so multiple monitors watching the same URL share a single fetch
- Implement a **webhook delivery system** with HMAC signing, retries, and delivery logs
- Add an **advanced rule engine** for conditional alerting (price thresholds, keyword filters, regex matching)
- Add **historical tracking** — snapshot storage, change diffs, price graphs
- Expand **notifications** to support Discord, Slack, Telegram, and webhooks in addition to email
- Add monitor `frequency_seconds`, `next_check_at`, `last_checked_at`, and `status` fields
- Expand browser extension with CSS element picker, RSS auto-detect, and one-click page monitoring
- Restructure codebase into a **monorepo** (`apps/web`, `apps/worker`, `packages/*`)

## Capabilities

### New Capabilities

- `spaces`: Organizational containers for monitors and feeds with color/icon customization, per-space notification settings, and archiving
- `worker-infrastructure`: Persistent Fly.io worker with BullMQ scheduler loop, queue processing, shared source deduplication, and retry system
- `webhook-system`: User-configurable webhook endpoints with HMAC signing, event subscriptions, delivery logs, and replay
- `advanced-rules`: Visual rule builder for conditional alerting with field/operator/value rules grouped by AND/OR/NOT
- `historical-tracking`: Snapshot storage, side-by-side diffs, price graphs, and timeline viewer per monitor
- `notification-channels`: Delivery to Discord, Slack, Telegram, and generic webhooks with digest scheduling and quiet hours
- `monorepo-structure`: Turborepo monorepo splitting web app, worker app, and shared packages (db, monitoring, shared, types)

### Modified Capabilities

## Impact

- **Database**: New tables for spaces, source_entities, monitor_events, webhook_deliveries, snapshots; alter monitors table for scheduling fields
- **API routes**: New endpoints for spaces CRUD, webhook management, rule management, history; existing `/api/cron/check` retired
- **Worker**: New `apps/worker` Node.js service deployed to Fly.io
- **Dependencies**: Add BullMQ, ioredis (Upstash), diff library, charting library; monorepo tooling (Turborepo/pnpm workspaces)
- **Extension**: Enhance element picker, add one-click page monitoring flow
- **Database client**: Migrate from InstantDB to Supabase PostgreSQL for relational data needs
