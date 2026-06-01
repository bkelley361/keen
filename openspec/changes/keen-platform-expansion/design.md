## Context

Keen currently runs as a single Next.js app on Vercel with an external cron trigger (cron-job.org) calling `/api/cron/check` to poll all active monitors sequentially. State is stored in InstantDB (a Firebase-like real-time database). The extension uses the same InstantDB instance directly.

This architecture blocks several features: arbitrary polling intervals, reliable retries, shared source polling, webhook delivery, and horizontal scaling. The goal is to introduce proper worker infrastructure while keeping the web app's UX intact.

**Current constraints:**
- $0 infrastructure budget initially
- Must not break existing monitor data (migration path required)
- Next.js remains the web framework
- Extension must continue working

## Goals / Non-Goals

**Goals:**
- Monorepo split: `apps/web`, `apps/worker`, `packages/{db,monitoring,shared,types}`
- Persistent worker on Fly.io with BullMQ + Upstash Redis queues
- Replace cron-job.org with internal scheduler loop
- Shared source polling to deduplicate fetches
- Spaces feature in web app
- Webhook system with HMAC signing, retries, and delivery logs
- Advanced rule engine for conditional alerting
- Historical snapshot storage and diff viewer
- Additional notification channels (Discord, Slack, Telegram)
- Database migration from InstantDB to Supabase PostgreSQL

**Non-Goals:**
- Playwright/browser automation workers (future phase)
- Team/shared Spaces with role permissions (future)
- Public dashboards (future)
- Paid template marketplace (future)
- Mobile app

## Decisions

### 1. Database: Supabase PostgreSQL (migrating from InstantDB)

**Rationale:** InstantDB is excellent for real-time client-sync but lacks the relational modeling needed for normalized tables (source_entities, monitor_events, webhook_deliveries, snapshots). Supabase provides PostgreSQL with a REST API, real-time subscriptions, Row-Level Security for auth, and a generous free tier.

**Migration path:** Export all InstantDB data via admin API → transform → seed into Supabase. Both databases run concurrently during transition. Web app migrates reads/writes to Supabase; InstantDB deprecated.

**Alternative considered:** Keep InstantDB and add a separate Postgres. Rejected — two databases for the same data adds complexity with no benefit.

### 2. Monorepo Tooling: pnpm workspaces + Turborepo

**Rationale:** Turborepo provides task caching and pipeline orchestration for build/test/lint across packages. pnpm workspaces handle linking. Both are zero-config for a 2-app monorepo.

**Alternative considered:** Nx. Rejected — heavier config, more opinionated.

### 3. Queue: BullMQ on Upstash Redis

**Rationale:** BullMQ has excellent TypeScript support, delayed jobs, priorities, retries, and rate limiting. Upstash offers a serverless Redis free tier compatible with BullMQ's ioredis client.

**Alternative considered:** SQS. Rejected — adds AWS dependency and cost complexity.

### 4. Worker Platform: Fly.io

**Rationale:** Persistent processes (not serverless), Docker support, free allowances sufficient for a single small VM, smooth vertical scale path. The worker runs a long-lived Node.js process with the BullMQ scheduler loop.

**Alternative considered:** Railway, Render. Fly.io chosen for better free tier and control.

### 5. Spaces as top-level containers (not sub-monitors)

**Rationale:** Spaces replace the existing flat tag/group system. Each monitor and feed belongs to exactly one Space (or "Default"). This avoids many-to-many complexity while providing meaningful organization.

**Spaces are not shared in v1** — that's a future team feature.

### 6. Rule Engine: in-process JSON rules evaluated at event time

**Rationale:** Rules are stored as JSON (field/operator/value arrays with AND/OR/NOT grouping) and evaluated in the worker at event generation time — before enqueueing notifications. This keeps the rule evaluator stateless and testable.

**No DSL or code execution** — rules are structured data, not scripts. UI is a visual builder.

### 7. Snapshot storage: PostgreSQL + object storage

**Rationale:** Store content hashes in Postgres; only persist full snapshots to object storage (Supabase Storage or Cloudflare R2) on change. Diff is generated on-demand from two snapshots, not stored. Price history is stored as a numeric time series in Postgres.

### 8. Webhook signing: HMAC-SHA256

Standard practice (Stripe, GitHub). Store secret per endpoint. Sign with `X-Keen-Signature: sha256=<hex>` header.

## Risks / Trade-offs

- **InstantDB migration complexity** → Mitigation: write a one-time migration script; run in dry-run mode first; keep both DBs live until web app is fully migrated
- **Fly.io free tier limits** → Mitigation: single worker VM with BullMQ concurrency limits; upgrade is just a machine resize
- **BullMQ + Upstash Redis compatibility** → Mitigation: Upstash supports ioredis protocol; test with BullMQ's `ioredis` option before committing
- **Monorepo refactor breaks existing deploy** → Mitigation: Vercel supports monorepo with `rootDirectory` config; test deploy early
- **Shared source polling fan-out latency** → Mitigation: source polling is async; subscribers are notified via queue after source fetch completes

## Migration Plan

1. Set up pnpm workspaces and Turborepo; move existing Next.js app to `apps/web`
2. Create Supabase project; design schema; write migration script from InstantDB
3. Update `apps/web` to use Supabase client; remove InstantDB dependency
4. Create `apps/worker` with BullMQ scheduler and polling workers
5. Deploy worker to Fly.io; configure Upstash Redis
6. Test parallel operation (worker polls, web app displays)
7. Disable cron-job.org trigger
8. Add Spaces UI to web app
9. Add webhook management UI and delivery worker
10. Add rule engine to worker
11. Add historical tracking storage and diff viewer

## Open Questions

- Will Upstash Redis free tier (10,000 commands/day) be sufficient for BullMQ's polling overhead? May need to use BullMQ's `blockingConnection` mode to reduce command count.
- Should the extension be migrated to use the Supabase REST API directly, or go through Keen's API routes? API routes preferred (auth handled server-side).
