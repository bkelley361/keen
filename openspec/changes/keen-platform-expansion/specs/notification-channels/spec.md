## ADDED Requirements

### Requirement: Users can configure multiple notification delivery channels
The system SHALL support the following notification channels: email, Discord webhook, Slack webhook, Telegram bot, and generic webhook. Users SHALL be able to configure any number of channels globally or per-Space.

#### Scenario: Configure Discord webhook globally
- **WHEN** user adds a Discord webhook URL in global notification settings
- **THEN** all monitor change notifications are delivered to that Discord channel

#### Scenario: Override notification channel at Space level
- **WHEN** user configures a different Discord webhook on a specific Space
- **THEN** monitors in that Space use the Space-level webhook, not the global one

### Requirement: Digest scheduling allows batching notifications
The system SHALL support digest mode where notifications are batched and delivered at a scheduled time (e.g., daily at 9am) instead of immediately.

#### Scenario: Daily digest delivery
- **WHEN** a user has digest mode enabled with a daily schedule
- **THEN** all changes from the past 24 hours are bundled into a single notification at the scheduled time

#### Scenario: Immediate mode bypasses digest
- **WHEN** a monitor has priority set to 'immediate'
- **THEN** its notifications are delivered without waiting for the digest window

### Requirement: Quiet hours suppress notifications during configured time windows
The system SHALL allow users to define quiet hours during which notifications are held and delivered after the window ends.

#### Scenario: Notification suppressed during quiet hours
- **WHEN** a change is detected during a user's configured quiet hours
- **THEN** the notification is queued and delivered after quiet hours end

#### Scenario: Notifications delivered at end of quiet hours
- **WHEN** quiet hours end and there are queued notifications
- **THEN** all queued notifications are delivered

### Requirement: Discord notifications include rich embed formatting
Discord webhook deliveries SHALL use Discord embed format with title, description, color (green for price drop, yellow for change, red for error), and a link to the monitor.

#### Scenario: Price drop Discord embed
- **WHEN** a price.dropped event triggers a Discord notification
- **THEN** the Discord message is an embed with green color and old/new price values

### Requirement: Slack notifications use Block Kit formatting
Slack webhook deliveries SHALL use Slack Block Kit format with a header block (monitor name), section block (change summary), and a button linking to the monitor.

#### Scenario: Webpage change Slack notification
- **WHEN** a website.changed event triggers a Slack notification
- **THEN** the Slack message uses Block Kit with monitor name and change summary

### Requirement: Notification delivery is logged
Every notification delivery attempt SHALL be logged with channel type, status, timestamp, and error details on failure. Users SHALL be able to view notification delivery history in settings.

#### Scenario: View notification delivery log
- **WHEN** user opens Notification Settings > Delivery Log
- **THEN** a paginated list of recent delivery attempts is shown with status badges

#### Scenario: Failed delivery recorded with error
- **WHEN** a Discord webhook delivery fails with a non-2xx response
- **THEN** a log entry is created with status='failed' and the HTTP response code
