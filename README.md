# Fluxora Backend

Express + TypeScript API for the Fluxora treasury streaming protocol. Today this repository exposes a minimal HTTP surface for stream CRUD and health checks. For Issue 44, the service now defines a concrete mapping from chain stream statuses to API-facing enums so integrators and finance reviewers do not need to reverse-engineer placeholder status strings.

## Current status

- Implemented today:
  - API info endpoint
  - health endpoint
  - in-memory stream CRUD placeholder
  - explicit chain-to-API stream status mapping
  - tested status-mapping utility used by stream responses
- Explicitly not implemented yet:
  - real chain ingestion
  - persistent stream state
  - indexer-backed checkpointing
  - duplicate-event protection
  - OpenAPI generation

## Tech stack

- Node.js 18+
- TypeScript
- Express

## Local setup

### Prerequisites

- Node.js 18+
- npm or pnpm

### Install and run

```bash
npm install
npm run dev
```

API runs at [http://localhost:3000](http://localhost:3000).

### Scripts

- `npm run dev` - run with tsx watch
- `npm run build` - compile to `dist/`
- `npm test` - build and run stream-status mapping assertions
- `npm start` - run compiled `dist/index.js`

## API overview

| Method | Path | Description |
|--------|------|-------------|
| GET | `/` | API info |
| GET | `/health` | Health check |
| GET | `/api/streams` | List streams |
| GET | `/api/streams/:id` | Get one stream |
| POST | `/api/streams` | Create stream with `sender`, `recipient`, `depositAmount`, `ratePerSecond`, `startTime`, optional `chainStatus` |

All responses are JSON. Stream data is in-memory until a durable store is added.

## Stream status mapping: chain -> API enums

### Service-level outcome

The single responsibility area for this issue is the normalization of chain-level stream state into API-facing enums. The service-level outcomes are:

- API responses must expose a stable API enum vocabulary instead of arbitrary raw chain strings
- raw chain status may still be surfaced for debugging, but the API enum is the contract consumers should code against
- terminal chain outcomes must remain unambiguous for finance and audit consumers
- unknown or invalid chain statuses must be rejected instead of silently guessed

### Supported mapping

The backend currently supports these chain statuses:

| Chain status | API status | Terminal | Notes |
|-------------|------------|----------|-------|
| `pending` | `scheduled` | No | Stream exists on chain but has not started yet |
| `active` | `active` | No | Stream is flowing normally |
| `paused` | `paused` | No | Stream is temporarily stopped |
| `completed` | `completed` | Yes | Stream ended normally |
| `cancelled` | `cancelled` | Yes | Stream ended by cancellation |
| `depleted` | `completed` | Yes | Terminal via depletion; surfaced as `statusReason: "depleted"` |

API enum vocabulary:

- `scheduled`
- `active`
- `paused`
- `completed`
- `cancelled`

### API shape

Example stream response:

```json
{
  "id": "stream-1710000000",
  "sender": "GABC...",
  "recipient": "GDEF...",
  "depositAmount": "1000",
  "ratePerSecond": "5",
  "startTime": 1710000000,
  "chainStatus": "depleted",
  "status": "completed",
  "terminal": true,
  "statusReason": "depleted"
}
```

Placeholder behavior in this repo:

- if `chainStatus` is omitted on stream creation and `startTime` is in the future, the placeholder defaults to `pending`
- if `chainStatus` is omitted and `startTime` is now or in the past, the placeholder defaults to `active`
- if `chainStatus` is provided and invalid, the API returns `400`

### Trust boundaries

| Actor | Trusted for | Not trusted for |
|-------|-------------|-----------------|
| Public internet clients | Reading the normalized API enum | Defining their own chain-status vocabulary or assuming omitted chain data is authoritative |
| Authenticated partners | Integrating against the stable API enum contract | Treating placeholder defaults as authoritative chain truth once a real indexer exists |
| Administrators / operators | Diagnosing mismatches between raw chain status and API enum | Overriding the mapping without code or documentation changes |
| Internal workers / future indexers | Supplying valid chain statuses to the mapper | Emitting unknown status strings and expecting the API to guess safely |

### Failure modes and expected client-visible behavior

| Scenario | Expected behavior |
|----------|-------------------|
| Valid known chain status | API returns the mapped enum and terminal metadata |
| Omitted chain status in placeholder create flow | API derives `pending` or `active` from `startTime` |
| Invalid chain status on create | API returns `400` with the allowed chain statuses |
| Unknown chain status from a future worker | Must be rejected until the mapping is explicitly extended |
| Dependency outage / partial chain data | Deferred in this repo version; do not invent a chain status when the source of truth is unavailable |
| Duplicate delivery / duplicate event application | Deferred; no durable indexer or dedupe path exists in this repo version |
| Terminal stream depletion | API reports `status: "completed"` plus `statusReason: "depleted"` so consumers can distinguish depletion from a normal completion |

### Operator observability and diagnosis

Operators should be able to answer the following without tribal knowledge:

- which raw chain status entered the backend
- which API status was exposed to consumers
- whether the mapped status is terminal
- whether a terminal status was a normal completion, cancellation, or depletion

Current observability in this repo:

- the stream API now returns both `chainStatus` and normalized `status`
- terminal metadata is explicit via `terminal`
- depletion is explicit via `statusReason: "depleted"`

This is sufficient for the placeholder service. Once a real chain indexer exists, the same mapping should be reused instead of inventing a second status vocabulary.

### Verification evidence

Automated assertions in `src/streams/status.test.ts` cover:

- `pending -> scheduled`
- `depleted -> completed` with `statusReason: "depleted"`
- placeholder defaulting for future and current/past start times

Validation commands:

```bash
npm test
npm run build
```

### Non-goals and follow-up work

Intentionally deferred in this issue:

- real chain ingestion
- worker / indexer integration
- durable stream persistence
- OpenAPI publication

Recommended follow-up issues:

- connect the same mapping utility to a real chain indexer
- add route-level integration tests once a reusable app/test harness exists on `main`
- document the mapping in OpenAPI once the API surface stabilizes
- classify dependency-outage behavior once real chain state exists

## Project structure

```text
src/
  routes/         # health and streams routes
  streams/        # chain-to-API status mapping
  index.ts        # Express app and server
```

## Environment

Optional:

- `PORT` - server port, default `3000`

Likely future additions:

- `DATABASE_URL`
- `REDIS_URL`
- `HORIZON_URL`
- `JWT_SECRET`

## Related repos

- `fluxora-frontend` - dashboard and recipient UI
- `fluxora-contracts` - Soroban smart contracts
