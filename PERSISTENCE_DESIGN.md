# PostgreSQL save/resume proposal — approval required

Status: design only, 12 November 2026. No database dependency, service, migration,
Render configuration change, save command, or deployment has been introduced.
Phase 1–4 code remains in memory. A server restart still loses rooms. Save & Pause,
Resume Saved Game, autosave, and a saved-games list belong to the approved
persistence implementation; showing successful save controls before durable storage
exists would mislead players.

## Current architecture

`RoomManager` holds a process-local map of rooms. Each room owns the private
`GameState`, reconnect secrets, host identity, presence, duplicate-request window,
and card-presentation acknowledgments. `applyAction` executes synchronously and
atomically; Socket.IO broadcasts only the public game. `publicGame` strips decks
and deferred random input. Initial decks and roll entropy are generated on the
server; a deferred Lockup move retains the entropy needed for its continuation.
There is no recoverable global PRNG cursor. Connected flags and socket IDs are
transport state, not durable identity. Abandoned rooms currently expire after six
hours with nobody connected.

## Proposed schema (migration 001; illustrative SQL, not applied)

```sql
CREATE TABLE schema_migrations (
  version integer PRIMARY KEY,
  applied_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE players (
  id uuid PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE player_credentials (
  id uuid PRIMARY KEY,
  player_id uuid NOT NULL REFERENCES players(id),
  selector text UNIQUE NOT NULL,
  secret_hash bytea NOT NULL,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE games (
  id uuid PRIMARY KEY,
  room_code text UNIQUE NOT NULL,
  status text NOT NULL CHECK (status IN ('lobby','active','paused','finished')),
  host_seat_id text NOT NULL,
  capacity smallint NOT NULL CHECK (capacity BETWEEN 2 AND 8),
  storage_revision bigint NOT NULL DEFAULT 0,
  game_revision bigint NOT NULL DEFAULT 0,
  snapshot_schema_version integer NOT NULL,
  rules_version text NOT NULL,
  state_private jsonb NOT NULL,
  presentation_private jsonb,
  paused_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  saved_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE game_seats (
  game_id uuid NOT NULL REFERENCES games(id),
  seat_id text NOT NULL,
  player_id uuid NOT NULL REFERENCES players(id),
  name text NOT NULL,
  token text NOT NULL,
  seat_secret_hash bytea NOT NULL,
  retired_at timestamptz,
  revoked_at timestamptz,
  last_seen_at timestamptz,
  disconnected_at timestamptz,
  PRIMARY KEY (game_id, seat_id),
  UNIQUE (game_id, player_id),
  UNIQUE (game_id, token)
);
ALTER TABLE games ADD CONSTRAINT host_seat_fk
  FOREIGN KEY (id, host_seat_id) REFERENCES game_seats(game_id, seat_id)
  DEFERRABLE INITIALLY DEFERRED;
CREATE TABLE game_commands (
  game_id uuid NOT NULL REFERENCES games(id),
  seat_id text NOT NULL,
  request_id text NOT NULL,
  payload_hash bytea NOT NULL,
  storage_revision bigint NOT NULL,
  reply_private jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (game_id, seat_id, request_id)
);
CREATE TABLE game_events (
  game_id uuid NOT NULL REFERENCES games(id),
  event_id bigint NOT NULL,
  game_revision bigint NOT NULL,
  event jsonb NOT NULL,
  PRIMARY KEY (game_id, event_id)
);
CREATE INDEX returning_player_games ON game_seats(player_id, game_id)
  WHERE revoked_at IS NULL AND retired_at IS NULL;
CREATE INDEX games_by_status_saved ON games(status, saved_at DESC);
```

The full private snapshot is canonical. It preserves all balances, ownership,
mortgages, developments/Landmarks, held cards and original decks, exact deck order
and discards, turn order, detention, doubles, pending purchases, debt and payment
queues, deferred entropy, inheritance, retirement continuation, auctions including
bids and passes, and trades. Keep history in `game_events` without truncation;
retain the current log window in the snapshot. Room metadata and credential hashes
are stored separately. Validate snapshot shape, IDs, deck conservation, ownership,
phase invariants, and version before accepting a save or loading it.

Do not store `publicGame()` as a save: it cannot safely resume a game. Do not
persist socket IDs, connected=true, timers, client-submitted outcomes, or plaintext
reconnect secrets. Database access stays exclusively on the backend.

## Identity, privacy, and saved-game discovery

Continue using cryptographically random bearer credentials over HTTPS. Hash
256-bit secrets with SHA-256, compare safely, and revoke on retirement/removal.
Use a public credential selector for indexed lookup; the selector grants no access.
Never log secrets, private snapshots, or decks. Require a separate stable returning
player identity to list games; a room code or display name is not authentication.
For an initial account-free implementation, issue a random device credential in a
Secure, HttpOnly cookie where deployment origins allow it. For separate origins,
use an authenticated token flow with restricted CORS and CSRF protection as
appropriate. Store only hashes server-side. The approval should choose between
this device identity and a proper sign-in provider. Clearing browser data loses an
anonymous identity; cross-device access requires an explicit secure recovery flow.
Migrate currently issued seat credentials by hashing them; an existing authenticated
seat can link to the device identity without creating a duplicate seat.

`List Saved Games` authenticates that identity, joins only its nonrevoked seats,
and returns title/room code, last save, host label, status and your seat. Never
return other seats' credentials or private game data. `Resume Saved Game` validates
both identity and seat, then reconnects to the same authoritative game; revoked or
retired seats cannot resume. Keep Return to Menu / Forget Seat available even if a
save is missing, expired, incompatible, or the database is unavailable.

## Transaction and autosave strategy

Every accepted gameplay, retirement, host, save/pause, or card-Continue command:

1. Authenticate and validate its envelope. Begin a transaction, lock the `games`
   row with `SELECT ... FOR UPDATE`, and check `(game, seat, request_id)`. An exact
   retry returns its stored outcome; an ID with a different payload is rejected.
2. Check game revision and paused status. Run the engine once against a private
   clone. Generate random inputs only on this server. Save the resulting snapshot
   and any deferred entropy; successful retries must never draw new dice/cards.
3. Write snapshot, metadata, seat revocations/host transfer, presentation gate,
   new events, command receipt, and incremented storage revision together. Stored
   replies exclude plaintext session secrets; credential issuance uses a separate
   authenticated recovery flow. Storage
   revision advances for card acknowledgments even if engine revision does not.
4. COMMIT before changing the in-memory cache, broadcasting, or acknowledging
   success. Database failure leaves the previous state authoritative. Commands
   fail clearly; never continue with memory-only financial mutations.

A crash before commit leaves no accepted action; after commit, reconnect loads the
committed state even if no acknowledgment reached the client. After a successful
commit but failed broadcast, a storage-revision check forces clients to resync.
All important transitions autosave immediately, not on an occasional timer.
Presence writes may be coalesced, but must not extend a player's offline-removal
eligibility incorrectly. Persist acknowledged card IDs and safe playback progress;
presentation replay must never call the engine. Do not persist a `busyUntil` wall
clock as gameplay authority: restore pending cards and reconstruct a bounded
movement window, or show final state after completed cards.

PostgreSQL row locks serialize writers for the same game. Keep transactions short
and avoid awaiting player input while holding locks. Start with one backend
instance. Multiple instances later need a Socket.IO adapter plus a database outbox
or equivalent reliable broadcast mechanism; the database alone does not synchronize
process-local Socket.IO rooms.

## Save & Pause and resume behavior

Host-only Save & Pause locks the room and commits `status=paused` together with the
exact pending phase. Allow it during debt, auction, trade, or an open card without
executing or discarding that action. Broadcast saved time only after commit;
reject financial actions while paused. Players may disconnect safely afterward.
Do not confuse this explicit durable pause with a temporary required-player outage.

Any authorized seat can open its saved game to view/reconnect. Host-only Resume
Saved Game clears the explicit pause transactionally, then applies normal presence
requirements. A missing required player keeps gameplay paused. Host identity
survives temporary outages; two-minute removal and permanent-quit host transfer
remain server-controlled. On startup all sockets are disconnected. Initialize
fresh offline-duration baselines at restart (conservative: no instant removal due
to server downtime), restore private state, and allow secure resume. Never rerun
`createOnlineGame`, reshuffle decks, replay engine actions, or auto-retire a seat.
Paused saves do not expire under the in-memory six-hour room sweeper. Choose an
explicit retention policy and deletion confirmation during persistence approval.

## Versions, rollout, and recovery tests

Use numbered SQL migrations with checksums and a separate JSON snapshot schema
version plus immutable rules version. Perform ordered, tested snapshot migrations
inside transactions; reject unknown newer versions without overwriting them.
Keep backup copies before destructive migrations and favor backward-compatible
schema changes. Run migrations once in an approved pre-deploy step, not from each
Socket.IO connection. Test rollback/restore on a copy of production saves.

Test crash before/after commit and before acknowledgment, duplicate commands across
restart, exact deck/entropy restoration, debt continuations, pending auction/trade/
card/purchase, host and retired-seat recovery, wrong/revoked credentials, concurrent
writers, DB outages, pause/resume, discovery authorization and version migrations.

## Required Render configuration after approval

Create Render Postgres in the backend's region and use its internal connection URL
as backend-only `DATABASE_URL`. Use a small connection pool, statement/lock timeouts,
and graceful shutdown. Keep the frontend's existing `VITE_SERVER_URL` and backend
origin allowlist; never expose database credentials via `VITE_` variables. Keep
`numInstances: 1` and automatic deployments disabled for the first rollout.

Select a database plan and backup retention that meet the required recovery window;
verify actual restore procedures before rollout. Restrict external DB access to
approved administration paths. Add database health/readiness and migration checks,
with logs containing IDs and revisions rather than secrets or private snapshots.
No exact pricing or paid plan is assumed by this proposal.

Current in-memory rooms require an explicit maintenance/export plan before the
first persistence deployment, or a quiet period with no active games. A PostgreSQL
installation alone cannot recover rooms already lost in a restart. Proposed future
environment changes: `DATABASE_URL`, optional pool-size/timeouts and chosen identity
configuration. No change to `render.yaml` is made in this phase.

References: [PostgreSQL row locking](https://www.postgresql.org/docs/current/explicit-locking.html),
[Render database connections](https://render.com/docs/postgresql-creating-connecting),
[Render backups and recovery](https://render.com/docs/postgresql-backups).

Approval requested after review: database plan/region and backups, identity/recovery
approach, retention, and authorization to implement migrations, persistence, and
Save & Pause / Resume / saved-game discovery UI. Deployment remains a separate step.
