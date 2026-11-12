# Recovery, host management and retirement

## Launch Plaza audit

The current engine already pays for each separate forward movement. A roll from
space 38 to Luck at 7 earns $200; Luck's Fresh start then moves forward to Launch
Plaza for another $200. Final cash is $1,900 from $1,500. No engine rule change was
needed. New engine and server regressions verify the two payments, backward travel,
direct Lockup movement, stale/duplicate requests, Continue, animation consumption,
and secure reconnect. Backward travel from Luck at 7 also lands on Civic Tax and
correctly pays its $200 tax; that tax must not be mistaken for a missing bonus.

## Presence and recovery

Disconnecting never calls bankruptcy or retirement. Members keep the same secure
credentials and complete authoritative game state. The room waits only for a seat
whose action is required (turn-order roller, ordinary player, debtor, bidder,
inheritor, trade participant, pending-card drawer, or confirming host).
Other players can proceed until that requirement is reached.

Players & Host is available from the online status bar and inside game dialogs.
It shows the host, Online/Offline/Retired status, and elapsed offline time derived
from a server-provided duration. Temporary host outages preserve host identity,
including in the lobby. Rejoin Previous Game and existing recovery/forget-seat
controls remain available. During an active game, connected Exit to menu confirms permanent retirement and
uses the same acknowledged quit command. Disconnected menu navigation preserves
the credential and exposes Rejoin Previous Game from setup. Failed or unknown
retirement outcomes also retain credentials for authoritative recovery. Lobby and
finished-game exits retain the existing best-effort local cleanup behavior.

## Host removal

Only the authenticated host can remove a currently disconnected, nonretired seat
after at least 120,000 continuous offline milliseconds. A reconnect resets its timer
and immediately invalidates an old removal request. The client shows a timer and
asks for confirmation; the server rechecks current presence, duration and host
permissions. Active-game removal uses exactly the same retirement transition as
voluntary quit. Lobby removal revokes/removes the seat without a game transition.

## Retirement

Quit Game requires confirmation and an acknowledged server command before clearing
the local session. Permanent retirement marks the player eliminated and retired,
removes them from turn order, and revokes their reconnect credential. Host authority
transfers to a connected, nonretired member, or the next nonretired member if none
are connected. Old sockets and old credentials cannot operate a retired seat.
The departing connection is free to create/join another table.

Without debt, all cash returns to the bank, held release cards return to their
original decks, and titles return undeveloped and unmortgaged. The existing auction
engine auctions each title individually, excluding eliminated players. Pending
unrelated debts resolve before these auctions. Interrupted roll/purchase/detention
phases resume afterward. A retiring bidder cancels their bid commitment; the same
property reopens with all remaining eligible players and no money charged. A trade
involving the retiring player is cancelled. Queued obligations owed to a retiring
creditor remain payable to the bank.

With a pending debt (including a liquidation trade), the existing bankruptcy
transfer path applies: the actual creditor receives cash, titles and release cards;
development liquidation and mortgage inheritance fees remain unchanged. Retirement
is an explicit permanent forfeiture even when the player could otherwise afford
to continue; ordinary BANKRUPT retains its existing insolvency requirement. If only
one solvent player remains after retirement, that player wins immediately.

Atomic card outcomes are never re-executed. Retirement clears obsolete card gates
and movement windows so remaining players cannot become stuck waiting for a
revoked seat. The latest authoritative result becomes visible on all clients.

## Validation and rollout

Recovery validation completed on 12 November 2026: TypeScript checks, all 170
shared-engine tests, all 57 server tests, and all six browser suites (game, online,
connection, cards, retirement, production) passed. The production build passed
with `VITE_SERVER_URL=https://property-tycoon-server.onrender.com`. Browser suites
used the installed Chromium 1248 via `CHROMIUM_EXECUTABLE`; the default browser
revision was unavailable. Local transport/browser tests required execution outside
the sandbox because its localhost binding restriction returns `EPERM`.
The recovery document's trailing NUL-byte corruption was removed; its original
bytes were preserved in `/tmp/property-tycoon-recovery-doc-before-repair.md`.

Run `npm run typecheck`, `npm test`, `npm run test:server`, `npm run test:browser`,
`npm run test:online`, `npm run test:connection`, `npm run test:cards`,
`npm run test:retirement`, `npm run test:production`, and a production `npm run build`
with the deployment's VITE_SERVER_URL. Browser suites support CHROMIUM_EXECUTABLE.
The retirement browser suite uses three independent browser contexts and a server
clock to exercise the two-minute threshold without sleeping two minutes.

Protocol is now 4. Backend and frontend must be updated together during a manually
approved rollout; older clients reject incompatible server identity. No deployment
or database provisioning is performed. Rooms are still in memory until the design
in [PERSISTENCE_DESIGN.md](PERSISTENCE_DESIGN.md) is approved and implemented.
