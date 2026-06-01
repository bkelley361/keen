## ADDED Requirements

### Requirement: Snapshots are stored on monitor change
The system SHALL store a snapshot whenever a monitor detects a change. Snapshots SHALL include the raw content (or normalized text) and a SHA-256 hash. For website monitors, the full HTML or extracted text SHALL be stored. For price monitors, the numeric price value SHALL be stored. Snapshots SHALL only be created on change, not on every poll.

#### Scenario: Snapshot created on webpage change
- **WHEN** a webpage monitor detects a changed value
- **THEN** a snapshot record is created with the new content, hash, and timestamp

#### Scenario: No snapshot on unchanged poll
- **WHEN** a monitor is polled and no change is detected
- **THEN** no new snapshot record is created

#### Scenario: Price snapshot stores numeric value
- **WHEN** a price monitor detects a price change
- **THEN** a snapshot is created with the numeric price value and timestamp

### Requirement: Users can view a change timeline per monitor
The system SHALL display a timeline/history view per monitor showing all historical snapshots in reverse chronological order with timestamps and change summaries.

#### Scenario: View change history
- **WHEN** user opens the history tab for a monitor
- **THEN** a list of past snapshots is displayed with timestamps

#### Scenario: Empty history state
- **WHEN** a monitor has never detected a change
- **THEN** the history tab shows an empty state message

### Requirement: Side-by-side diff is available for webpage monitors
For webpage monitors, the system SHALL allow users to select any two snapshots and view a side-by-side or inline diff highlighting added and removed text.

#### Scenario: Compare two snapshots
- **WHEN** user selects two snapshots and clicks "Compare"
- **THEN** a diff view is rendered showing added lines in green and removed lines in red

#### Scenario: Auto-compare latest two snapshots
- **WHEN** user opens the history tab for a webpage monitor
- **THEN** the most recent two snapshots are automatically diff'd

### Requirement: Price monitors display a price history graph
For price monitors, the system SHALL render a line graph of price over time using the stored numeric snapshots.

#### Scenario: Price graph renders historical prices
- **WHEN** user views the history tab of a price monitor with at least 2 snapshots
- **THEN** a line graph is shown with price on the Y axis and date on the X axis

#### Scenario: Price graph shows lowest recorded price
- **WHEN** a price history graph is displayed
- **THEN** the lowest recorded price is annotated on the graph

### Requirement: Historical data is retained according to plan limits
The system SHALL enforce snapshot retention limits based on the user's plan. Free users SHALL have a 30-day retention limit. Pro users SHALL have 1-year retention. Snapshots older than the retention limit SHALL be purged by a background job.

#### Scenario: Free tier retention enforced
- **WHEN** a free user's snapshot is older than 30 days
- **THEN** the snapshot is deleted by the retention cleanup job

#### Scenario: Pro tier retention enforced
- **WHEN** a pro user's snapshot is older than 1 year
- **THEN** the snapshot is deleted by the retention cleanup job
