# Keen — Feature Expansion & Differentiation Ideas

## Product Direction

Keen should position itself as a calm, powerful monitoring hub rather than an AI-heavy productivity tool.

Core product values:

* Unified monitoring
* Precision notifications
* Beautiful UX
* Historical visibility
* Composable workflows
* Community-driven monitoring
* Reliable infrastructure

The goal is to make Keen feel less like a utility and more like a personal intelligence system.

---


# Feature Ideas

## 1. Spaces

### Overview

Spaces are organizational containers for monitors.

Users create spaces like:

* Fantasy Books
* Tech Deals
* D&D
* Homelab
* Career
* Apartment Hunting
* Game Releases

Each space contains:

* Monitors
* Templates
* Alerts
* Notification settings
* Tags
* Dashboards
* Shared members (future)

### Why It Matters

Spaces make Keen feel like a system instead of a collection of disconnected monitors.

### Implementation Notes

Potential database structure:

* spaces
* space_members
* space_monitors
* space_notification_settings

Features:

* Drag/drop organization
* Color/icon customization
* Space-level notification preferences
* Archive spaces
* Share spaces

---

# 2. Advanced Rules & Filters

### Overview

Allow users to create powerful conditions for alerts.

Examples:

* Notify only if price < $200
* Ignore YouTube Shorts
* Only notify if title contains keywords
* Ignore specific authors/channels
* Notify only on stock status changes
* Watch specific CSS selectors on a page

### Why It Matters

Most monitoring tools either:

* do not support advanced filtering
* or make it extremely technical

This is a major retention feature for power users.

### Implementation Notes

Create a generalized rule engine.

Potential structure:

```ts
interface Rule {
  field: string
  operator: 'equals' | 'contains' | 'lt' | 'gt' | 'regex'
  value: string
}
```

Rules can be grouped with:

* AND
* OR
* NOT

Potential architecture:

* Rule parser
* Rule evaluator
* Source adapters
* Event pipeline

Important:

* Keep the UI visual and approachable
* Avoid requiring users to write code

---

# 3. Historical Tracking & Visualization

### Overview

Allow users to see how monitored content changes over time.

### Features

Website Monitoring:

* Side-by-side diffs
* Highlighted changes
* Snapshot history
* Timeline slider

Price Monitoring:

* Price graphs
* Lowest recorded price
* Volatility
* Change percentages

YouTube Monitoring:

* Upload cadence
* Missed schedules
* Frequency trends

RSS Monitoring:

* Publishing patterns
* Tag/category trends

### Why It Matters

Historical context dramatically increases usefulness.

Monitoring becomes:

* archival
* analytical
* referenceable

### Implementation Notes

Potential storage:

* snapshots table
* compressed HTML storage
* diff generation service
* object storage for historical versions

Potential optimizations:

* Store hashes first
* Only persist snapshots on change
* Use diff-friendly text normalization

---

# 4. Public Dashboards

### Overview

Allow users to publish curated monitoring dashboards.

Examples:

* Fantasy Book Releases
* Nintendo Restocks
* Tech News Feed
* React Ecosystem Updates
* MTG Price Tracker
* Steam Wishlist Deals

### Why It Matters

Benefits:

* Organic SEO
* Discoverability
* Sharing
* Community growth
* Social proof

This turns Keen into a discovery platform.

### Implementation Notes

Potential features:

* Public/private toggle
* Custom slugs
* Read-only dashboards
* Follow dashboard
* Clone dashboard
* Dashboard analytics

Potential monetization:

* Featured dashboards
* Premium dashboards
* Verified creators

---

# 5. Browser Extension

### Overview

Make monitoring creation effortless.

### Features

One-click:

* Watch page
* Watch element
* Watch price
* Watch RSS feed

Advanced:

* CSS selector picker
* Visual region selection
* Detect feeds automatically
* Quick template creation

### Why It Matters

Reducing friction increases activation rates.

The ideal experience:

1. User visits a page
2. Clicks "Watch with Keen"
3. Chooses what to monitor
4. Done

### Implementation Notes

Potential architecture:

* Extension UI
* Content scripts
* Selector extraction
* Sync via API

Helpful additions:

* Context menu integration
* Detect login-protected pages
* Cookie/session syncing

---

# 6. Notification System

### Overview

Notifications should feel calm and trustworthy.

### Features

Notification types:

* Push
* Email
* Discord
* Slack
* Webhook
* Telegram
* SMS (future)

Controls:

* Digest scheduling
* Quiet hours
* Priority levels
* Per-space notification settings
* Temporary muting

### Why It Matters

Most monitoring tools become noisy.

Keen should feel intentional.

### Implementation Notes

Potential architecture:

```text
Event -> Rule Engine -> Notification Queue -> Delivery Workers
```

Recommended components:

* Queue system
* Retry handling
* Rate limiting
* User preference layer
* Delivery logs

---

# 7. Template Ecosystem Expansion

### Overview

Templates are already one of Keen's strongest differentiators.

They should evolve into a true ecosystem.

### Features

Template metadata:

* Tags
* Categories
* Popularity
* Ratings
* Author profiles
* Clone count

Discovery:

* Featured templates
* Trending templates
* New templates
* Staff picks

Social Features:

* Follow creators
* Template collections
* Comments
* Changelogs

### Monetization Potential

Possible future systems:

* Paid templates
* Creator marketplace
* Revenue sharing
* Verified creators
* Premium template bundles

### Implementation Notes

Potential tables:

* templates
* template_versions
* template_installs
* template_collections
* template_ratings
* template_authors

Important:

* Templates should remain easy to clone and customize
* Avoid locking users into rigid systems

---

# 8. Webhook Architecture

## Overview

Webhooks are one of the most important extensibility features for Keen.

They allow users to connect Keen to:

* Discord bots
* Slack workflows
* Home automation
* Custom apps
* CI/CD pipelines
* Notion
* Zapier
* Make
* n8n
* Personal scripts

This dramatically increases the value of the platform.

---

# Webhook Event Model

Every monitor change should generate a standardized event.

Example:

```json
{
  "event": "price.changed",
  "timestamp": "2026-05-26T12:00:00Z",
  "monitorId": "abc123",
  "spaceId": "space_01",
  "source": {
    "type": "website",
    "url": "https://example.com/product"
  },
  "changes": {
    "oldPrice": 299,
    "newPrice": 249
  }
}
```

---

# Suggested Event Types

## Generic

* monitor.created
* monitor.updated
* monitor.deleted
* monitor.error

## Website

* website.changed
* website.element_changed
* website.status_changed

## Price

* price.changed
* price.dropped
* price.increased
* stock.changed
* stock.available

## RSS

* rss.new_item
* rss.keyword_match

## YouTube

* youtube.new_video
* youtube.live_started

## Templates

* template.installed
* template.updated

---

# Webhook Delivery Architecture

## Recommended Pipeline

```text
Source Poller
    ↓
Change Detection
    ↓
Event Generator
    ↓
Rule Engine
    ↓
Webhook Queue
    ↓
Delivery Workers
    ↓
Retry/Logging
```

---

# Queue Design

Use queues for reliability.

Potential technologies:

* BullMQ
* RabbitMQ
* SQS
* Redis queues

Benefits:

* Retries
* Backpressure handling
* Parallel delivery
* Failure isolation
* Rate limiting

---

# Delivery Features

## Retries

Use exponential backoff.

Example:

* Retry after 30 seconds
* Retry after 5 minutes
* Retry after 1 hour

## Signing

Support signed webhook payloads.

Example headers:

```text
X-Keen-Signature
X-Keen-Event
X-Keen-Timestamp
```

This improves security.

---

# Webhook UI Features

Users should be able to:

* Add endpoints
* Test endpoints
* Replay failed events
* View delivery logs
* Disable endpoints
* Filter event subscriptions

Potential UI:

* Endpoint list
* Delivery history
* Failure status
* Success rate
* Event inspector

---

# Developer Platform Direction

Long-term, Keen could evolve into:

> "The event infrastructure layer for internet monitoring"

Potential future additions:

* Public API
* SDKs
* OAuth apps
* App marketplace
* Custom integrations
* Community integrations

---

# Monetization Ideas

## Free Tier

* Limited monitors
* Limited history
* Basic notifications
* Public templates

## Pro Tier

* More monitors
* Faster polling
* Advanced rules
* Webhooks
* Historical tracking
* Browser extension
* More integrations

## Team Tier

* Shared spaces
* Collaboration
* Role permissions
* Shared dashboards
* Team webhooks
* Analytics

## Marketplace Revenue

Potential future monetization:

* Paid templates
* Revenue share
* Featured creators
* Sponsored dashboards

---

# Suggested Product Identity

Keen should feel like:

* calm
* reliable
* elegant
* configurable
* technical without being overwhelming

Avoid becoming:

* noisy
* AI-slop heavy
* enterprise-bloated
* overly gamified

The strongest positioning is likely:

> "A beautiful, composable monitoring hub for the modern web."

