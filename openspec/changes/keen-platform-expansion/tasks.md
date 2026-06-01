## 1. Schema & Data Model (InstantDB)

- [x] 1.1 Add spaces entity to instant.schema.ts: userId, name, color, icon, archived, notificationSettings, createdAt
- [x] 1.2 Add space_id, frequency_seconds, next_check_at, last_checked_at, status, cost_class, rules fields to monitors entity
- [x] 1.3 Add space_id field to feeds entity
- [x] 1.4 Add source_entities entity: sourceType, canonicalUrl, lastPolledAt, lastHash
- [x] 1.5 Add monitor_events entity: monitorId, eventType, payload, createdAt
- [x] 1.6 Add webhook_endpoints entity: userId, url, description, secret, eventSubscriptions, enabled, createdAt
- [x] 1.7 Add webhook_deliveries entity: webhookId, eventId, status, responseCode, attemptCount, payload, createdAt, lastAttemptAt
- [x] 1.8 Add snapshots entity: monitorId, contentHash, contentText, numericValue, createdAt
- [x] 1.9 Add notification_channels entity: userId, type, config, spaceId, enabled, createdAt
- [x] 1.10 Update instant.perms.ts to allow read/write on all new entities for authenticated users

## 2. Worker App Foundation (apps/worker)

- [x] 2.1 Create apps/worker directory with package.json (Node.js, TypeScript, BullMQ, ioredis, @instantdb/admin)
- [x] 2.2 Create apps/worker/tsconfig.json
- [x] 2.3 Create apps/worker/src/index.ts entry point that starts scheduler and workers
- [x] 2.4 Create apps/worker/src/queues.ts defining polling_queue, notification_queue, webhook_queue
- [x] 2.5 Create apps/worker/src/scheduler.ts with continuous loop: query due monitors, enqueue poll jobs, update next_check_at
- [x] 2.6 Create apps/worker/src/db.ts with InstantDB admin client (mirrors src/lib/instant-admin.ts)
- [x] 2.7 Create apps/worker/Dockerfile
- [x] 2.8 Create apps/worker/fly.toml with placeholder values (credentials to be filled in later)

## 3. Monitor Logic Extraction (apps/worker)

- [x] 3.1 Copy/adapt YouTube check logic from src/app/api/cron/check/route.ts into apps/worker/src/monitors/youtube.ts
- [x] 3.2 Copy/adapt webpage scrape logic from src/lib/scraper.ts into apps/worker/src/monitors/webpage.ts (fetch-only; Puppeteer handled via API call to web app for now)
- [x] 3.3 Create apps/worker/src/monitors/rss.ts with RSS/Atom feed parsing logic extracted from cron route
- [x] 3.4 Create apps/worker/src/monitors/index.ts that dispatches to correct monitor type and returns a typed MonitorCheckResult
- [x] 3.5 Add cost_class detection helper: rss/youtube = 'low', static HTML = 'medium', puppeteer = 'high'

## 4. Shared Source Polling (apps/worker)

- [x] 4.1 Create apps/worker/src/source-tracker.ts: upsert source_entities record, return cached result if polled within interval
- [x] 4.2 Update scheduler to group monitors by canonicalUrl and enqueue one job per source entity
- [x] 4.3 Implement fan-out in poll worker: after source fetch, compare against each subscribed monitor's lastValue

## 5. Poll Worker & Event Generation (apps/worker)

- [x] 5.1 Create apps/worker/src/workers/poll-worker.ts: BullMQ worker for polling_queue that runs monitor checks
- [x] 5.2 On detected change: write monitor_event to InstantDB, update monitor lastValue/lastChecked/lastStatus
- [x] 5.3 On detected change: enqueue notification job and webhook delivery job
- [x] 5.4 On error: set monitor status to 'error', schedule retry with exponential backoff (30s, 5m, 1h)

## 6. Rule Engine (shared + worker)

- [x] 6.1 Create src/lib/rules.ts with Rule and RuleGroup TypeScript interfaces
- [x] 6.2 Implement evaluate(ruleGroup, context) function: evaluate all operators (equals, not_equals, contains, not_contains, lt, gt, lte, gte, regex)
- [x] 6.3 Support AND/OR logic between rules; support NOT on individual rules and groups
- [x] 6.4 Integrate rule evaluation in apps/worker poll worker: skip notification if rule group returns false
- [x] 6.5 Build RuleBuilder React component in src/components/rule-builder.tsx: add/remove rules, field/operator/value dropdowns, AND/OR toggle
- [x] 6.6 Add RuleBuilder to monitor edit form (src/app/monitors/edit/page.tsx)
- [x] 6.7 Persist rules JSON when saving monitor

## 7. Webhook Worker & Delivery (apps/worker)

- [x] 7.1 Create apps/worker/src/lib/signing.ts: HMAC-SHA256 sign(secret, body) and verify(secret, body, sig) utilities
- [x] 7.2 Create apps/worker/src/workers/webhook-worker.ts: BullMQ worker for webhook_queue, POST payload with signed headers
- [x] 7.3 Implement retry logic in webhook worker: exponential backoff (30s, 5m, 1h), max 3 attempts
- [x] 7.4 Write webhook_deliveries record to InstantDB after each delivery attempt
- [x] 7.5 Create API routes in src/app/api/webhooks/route.ts: GET (list) and POST (create endpoint)
- [x] 7.6 Create src/app/api/webhooks/[id]/route.ts: PATCH (update) and DELETE
- [x] 7.7 Create src/app/api/webhooks/[id]/test/route.ts: send synthetic test payload
- [x] 7.8 Create src/app/api/webhooks/[id]/replay/[deliveryId]/route.ts: re-send original payload
- [x] 7.9 Build webhook management page at src/app/webhooks/page.tsx: endpoint list, add form, test button
- [x] 7.10 Build delivery log UI in webhook detail page: paginated history, status badges, replay button

## 8. Spaces Feature (web app)

- [x] 8.1 Create API routes src/app/api/spaces/route.ts: GET (list) and POST (create)
- [x] 8.2 Create src/app/api/spaces/[id]/route.ts: PATCH (update) and DELETE/archive
- [x] 8.3 Build SpaceSidebar component src/components/space-sidebar.tsx: space list, collapse toggle, color/icon display, New Space button
- [x] 8.4 Update main dashboard (src/app/page.tsx) to group monitors and feeds by space_id, with collapsible sections
- [x] 8.5 Add space selector dropdown to monitor create form (src/app/monitors/new/page.tsx)
- [x] 8.6 Add space selector dropdown to monitor edit form (src/app/monitors/edit/page.tsx)
- [x] 8.7 Add space selector to feed create form (src/app/feeds/new/page.tsx)
- [x] 8.8 Build SpaceSettingsDialog component: rename, color picker, icon picker, archive toggle, per-space notification config

## 9. Historical Tracking (web app + worker)

- [x] 9.1 Update poll worker (step 5.2) to write snapshot record on change: contentHash, contentText (or numericValue for price monitors)
- [x] 9.2 Create API route src/app/api/monitors/[id]/history/route.ts: paginated snapshots list
- [x] 9.3 Create API route src/app/api/monitors/[id]/diff/route.ts: compute text diff between two snapshot IDs
- [x] 9.4 Add diff utility to src/lib/diff.ts using a lightweight diffing approach (character/line level)
- [x] 9.5 Build HistoryTab component src/components/history-tab.tsx: timeline list of snapshots with timestamps
- [x] 9.6 Build DiffViewer component src/components/diff-viewer.tsx: inline diff with green/red highlighting
- [x] 9.7 Build PriceGraph component src/components/price-graph.tsx using inline SVG: line graph with lowest price annotation
- [x] 9.8 Add History tab to monitor detail/card view
- [x] 9.9 Create snapshot retention cleanup job in apps/worker: daily purge of snapshots older than 30 days

## 10. Notification Channels (web app + worker)

- [x] 10.1 Create apps/worker/src/notifiers/discord.ts: format and POST Discord embed payload
- [x] 10.2 Create apps/worker/src/notifiers/slack.ts: format and POST Slack Block Kit payload
- [x] 10.3 Create apps/worker/src/notifiers/telegram.ts: send message via Telegram Bot API
- [x] 10.4 Create apps/worker/src/notifiers/email.ts: wrap existing nodemailer logic
- [x] 10.5 Create apps/worker/src/workers/notification-worker.ts: route notification jobs to correct notifier based on channel type
- [x] 10.6 Implement digest scheduling in notification worker: batch and hold notifications until scheduled delivery time
- [x] 10.7 Implement quiet hours in notification worker: hold notifications during quiet window
- [x] 10.8 Create API route src/app/api/notification-channels/route.ts: GET and POST
- [x] 10.9 Create src/app/api/notification-channels/[id]/route.ts: PATCH, DELETE, and POST /test
- [x] 10.10 Build NotificationChannelsPage at src/app/settings/notifications/page.tsx: add/edit/remove channels, test button, delivery log
