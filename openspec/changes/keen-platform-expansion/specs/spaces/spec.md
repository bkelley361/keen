## ADDED Requirements

### Requirement: User can create and manage Spaces
The system SHALL allow users to create named Spaces to organize monitors and feeds. Each Space SHALL have a name, optional color, optional icon (emoji), and an archived state. A "Default" Space SHALL exist implicitly for all monitors not assigned to a Space.

#### Scenario: Create a Space
- **WHEN** user submits a valid space name
- **THEN** a new Space is created and appears in the sidebar/space list

#### Scenario: Edit a Space
- **WHEN** user updates a Space's name, color, or icon
- **THEN** the Space reflects the updated metadata

#### Scenario: Archive a Space
- **WHEN** user archives a Space
- **THEN** the Space is hidden from the primary navigation but accessible via an "Archived" filter

### Requirement: Monitors and feeds belong to a Space
The system SHALL associate every monitor and feed with exactly one Space. When a monitor or feed is created without specifying a Space, it SHALL be placed in the user's Default Space.

#### Scenario: Assign monitor to Space on creation
- **WHEN** user creates a monitor and selects a Space
- **THEN** the monitor is stored with that Space's ID

#### Scenario: Move monitor between Spaces
- **WHEN** user reassigns a monitor to a different Space
- **THEN** the monitor's space_id is updated and it appears under the new Space

#### Scenario: Default Space assignment
- **WHEN** user creates a monitor without selecting a Space
- **THEN** the monitor is assigned to the Default Space

### Requirement: Spaces have per-Space notification settings
The system SHALL allow users to configure notification preferences at the Space level. Space-level settings SHALL override global defaults for monitors within that Space.

#### Scenario: Configure Space notification channel
- **WHEN** user sets a Discord webhook on a Space
- **THEN** monitors in that Space deliver change notifications to that Discord webhook

#### Scenario: Mute a Space
- **WHEN** user mutes a Space
- **THEN** no notifications are delivered for monitors in that Space until unmuted

### Requirement: Dashboard displays monitors grouped by Space
The system SHALL render the dashboard with monitors grouped by their assigned Space. Spaces SHALL be collapsible.

#### Scenario: Space grouping on dashboard
- **WHEN** user views the dashboard
- **THEN** monitors are grouped under their Space heading

#### Scenario: Collapse a Space
- **WHEN** user collapses a Space section
- **THEN** the monitors within that Space are hidden until re-expanded
