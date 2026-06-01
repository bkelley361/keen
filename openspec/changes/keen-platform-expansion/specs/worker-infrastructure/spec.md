## ADDED Requirements

### Requirement: Persistent scheduler loop enqueues due monitors
The worker SHALL run a continuous scheduler loop that queries monitors whose `next_check_at` is in the past, enqueues a poll job per source entity, and updates `next_check_at` based on `frequency_seconds`. The loop SHALL sleep 30 seconds between iterations.

#### Scenario: Scheduler enqueues due monitor
- **WHEN** a monitor's `next_check_at` is <= NOW() and status is 'active'
- **THEN** a poll job is enqueued and `next_check_at` is updated to NOW() + frequency_seconds

#### Scenario: Scheduler skips inactive monitors
- **WHEN** a monitor's status is 'paused' or 'archived'
- **THEN** no poll job is enqueued for that monitor

### Requirement: Shared source polling deduplicates fetches
The system SHALL use a `source_entities` table to track canonical URLs. Multiple monitors referencing the same URL SHALL share one source entity and trigger only one network fetch per polling interval. After fetching, the worker SHALL fan out change events to all subscribed monitors.

#### Scenario: Two monitors on same URL share one fetch
- **WHEN** two monitors reference the same URL and are both due
- **THEN** exactly one HTTP request is made to that URL
- **THEN** both monitors receive the fetch result for change comparison

#### Scenario: Source entity updated after fetch
- **WHEN** a source entity is polled
- **THEN** `last_polled_at` and `last_hash` are updated on the source_entities record

### Requirement: Poll workers execute monitor checks
BullMQ workers SHALL process jobs from the `polling_queue`. Each worker SHALL fetch the source, compare the result against the previous value, generate a `monitor_event` on change, and enqueue notification jobs.

#### Scenario: Webpage change detected
- **WHEN** a poll worker fetches a webpage and the extracted value differs from `lastValue`
- **THEN** a `website.changed` event is created and stored in `monitor_events`
- **THEN** a notification job is enqueued in `notification_queue`

#### Scenario: Poll worker handles fetch error
- **WHEN** a poll worker fails to fetch a source (network error, 5xx)
- **THEN** the monitor's status is set to 'error'
- **THEN** the job is retried with exponential backoff (30s, 5m, 1h)

### Requirement: Monitor scheduling fields are stored in database
The monitors table SHALL include `frequency_seconds` (integer, default 14400), `next_check_at` (timestamp), `last_checked_at` (timestamp), and `status` (text: 'active' | 'paused' | 'error' | 'archived').

#### Scenario: Monitor frequency controls next check time
- **WHEN** a monitor with frequency_seconds=900 is checked
- **THEN** next_check_at is set to current time + 900 seconds

#### Scenario: Monitor status reflects last poll outcome
- **WHEN** a poll succeeds with no change
- **THEN** monitor status is 'active'
- **WHEN** a poll detects a change
- **THEN** monitor status is 'active' and last_checked_at is updated

### Requirement: Monitor cost classification guides scheduling priority
Each monitor SHALL have a `cost_class` field ('low' | 'medium' | 'high'). Poll jobs SHALL be enqueued with priority inversely proportional to cost_class. Low-cost monitors (RSS, YouTube RSS) SHALL have higher queue priority than high-cost monitors (Playwright).

#### Scenario: Low-cost monitor gets higher queue priority
- **WHEN** RSS and webpage monitors are both enqueued simultaneously
- **THEN** RSS monitor job has a lower priority number (higher BullMQ priority)
