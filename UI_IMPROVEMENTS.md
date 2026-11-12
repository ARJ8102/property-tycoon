# Board finish and synchronized card presentation

The eight-color display palette lives in `client/src/palette.ts`. All city tiles
use an 18% tint and a saturated inward-facing strip. Complete collections keep a
stronger tint and outline. Portfolios and property details use the same palette;
the shared board definitions, prices, assignments and rules are unchanged.
Special spaces have distinct backgrounds and stronger icons. Pieces are about
28% larger in ordinary layouts, with a white outline and an active-player glow.
Exceptionally short or crowded tiles retain compact pieces to protect labels.
Reduced motion disables the pulse and shortens presentation travel.

## Card sequence and authority

`applyAction` still executes once, atomically, using exactly the existing rules.
`presentAction` observes emitted events during that synchronous transition and
captures public checkpoints. This instrumentation does not draw random inputs,
choose a card, calculate a payment, change a movement path, or apply an outcome.
Checkpoints omit deck order, deferred entropy and historical logs.

For transitions containing a card, the UI shows dice, travel, arrival, the card,
and its consequences in order. It displays captured balances and holdings from
the relevant checkpoint, then returns to the final authoritative state. Financial
events show signed amounts near the affected player and in the announcement.
Fresh utility dice, backward paths, Launch Plaza awards, direct Lockup movement,
individual opponent transfers, repairs, held cards and debt use the recorded
events and snapshots. Chained draws get separate card popups.

An online room retains its presentation batch and acknowledged card event IDs.
Only the authenticated drawing seat may send `continue-card`, with the current
batch revision and pending event ID. Wrong players, stale IDs, early submissions
and repeated acknowledgments are rejected immediately. Continue never calls the
engine, changes game revision or repeats a financial transaction. Gameplay is
blocked until the pending cards and their movement window are complete. No socket
acknowledgment waits for a timer or human interaction.

The drawing seat remains required for presence/pausing even when the atomic
result creates debt for another player. Secure resume restores the pending card
and its checkpoint position; other clients show who must continue. A reconnect
after all cards have continued shows the latest state instead of replaying an
old card. Offline human players also click Continue; bots continue automatically.

The shared gameplay engine file, card definitions, financial calculations and
movement rules are unchanged. The shared event observer and presentation types
support the second request's room-level synchronization requirement.

## Validation

Run from the repository root:

```bash
npm test
npm run test:server
npm run test:browser
npm run test:online
npm run test:connection
npm run test:cards
npm run test:production
VITE_SERVER_URL=https://property-tycoon-server.onrender.com npm run build
```

Browser scripts accept a Chromium executable as their first argument if the
installed Playwright browser revision differs from the cached executable.
Responsive checks cover 1920×1080, 1366×768, 1024×768 and 390×844, plus smaller
viewports and four/eight occupants with ownership and development markers.
The card browser suite includes three independent browser contexts, refresh and
network interruption during a card, duplicate Continue clicks, reduced motion,
backward travel, financial effects, repairs, debt, bankruptcy and chained draws.

Completed validation: 154 engine/checkpoint tests, 50 server tests and 58 browser
checks (23 gameplay/layout, seven online, seven recovery, 17 card presentation and
four production checks), plus TypeScript checks and production builds.

Recovery audit (12 November 2026): all six requested UI/presentation features were
already present in the interrupted working tree. The remaining functional gap was
the ordinary-move landing highlight with reduced motion enabled. It now uses the
recorded destination to show a static outline, without replaying it on purchases
or other non-movement actions. A browser regression check covers this behavior.
All validation above was rerun successfully using the cached Chromium executable.

## Manual Render rollout (no automatic deployment performed)

Both the backend Web Service and frontend Static Site require redeployment for
the synchronized card protocol. Socket identity protocol is now **3**, preventing
older frontends from submitting commands to an incompatible backend. Use a quiet
period: the existing in-memory rooms do not survive a backend restart. Redeploy
the backend, then the frontend, and reload all three devices. Environment variables
and dependencies are unchanged. Pushing source is separate from requesting a
Render deployment; this repository's Blueprint disables automatic deployment.

On three devices, create/join a room, start a match and verify matching boards.
When a card is drawn, verify arrival precedes the popup, all devices see the same
card, only the drawer has Continue, and balances change as their transaction is
presented. Refresh the drawer while the card is open, then interrupt and restore
its network. Verify the same seat/card/tile returns, other players wait, and double
clicking Continue produces one outcome. Also check ordinary turns, purchases,
trades, offline play and reduced-motion settings.
