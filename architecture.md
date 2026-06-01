# Keen — Zero-Cost Infrastructure Migration Plan

## Goals

This migration plan is designed around the following constraints:

* Keep infrastructure costs at $0 initially
* Avoid major rewrites later
* Support future scaling
* Maintain Next.js as the primary framework
* Introduce persistent workers for monitoring
* Remove dependency on cron-job.org
* Allow future upgrade paths without migrating architecture

The key architectural decision:

```text
Frontend/API != Worker Infrastructure
```

This separation should happen immediately, even while operating on free tiers.

---

# Recommended Stack

## Frontend & API

Platform:

* Vercel (free tier initially)

Responsibilities:

* Next.js frontend
* API routes
* authentication
* billing
* dashboard UI
* templates
* monitor management
* webhook management UI

---

## Worker Infrastructure

Platform:

* Fly.io

Responsibilities:

* polling
* scheduling
* queue processing
* notifications
* webhook delivery
* retries
* scraping
* diff generation

Fly.io is used because:

* persistent processes are supported
* Docker support is excellent
* can scale vertically later
* migration path is smooth
* free allowances are usable for small workloads

---

## Database

Platform:

* Supabase PostgreSQL

Responsibilities:

* monitor storage
* users
* templates
* event history
* webhook logs
* notification settings
* spaces

---

## Queue & Redis

Platform:

* Upstash Redis

Responsibilities:

* job queues
* delayed jobs
* retries
* rate limiting
* worker coordination
* temporary caching

---

# High-Level Architecture

```text
Users
  ↓
Vercel / Next.js
  ↓
Supabase Postgres
  ↓
Fly.io Worker
  ↓
Redis Queue
  ↓
Polling / Monitoring
  ↓
Events
  ↓
Notifications / Webhooks
```

---

# Core Architectural Shift

## Current Architecture

```text
cron-job.org
    ↓
Vercel API Route
    ↓
Check Everything
```

Problems:

* not scalable
* limited scheduling flexibility
* expensive on serverless
* inefficient polling
* difficult to prioritize
* difficult to retry

---

## Target Architecture

```text
Persistent Scheduler
    ↓
Find Due Monitors
    ↓
Queue Jobs
    ↓
Workers Process Jobs
    ↓
Generate Events
    ↓
Deliver Notifications
```

Benefits:

* arbitrary polling intervals
* batching
* prioritization
* retries
* concurrency control
* scalability
* lower cost

---

# Monorepo Structure

Recommended structure:

```text
apps/
  web/
  worker/

packages/
  db/
  monitoring/
  shared/
  types/
```

---

# apps/web

Contains:

* Next.js frontend
* API routes
* auth
* dashboard
* monitor management
* templates
* billing

---

# apps/worker

Contains:

* scheduler loop
* queue workers
* polling services
* webhook delivery
* retry system
* notification dispatch

---

# packages/db

Contains:

* database client
* schemas
* migrations
* queries
* repository functions

---

# packages/monitoring

Contains:

* RSS monitor logic
* YouTube monitor logic
* website monitor logic
* diffing
* normalization
* event generation

---

# packages/shared

Contains:

* constants
* utility functions
* validation
* shared config

---

# packages/types

Contains:

* shared TypeScript types
* event interfaces
* monitor types
* webhook payload types

---

# Database Changes

## monitors table

Add:

```sql
ALTER TABLE monitors
ADD COLUMN frequency_seconds INTEGER NOT NULL DEFAULT 14400,
ADD COLUMN next_check_at TIMESTAMP,
ADD COLUMN last_checked_at TIMESTAMP,
ADD COLUMN status TEXT DEFAULT 'active';
```

---

# Suggested Monitor Fields

```text
id
user_id
source_type
source_url
frequency_seconds
next_check_at
last_checked_at
status
created_at
updated_at
```

---

# Event Table

```text
monitor_events
--------------
id
monitor_id
event_type
payload
created_at
```

---

# Webhook Deliveries Table

```text
webhook_deliveries
------------------
id
webhook_id
event_id
status
response_code
attempt_count
created_at
last_attempt_at
```

---

# Shared Polling Optimization

This is one of the most important scalability optimizations.

## Problem

100 users monitoring the same RSS feed should NOT trigger 100 fetches.

---

## Solution

Introduce canonical sources.

### source_entities table

```text
id
source_type
canonical_url
last_polled_at
last_hash
last_result
```

---

## User Monitors Reference Sources

```text
monitor_sources
---------------
monitor_id
source_entity_id
```

---

# Benefits

Instead of:

```text
100 users → 100 requests
```

You get:

```text
100 users → 1 request
```

Then fan out events to subscribers.

This massively reduces:

* bandwidth
* CPU usage
* polling cost
* rate limiting risk

---

# Queue Architecture

## Recommended Library

BullMQ

Reason:

* battle-tested
* Redis-based
* excellent TypeScript support
* delayed jobs
* retries
* priorities
* rate limiting

---

# Queue Structure

Suggested queues:

```text
polling_queue
notification_queue
webhook_queue
retry_queue
```

---

# Polling Job Example

```ts
interface PollJob {
  monitorId: string
  sourceType: 'rss' | 'youtube' | 'website'
}
```

---

# Scheduler Architecture

## IMPORTANT

Do NOT use:

* cron-job.org
* one cron per user
* one cron per monitor

Use a centralized scheduler.

---

# Scheduler Loop

Runs continuously.

Pseudo-flow:

```text
while (true)
  query due monitors
  enqueue jobs
  update next_check_at
  sleep 30 seconds
```

---

# Scheduler Query

Example:

```sql
SELECT *
FROM monitors
WHERE next_check_at <= NOW()
AND status = 'active'
LIMIT 500;
```

---

# Worker Processing Flow

```text
Scheduler
  ↓
Polling Queue
  ↓
Worker
  ↓
Fetch Source
  ↓
Compare Result
  ↓
Generate Event
  ↓
Store Event
  ↓
Queue Notifications
```

---

# Notification Architecture

## Delivery Types

Support:

* email
* Discord
* Slack
* webhook
* push notifications
* Telegram

---

# Notification Pipeline

```text
Event
  ↓
Rule Engine
  ↓
Notification Queue
  ↓
Delivery Worker
```

---

# Retry System

Use exponential backoff.

Example:

* 30 seconds
* 5 minutes
* 1 hour

Store:

* attempt count
* last failure
* response code

---

# Webhook Architecture

## Webhook Event Example

```json
{
  "event": "rss.new_item",
  "timestamp": "2026-05-26T12:00:00Z",
  "monitorId": "abc123",
  "payload": {
    "title": "New Article",
    "url": "https://example.com/article"
  }
}
```

---

# Recommended Headers

```text
X-Keen-Signature
X-Keen-Event
X-Keen-Timestamp
```

---

# Security Recommendations

## Webhook Signing

Use HMAC signatures.

This allows users to verify payload authenticity.

---

# Rate Limiting

Recommended:

* per-user rate limits
* per-source limits
* queue concurrency limits

---

# Monitoring Cost Classification

Not all monitors cost the same.

## Cheap

* RSS feeds
* public APIs
* YouTube feeds

## Medium

* static HTML parsing

## Expensive

* Playwright
* authenticated scraping
* JS-heavy sites

---

# Add Internal Cost Metadata

Example:

```text
cost_class:
- low
- medium
- high
```

This can later influence:

* polling frequency
* plan limits
* scheduling priority

---

# Free Tier Strategy

## Free Users

Suggested limits:

* 4 hour minimum polling
* limited monitors
* limited history
* basic notifications

---

# Pro Users

Suggested upgrades:

* 15 minute polling
* webhook support
* advanced rules
* faster notifications
* more history
* more monitors

---

# Future Scaling Strategy

## Important Principle

Do not build temporary architecture.

The free-tier architecture should already support:

* horizontal scaling
* queues
* workers
* retries
* event systems

Only resource allocation should change later.

---

# Deployment Steps

# Step 1 — Create Monorepo Structure

Actions:

* split worker from web app
* move shared logic into packages
* centralize shared types

---

# Step 2 — Create Worker App

Worker responsibilities:

* scheduler loop
* queue processing
* monitor execution
* notification delivery

Deploy worker separately.

---

# Step 3 — Set Up Redis

Use:

* Upstash Redis free tier

Create:

* queue connection
* BullMQ setup
* retry handling

---

# Step 4 — Introduce Queue System

Replace:

```text
API route directly executes monitoring
```

With:

```text
API route enqueues work
```

---

# Step 5 — Add next_check_at Scheduling

Implement:

* polling frequencies
* scheduler loop
* due monitor queries

---

# Step 6 — Remove cron-job.org

Once scheduler is stable:

* disable external cron
* move entirely to worker loop

---

# Step 7 — Add Shared Source Polling

Implement:

* canonical source tracking
* deduplicated polling
* subscriber fan-out

This should happen early.

---

# Step 8 — Add Webhook Delivery System

Implement:

* webhook endpoints
* signing
* retries
* delivery logs
* replay support

---

# Step 9 — Add Monitoring & Logging

Track:

* failed jobs
* queue sizes
* average poll duration
* retry counts
* source failures

---

# Recommended Logging

Track:

```text
job_id
monitor_id
duration
status
retry_count
error
```

---

# Recommended Future Improvements

## Adaptive Polling

If a source rarely changes:

* reduce polling frequency automatically

---

# Dynamic Prioritization

Higher plans:

* higher queue priority
* lower latency

---

# Browser Automation Isolation

If Playwright is added later:

* isolate into dedicated workers
* do NOT run alongside lightweight polling

---

# Long-Term Direction

Keen should evolve toward:

```text
Monitoring Platform
    ↓
Event Infrastructure
    ↓
Automation Ecosystem
```

The architecture above supports that transition without requiring future rewrites.

---

# Final Recommendation

## Use This Stack Initially

| Piece        | Platform      |
| ------------ | ------------- |
| Frontend/API | Vercel        |
| Workers      | Fly.io        |
| Database     | Supabase      |
| Queue        | Upstash Redis |

---

# Future Upgrade Path

When revenue arrives:

## Upgrade Order

1. Fly.io resources
2. Upstash limits
3. Supabase plan
4. Dedicated Playwright workers
5. Potential migration to self-hosted infrastructure

No architectural migration should be required.

