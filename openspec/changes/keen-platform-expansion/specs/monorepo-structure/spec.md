## ADDED Requirements

### Requirement: Codebase is organized as a pnpm monorepo with Turborepo
The repository SHALL be restructured as a pnpm workspace monorepo with Turborepo for task orchestration. The root `package.json` SHALL define workspaces for `apps/*` and `packages/*`.

#### Scenario: Monorepo builds from root
- **WHEN** `pnpm turbo build` is run from the repo root
- **THEN** all apps and packages are built in dependency order

#### Scenario: Type checking runs across all packages
- **WHEN** `pnpm turbo typecheck` is run
- **THEN** TypeScript is checked in all packages and apps

### Requirement: Web app lives at apps/web
The Next.js frontend SHALL be located at `apps/web`. It SHALL contain all pages, API routes, components, and web-specific configuration. It SHALL import from shared packages via workspace references.

#### Scenario: Web app imports from packages/types
- **WHEN** a component in apps/web imports from @keen/types
- **THEN** the import resolves to packages/types via pnpm workspace linking

### Requirement: Worker app lives at apps/worker
The persistent background worker SHALL be located at `apps/worker`. It SHALL be a standalone Node.js TypeScript application (not Next.js) responsible for the scheduler loop, BullMQ workers, polling, and notification delivery.

#### Scenario: Worker starts scheduler loop
- **WHEN** `node dist/index.js` is run in apps/worker
- **THEN** the scheduler loop begins and processes due monitors

#### Scenario: Worker is deployed independently
- **WHEN** apps/worker is deployed to Fly.io
- **THEN** it operates independently of the Vercel web app deployment

### Requirement: Shared packages are importable by both apps
The following packages SHALL exist under `packages/` and be usable by both `apps/web` and `apps/worker`:
- `packages/db`: Supabase client, schema, migrations, query helpers
- `packages/monitoring`: RSS, YouTube, and website monitor logic, diffing, event generation
- `packages/shared`: Constants, utilities, validation
- `packages/types`: Shared TypeScript interfaces for monitors, events, webhooks, rules

#### Scenario: packages/db is used by worker for monitor queries
- **WHEN** apps/worker needs to query due monitors
- **THEN** it imports the query function from @keen/db

#### Scenario: packages/monitoring is used by worker for check logic
- **WHEN** apps/worker processes a poll job
- **THEN** it imports the monitor-type-specific check function from @keen/monitoring

### Requirement: Database client migrates from InstantDB to Supabase
The system SHALL replace the InstantDB client with a Supabase PostgreSQL client in `packages/db`. A one-time migration script SHALL export existing InstantDB data and seed it into Supabase.

#### Scenario: Migration script exports all monitors
- **WHEN** the migration script runs
- **THEN** all monitor records from InstantDB are exported and inserted into Supabase monitors table

#### Scenario: Web app uses Supabase for all reads and writes
- **WHEN** a user creates a monitor in the web app
- **THEN** the record is written to Supabase, not InstantDB
