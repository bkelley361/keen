## ADDED Requirements

### Requirement: Users can define conditional alert rules on monitors
The system SHALL allow users to attach one or more rules to a monitor. Each rule SHALL specify a field, operator, and value. Rules SHALL be grouped with AND/OR logic. Notifications SHALL only be sent when the rule group evaluates to true.

#### Scenario: Price threshold rule suppresses notification
- **WHEN** a price monitor detects a change but the new price is above the user's threshold rule
- **THEN** no notification is sent

#### Scenario: Price threshold rule allows notification
- **WHEN** a price monitor detects a change and the new price satisfies price < threshold
- **THEN** a notification is sent

#### Scenario: Keyword filter on RSS items
- **WHEN** an RSS monitor receives a new item and the title does not contain the required keyword
- **THEN** no notification is sent for that item

### Requirement: Rule engine supports standard operators
Rules SHALL support the following operators: `equals`, `not_equals`, `contains`, `not_contains`, `lt` (less than), `gt` (greater than), `lte`, `gte`, `regex`, `matches_regex`.

#### Scenario: Regex operator matches title
- **WHEN** a rule uses operator=regex and value="\\bpython\\b"
- **THEN** the rule evaluates to true only when the field value matches the regex

#### Scenario: lt operator on numeric field
- **WHEN** a rule uses operator=lt and value="200" on the price field
- **THEN** the rule evaluates to true only when price < 200

### Requirement: Rules are composed with AND/OR/NOT logic
The system SHALL support grouping rules with AND (all must pass) and OR (any must pass). Individual rules or groups SHALL be negatable with NOT.

#### Scenario: AND group requires all rules to pass
- **WHEN** a rule group uses AND logic and one rule fails
- **THEN** the group evaluates to false and the notification is suppressed

#### Scenario: OR group requires at least one rule to pass
- **WHEN** a rule group uses OR logic and at least one rule passes
- **THEN** the group evaluates to true and the notification is allowed

### Requirement: Rule builder UI is visual and code-free
The system SHALL provide a visual rule builder UI where users can add, remove, and configure rules using dropdowns and inputs — no code required.

#### Scenario: Add a rule via UI
- **WHEN** user clicks "Add Rule" in the monitor settings
- **THEN** a new row appears with dropdowns for field, operator, and a value input

#### Scenario: Rules are saved with the monitor
- **WHEN** user saves the monitor after configuring rules
- **THEN** rules are persisted and applied on the next check

### Requirement: Rules are stored as structured JSON
The system SHALL store rules as a JSON array in the `monitors` table. Each rule object SHALL contain `field`, `operator`, `value`, and an optional `not` boolean. Rule groups SHALL be represented as nested arrays with a `logic` field.

#### Scenario: Rule JSON structure
- **WHEN** a rule is saved
- **THEN** the stored JSON conforms to the Rule interface: { field, operator, value, not? }

#### Scenario: Group JSON structure
- **WHEN** a rule group is saved
- **THEN** the stored JSON conforms to: { logic: 'AND' | 'OR', rules: Rule[], not?: boolean }
