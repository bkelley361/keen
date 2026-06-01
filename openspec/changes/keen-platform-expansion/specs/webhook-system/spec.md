## ADDED Requirements

### Requirement: Users can register webhook endpoints
The system SHALL allow users to create webhook endpoints with a URL, optional description, and event type subscriptions. Each endpoint SHALL have a generated HMAC secret for payload signing.

#### Scenario: Register a webhook endpoint
- **WHEN** user submits a valid HTTPS URL for a webhook
- **THEN** a webhook record is created with a generated signing secret
- **THEN** the endpoint appears in the webhook management UI

#### Scenario: Select event subscriptions
- **WHEN** user configures a webhook endpoint
- **THEN** user can select which event types to subscribe to (e.g., website.changed, price.dropped, rss.new_item)
- **THEN** only matching events are delivered to that endpoint

#### Scenario: Test webhook endpoint
- **WHEN** user clicks "Send test" on an endpoint
- **THEN** a synthetic test payload is POST-ed to the endpoint
- **THEN** the UI shows success or failure with the HTTP response code

### Requirement: Webhook payloads are HMAC-signed
The system SHALL sign all webhook payloads using HMAC-SHA256 with the endpoint's secret. The signature SHALL be sent in the `X-Keen-Signature` header as `sha256=<hex>`. The event type SHALL be in `X-Keen-Event` and the Unix timestamp in `X-Keen-Timestamp`.

#### Scenario: Signed payload delivery
- **WHEN** a webhook event is delivered
- **THEN** the POST request includes X-Keen-Signature, X-Keen-Event, and X-Keen-Timestamp headers

#### Scenario: Signature verification
- **WHEN** a receiver computes HMAC-SHA256 of the raw body with the shared secret
- **THEN** the result matches the value in X-Keen-Signature

### Requirement: Webhook delivery includes retry with exponential backoff
Failed webhook deliveries SHALL be retried up to 3 times with delays of 30 seconds, 5 minutes, and 1 hour. Each attempt SHALL be logged in the `webhook_deliveries` table with status, response code, and timestamp.

#### Scenario: Retry on 5xx response
- **WHEN** a webhook endpoint returns a 500 response
- **THEN** the delivery is marked as failed and re-enqueued after 30 seconds

#### Scenario: Delivery marked permanently failed after max retries
- **WHEN** a delivery has been attempted 3 times and all fail
- **THEN** the delivery record status is set to 'failed'
- **THEN** no further retry attempts are made

#### Scenario: Successful delivery logged
- **WHEN** a webhook endpoint returns a 2xx response
- **THEN** the delivery record status is set to 'delivered' with the response code

### Requirement: Users can view delivery history and replay events
The webhook management UI SHALL display a delivery log per endpoint showing status, event type, timestamp, and response code. Users SHALL be able to replay any delivery.

#### Scenario: View delivery log
- **WHEN** user opens a webhook endpoint detail page
- **THEN** a paginated list of recent deliveries is shown with status badges

#### Scenario: Replay a failed delivery
- **WHEN** user clicks "Replay" on a failed delivery
- **THEN** the original payload is re-POSTed to the endpoint
- **THEN** a new delivery record is created for the replay attempt

### Requirement: Standardized event payload format
All webhook events SHALL follow a standardized JSON structure with `event`, `timestamp`, `monitorId`, `spaceId`, `source`, and `changes` fields.

#### Scenario: price.dropped event shape
- **WHEN** a price monitor detects a price decrease
- **THEN** the payload includes event="price.dropped", oldPrice, newPrice, and source.url

#### Scenario: rss.new_item event shape
- **WHEN** an RSS monitor detects a new item
- **THEN** the payload includes event="rss.new_item", item.title, and item.url
