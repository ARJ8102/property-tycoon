# Property Tycoon

An original offline and online property-trading game built with React, strict TypeScript, Vite, and Tailwind CSS. The existing gameplay now includes a viewport-filling board, live rent labels, a cash leaderboard, fixed dice-selected turn order, modal portfolios/property details, ownership collections, detention, Landmarks, queued announcements, and event-driven animations. All board art, icons and tokens are original SVG/CSS, with original card titles and descriptions; no external images or fonts.

## Run locally

Requires Node.js 22 LTS and npm 9+.

```sh
npm install
npm run dev
```

Open the Vite URL (normally http://localhost:5173). Choose 2–4 players, enter your name, and select a token. One human plays with up to three bots: conservative Atlas, aggressive Nova, and strategic Remy. Choose Online for a private room with 2–8 human players (see below).

After creating a table, use **Roll for Turn Order** when prompted. Bots roll automatically. Only tied players reroll within their original score group; settled places never move. When all ties are resolved, review the final order and click **Start Game**. Initial rolls never move players, award cash, trigger a space, or advance normal turns.

The compact panel shows the current player, cash, two dice, Roll Dice, End Turn, a live **Players — By Cash** leaderboard, a separate **Turn Order** list, and navigation. Cash ranking puts solvent players first, sorts descending by cash, and uses original seats to break equal-cash ties. It does not use net worth or change turn rotation. Click any player row to open their portfolio with that player selected. The turn-order list stays fixed and marks the current, next, and eliminated players. Click a board property for details; Trade, Rules, Table History, and Bank remain available. Financial actions are available only to the eligible human owner; rivals' assets are read-only. An outstanding card payment can require a debtor to raise money outside their normal turn, without transferring turn ownership.

Offline games are in browser memory: refreshing or Return to Setup discards the offline table. Online rooms live in server memory and survive client refresh/reconnection while the server remains running. New Game on the result screen restarts the same setup with a fresh turn-order roll. Nothing is deployed.

## Validation

```sh
npm run typecheck
npm test
VITE_SERVER_URL=https://YOUR-BACKEND.onrender.com npm run build
npm run preview -w client
```

Engine tests include the previous gameplay regressions, collection/tint rules, split portfolio values, doubled unimproved rent, detention options, mandatory-fee liquidation, Landmarks, exact interest, atomic trading, original card payments, out-of-turn debts, complete event history, deterministic playback, live rents, cash ranking, per-property development limits, and initial order selection (including two-player, three-way, repeated, and independent ties). Existing gameplay tests start from an explicit post-confirmation fixture; turn-order integration tests use the real new-game state. Eight seeded bot simulations check state invariants after up to 3,000 decisions each.

Browser tests use the existing development-only Playwright dependency:

```sh
npx playwright install chromium
npm run test:browser
```

To reuse a browser installation:

```sh
npm run test:browser -- /absolute/path/to/chrome /tmp/tycoon-browser-screenshots
```

The optional second argument saves screenshots. `CHROMIUM_EXECUTABLE` and `BROWSER_ARTIFACT_DIR` environment variables are also supported. Tests start and stop their own Vite server at `127.0.0.1:5188`; that port must be free. Sandboxed environments may require permission to launch Chromium and bind the server.

The browser suite checks nine viewport sizes, the wider aspect ratio, all 40 aligned positions and inward strips, viewport-fitting controls, modal focus/keyboard navigation, purchases, rent and bot turns, mortgages/redemption, ownership highlights after trades, Landmarks, detention, card inventories/transfers, announcement order/dismissal, movement locks, reduced motion, liquidation, and winner controls. Crowded-tile checks cover larger pieces and owner badges alongside developments and Landmarks on desktop and mobile. They also exercise turn-order confirmation, leaderboard-selected portfolios, mortgage/development rent updates, the 1,500 ms final-dice pause, and reduced-motion bypass. Dev-only fixtures render the real `GameTable` using engine states; they are excluded from the production entry.

## Rules and financial conventions

- Determine turn order first: highest initial total takes priority; tied players reroll only inside their original tied block until every slot is unique. The human confirms Start Game. Setup rolls are separate from gameplay dice, logged at turn 0, and have no board or financial effects. Normal play begins at turn 1; the finalized sequence is preserved and bankrupt players are skipped.
- Start at Launch Plaza with $1,500; starting there grants no bonus. Roll two independent dice once per turn. Doubles grant another roll after the landing is fully resolved. Three consecutive normal doubles send the player directly to Lockup without moving the third roll normally; that forced movement earns no Launch Plaza bonus. A Lockup escape roll never earns an extra roll. Ordinary forward movement passing or landing on Launch Plaza grants $200.
- Buy or decline unowned cities, transit lines, and networks. Declining opens a bank-led auction for all solvent players, including the decliner. Only the displayed bidder may act. Bids are positive whole dollars above the current bid, up to available cash; passing removes a bidder for that auction. The highest remaining bidder pays and receives the title atomically. If nobody bids, it remains unowned.
- The 22 cities use the exact explicit purchase, development, level-rent and Landmark schedule in `shared/src/data.ts`, in their original board order. The same `calculateRent` engine drives the board, details, payments, and bot valuations. Unimproved rent doubles when the owner completes the color group. Mortgaged properties collect no rent, even in a complete group.
- Transit rent is $25/$50/$100/$200 for 1–4 lines owned. Utility rent is 4× the dice total for one network, or 10× for both. Detail and portfolio estimates use a roll of 7.
- Complete-group ownership, no mortgages in the group, and even development are required to build. After Development Level 4, a Landmark is the fifth development rank. Each property's shared data explicitly defines its development cost, Landmark cost, and Landmark rent. A Landmark replaces the four visual squares with one diamond. Build at most once on each property per turn, including Landmark construction; different properties may each receive one build. Selling or transferring a property does not clear its current-turn build flag. Flags reset when the next turn begins, so that owner can build again on their next turn. The engine and bot policies enforce this; property details explain disabled builds.
- Sell the highest development rank first, maintaining even selling. Selling a Landmark returns half its Landmark cost and restores Level 4; the four prior developments remain. Selling an ordinary development returns half its cost. A Landmark cannot be sold twice.
- Mortgage an owned property with no developments or Landmark anywhere in its city color group for 50% of its price. Redemption costs principal + 10% interest, rounded up using integer arithmetic. Mortgage principal is an encumbrance, not a recurring bill.
- Trades transfer approved cash and properties atomically. Both parties must approve; bots evaluate value, reserves, and group completion and can reject. Sell all developments in a city group before trading its cities. Mortgages transfer with ownership; no immediate fee is charged, and redemption interest remains due later.
- Lockup is neutral when merely visited. Busted sends a player directly to Lockup, without a Launch Plaza bonus. At the beginning of each detained turn choose: pay $50, use a held Get Out of Trouble card, or attempt doubles. Payment or a card releases the player for a normal roll. Doubles release and move the rolled total with no extra roll. A failed attempt ends the turn. The third failure requires $50 and moves that same roll; if funds are insufficient, liquidation and settlement happen before movement. Bankruptcy cancels the pending move.
- Original Treasure and Luck cards can award/deduct cash, move players, provide a Get Out of Trouble card, collect $10 from every active opponent (Treasure), or pay $50 to every active opponent (Luck). There are exactly 16 cards per independent shuffled deck, with stable IDs and original text. Cards draw without replacement; discard piles reshuffle when needed. Held release cards stay outside the decks and return to the bottom of their originating deck when consumed or surrendered. Online clients never receive upcoming deck order or deferred random inputs. Multi-player payments resolve in player order and pause for any unpaid obligation; each transfer occurs once. Eliminated players do not make subsequent card payments.
- Civic Tax is $200; Skyline Tax is $100. Public Gardens is neutral.
- Unaffordable payments remain outstanding without negative cash. Mortgage properties or sell developments, then Pay debt. If full liquidation cannot cover the obligation, Declare bankruptcy. Bots liquidate automatically. A debtor may also negotiate a property-for-cash sale; pending debt is restored after trade acceptance or rejection. A speculative unaccepted offer is not guaranteed funding, and bankruptcy remains available when cash plus legal liquidation is insufficient. Improvements sell for half cost on bankruptcy. A player creditor receives remaining cash, titles and held release cards, preserving mortgages. The creditor pays immediate 10% interest per inherited mortgage, rounded up; this can create a new pending debt. After paying that fee, the creditor may redeem immediately for principal or keep the mortgage and pay another 10% on later ordinary redemption. For bank debts, remaining cash goes to the bank, release cards return to their decks, mortgages clear, and each title is auctioned separately. Eliminated players cannot bid or hold up online progress. Pending fees, inheritance decisions and bankruptcy auctions finish before the last solvent player wins.
- **Net worth = cash + property purchase value + remaining development/Landmark cost − mortgage principal − outstanding obligations.** The portfolio displays property and development values separately. Mortgage principal is deducted once; interest is charged on redemption, not deducted again in advance.

## Ownership and presentation

City collection membership comes from existing shared group data. Completed city groups receive a faint tint derived from their original strip color. Each owner with at least two transit lines receives a consistent transit tint; two qualifying owners have different shades. Both utility networks receive a distinct utility tint when owned together. Partial collections do not receive completion tinting. Ownership tokens remain visible in outlined squares, alongside development/ mortgage indicators.

Desktop gameplay removes the top application header and decorative margins; branding remains on setup and subtly in the board center. The board is a slightly wider rectangle, normally 1.2:1 and 1.15:1 on narrower desktop screens, constrained by both viewport width and height. This gives top and bottom properties more horizontal room without stretching text or SVG shapes. All 40 positions, four corners, inward strips, prices, live rents, owner tokens, and development indicators remain intact.

The current-turn section uses a compact name/cash block, two side-by-side dice, and accessible Roll Dice / End Turn buttons. Routine explanatory text is omitted; detention, debt, purchase, and trade statuses retain the controls and guidance they need. The compact leaderboard, fixed turn order, Trade, Table History, Bank, and Return to Setup fit typical desktop heights. Unusually short viewports or additional debt/detention controls use independent sidebar scrolling, rather than clipping controls or scrolling the whole desktop page. Narrow screens switch layout and allow horizontal scrolling inside the board frame.

Board pieces and owner-indicator SVGs are 25% larger (11.25 px from 9 px, and 15 px from 12 px respectively). Reserved marker space and responsive two-by-two piece areas keep up to eight pieces separate from text, mortgage status, and development/Landmark indicators. Eight-piece side-cell lanes use 11 px pieces, or 10.5 px on unusually short desktops, to keep every piece inside the tile. Leaderboard and turn-order tokens stay compact.

Every live purchasable space shows purchase price and current rent through the shared `rentQuote` selector. City and transit amounts update with ownership and developments. Utilities display `Rent 4× dice` or `Rent 10× dice`; mortgaged assets show `Rent $0` and an M indicator. No UI calculation duplicates rent rules.

Structured engine events are the source for all game announcements and history. Notifications appear in event-ID order in the center, dismiss automatically after about three visible seconds, and support manual dismissal. Purchase/debt prompts remain until resolved. Dialogs pause bots and announcement timers. Bots also wait for playback and queued announcements, so events remain followable. Auction bid/pass updates appear in the auction dialog and complete history rather than filling the announcement queue. History retains the complete session with categories, actors, turn numbers, cash transfers, and asset transfers, newest first.

Dice animate briefly before revealing their engine-generated values, then remain visible for an **1,500 ms reading pause** before movement. The same playback sequence applies to humans and bots. Tokens follow the recorded path at 300 ms per space for both humans and bots; direct inspection moves use a short transition/highlight. The engine commits each validated transition atomically; during playback the UI presents the pre-roll board/balances, then reveals the landing result after arrival. No timeout creates randomness, changes balances, moves authoritative players, or determines outcomes. Gameplay actions are locked during playback. `prefers-reduced-motion` skips presentation timing and shows final positions/dice immediately; ordinary announcement reading time remains available.

## Files and architecture

- `client/src/main.tsx`, `AppHeader.tsx`: original setup and shared branding.
- `client/src/GameTable.tsx`: board-first gameplay shell, modal navigation, and presentation orchestration.
- `client/src/PlayerLeaderboard.tsx`, `TurnOrderPanel.tsx`, `TurnOrderDialog.tsx`: distinct cash ranking and fixed turn sequence, player-selected portfolios, and setup-roll confirmation.
- `client/src/Board.tsx`, `Token.tsx`, `BoardIcon.tsx`, `Dice.tsx`, `styles.css`: preserved board artwork, SVG shapes, ownership/development indicators, and lightweight motion.
- `client/src/Dashboard.tsx`, `PropertyDialog.tsx`, `BankPanel.tsx`: data-driven grouped portfolios, read-only rival assets, detailed rent schedules, and centrally validated financial controls.
- `client/src/AnnouncementCenter.tsx`, `AnnouncementText.tsx`, `useAnnouncements.ts`, `EventLog.tsx`: ordered notifications, readable semantic emphasis for names/amounts without changing event text, and full categorized history.
- `client/src/usePresentation.ts`: cancellable visual playback of shared event paths, including reduced-motion support.
- `client/src/useGame.ts`: React reducer adapter, rejected-action reporting, and delayed bot scheduling.
- `client/src/TurnControls.tsx`, `PurchaseDialog.tsx`, `TradeDialog.tsx`, `WinnerDialog.tsx`, `RulesModal.tsx`, `Modal.tsx`: phase-aware controls, persistent purchase offers, trade approval, results, updated rules, focus management, and scroll locking.
- `shared/src/types.ts`, `data.ts`, `cards.ts`, `decks.ts`, `auctions.ts`: shared types, explicit action phases, existing 40-space board, development/Landmark data, and original card effects.
- `shared/src/engine.ts`: deterministic pure transitions with central actor, phase, revision, ownership, and financial validation.
- `shared/src/finance.ts`, `groups.ts`, `players.ts`: centralized rent amounts/formulas, values, liquidation, collection counts, ownership tints, and a non-mutating cash leaderboard selector.
- `shared/src/turn-order.ts`: deterministic initial rolls, recursive tie partitions, and next-player lookup. Player seats remain stable; `turnOrder` stores the finalized ID sequence separately from cash rankings. `developedThisTurn` records build limits without relying on UI controls.
- `shared/src/events.ts`, `playback.ts`: structured ordered events, collection/rent announcements, and pure visual frame derivation.
- `shared/src/trading.ts`, `bots.ts`, `random.ts`: atomic trades, deterministic bot strategies, and cryptographic random input adapters.
- `shared/test/`, `client/test/`: regression tests, simulations, real-component fixtures, and browser checks.
- `server/src/rooms.ts`: validated lobby commands, secure room-session identities, request/revision checks, disconnect pauses, and shared-engine execution.
- `server/src/app.ts`, `main.ts`: Express health route, Socket.IO transport, private replies/public broadcasts, origin restrictions, payload/rate limits, and local process entry.
- `shared/src/online.ts`: wire command, intent, session and public room types.
- `client/src/OnlineApp.tsx`, `useOnline.ts`, `Viewer.tsx`: online setup/lobby, transport/reconnect state, tab-scoped session storage, and local-seat permissions for existing gameplay components.
- `server/test/`, `client/test/online.browser.mjs`: room/security/engine tests, actual Socket.IO transport tests, and a two-tab browser flow.

The engine never imports React or depends on animation timing. Revisions reject stale/duplicate commands. Previous state and events are preserved; presentation data derives from authoritative events. The online server generates random inputs and validates these same commands; there is no second rule implementation.

## Online local development

Install once from the root, then use two terminals:

```sh
npm install
# Terminal 1: Express / Socket.IO backend (port 3101)
npm run dev:server
# Terminal 2: Vite frontend (port 5173)
npm run dev
```

`dev:server` builds the backend and runs the compiled Node process with Node's restart watcher. After editing shared/server TypeScript, run `npm run build -w server` in another terminal to regenerate watched output. No additional TypeScript runtime loader is needed.

The Vite development proxy forwards `/socket.io` to the backend. Browsers connect to their current origin unless `VITE_SERVER_URL` is configured. The production client contains no hardcoded localhost backend URL. A future production host should proxy `/socket.io` (including WebSocket upgrade) to this server, or supply an explicit backend origin.

Configuration examples are in `client/.env.example` and `server/.env.example`. Copy into `.env` for Vite. Export server variables in the shell (or use Node 22's `--env-file=server/.env` with the compiled entry); the server does not automatically load dotenv files.

| Variable | Purpose |
| --- | --- |
| `DEV_SERVER_URL` | Vite-only development proxy target; defaults to `http://127.0.0.1:3101` |
| `VITE_SERVER_URL` | Required public backend origin for production builds; omit only for the local development proxy |
| `PORT` | Backend port, default `3101` |
| `HOST` | Development bind override; production always binds `0.0.0.0` |
| `FRONTEND_URL` | Required public frontend origin when `NODE_ENV=production`; used for Socket.IO CORS and handshake validation |
| `CLIENT_ORIGINS` | Optional additional comma-separated frontend origins; older local setups remain supported |

For a production build locally: `VITE_SERVER_URL=https://YOUR-BACKEND.onrender.com npm run build`, then start the backend with `NODE_ENV=production FRONTEND_URL=https://YOUR-FRONTEND.onrender.com npm start -w server`. Static client output is `client/dist`; backend entry is `server/dist/server/src/main.js`. `vite preview` serves static files only; use a same-origin reverse proxy or build with `VITE_SERVER_URL` and configure `FRONTEND_URL` (plus optional extra `CLIENT_ORIGINS`) for a direct connection. Nothing is deployed by these commands.

### Connection troubleshooting

The client reports **Connected** only after the backend acknowledges the Property Tycoon protocol handshake on the root Socket.IO namespace. A generic Socket.IO connection does not prove that a compatible game server is listening. Room commands use the shared `command` event and structured `{ok:true, room, session?}` / `{ok:false, error, code?}` acknowledgments; the eight-second request timeout is a failure diagnostic, not a retry that can duplicate transactions.

If create/join does not respond, check `http://127.0.0.1:3101/health`: it must include `service: "property-tycoon"`, `protocol: 2`, and `namespace: "/"`. Port 3001 was previously occupied by a different local game's Socket.IO backend; Tycoon now defaults to 3101. Do not stop unrelated applications. Start `npm run dev:server` from this repository and restart `npm run dev` so the proxy uses the matching backend. Remove or update any old `DEV_SERVER_URL` / `VITE_SERVER_URL` overrides in `client/.env`. A direct URL must target the server origin, not a different Socket.IO namespace. If overriding `PORT`, set `DEV_SERVER_URL` to that same port, or use `VITE_SERVER_URL` with a matching `CLIENT_ORIGINS` entry for direct cross-origin access.

Server command failures log request ID, command type, socket ID and error without logging raw payloads or session secrets. Synchronous and asynchronous failures return error acknowledgments; commands sent without a callback receive a `command-error` event. Startup reports occupied ports clearly. Use `npm run test:connection` (or pass a Chromium executable) to test the wrong-backend regression, asynchronous failure/retry, and browser create/join. This suite uses local ports 5192/3192 and stops its test servers afterward.

### Two-browser-tab test

1. Open the Vite URL and choose **Online**. Enter a name, choose a token, set capacity (2–8), then **Create table**.
2. Copy the invite link or room code. Open a second ordinary tab at the invite URL, enter another name, choose an unused token, and **Join table**. Each tab uses separate `sessionStorage`; no account is required. For distinct simulated devices, use separate browser profiles or a private window.
3. Mark both players **Ready**. The host clicks **Start match**. Players roll in their prompted order; ties reroll within tied blocks. The host confirms **Start Game** after the final order is shown.
4. Roll, buy/decline, end turns, open portfolios/history/Bank, and propose trades from the active player's tab. The recipient reviews and accepts/rejects the proposal in their tab. The server broadcasts the resulting state to all seats.
5. Refresh the active player's tab: it reclaims the same seat, cash, token, order and board. To test interruption, set that tab's network offline in developer tools, wait for the disconnect indicator/other tab's pause message, then restore networking. A disconnected active player, debtor or trade recipient pauses action processing until they return. No disconnected seat becomes a bot or is automatically bankrupted.
6. Lobby players can unready/change tokens/leave. The host can change capacity and remove disconnected lobby seats. If the host disconnects in the lobby, a connected player becomes host. Started-game seats are preserved.

**Multiple devices on one LAN:** run the two development servers on your computer, find its LAN IP, allow inbound TCP port 5173 in your firewall, and visit `http://<computer-LAN-IP>:5173` on both devices. Vite binds all interfaces and proxies the backend, so both devices use the same frontend URL; port 3101 need not be exposed separately. Invite links use the current browser origin. If connecting to a separate backend directly, set `VITE_SERVER_URL` to its LAN address and list the exact frontend origin in `CLIENT_ORIGINS`. Do not use localhost URLs on a different device. Clipboard access can be restricted over plain HTTP; the lobby also displays a selectable invite link.

### Online validation

```sh
npm run typecheck
npm test
npm run test:server
npm run test:browser
npm run test:online
VITE_SERVER_URL=https://YOUR-BACKEND.onrender.com npm run build
```

Both browser suites accept an existing Chromium executable as their first argument (or `CHROMIUM_EXECUTABLE`). The online suite starts and stops its own frontend/backend on `127.0.0.1:5191` / `3191`, opens two tabs, and checks lobby permissions, shared initial order, authoritative turns/dice, trade review, history/Bank, refresh, network interruption, and mobile access. The offline suite uses port 5188 and also checks eight shared-space tokens. Server tests cover rooms, host/readiness rules, action authority and validation, all financial transitions through the shared engine, replay/stale requests, terminal states, presentation locks, private session data and actual Socket.IO reconnection. Eight deterministic offline bot simulations remain included in `npm test`.

## Limitations

- Rooms and game history are held in one Node process. Server restarts lose rooms; no database, horizontal scaling, accounts or deployment is implemented. Completely disconnected rooms expire after six hours.
- The secure bearer session is stored per tab, separately from public room state. Losing/clearing that storage loses seat recovery; a new device cannot reclaim a seat without that session. Do not share session secrets. Online Return to Setup preserves an unfinished seat for resumption; finished matches release local session storage. There is no forced abandonment or reconnect timeout that bankrupts players.
- There are no online bots, spectators, lobby chat, special abilities or alternate victory conditions. All online seats are human players. Rules include doubles, auctions and both complete 16-card decks. No bank loans, player loans, rent immunity, future-payment agreements or negative cash transfers are supported.
- If anyone requires normal motion, the server locks conflicting actions for the shared dice/movement sequence. Reduced-motion clients skip visual timing; if every participant requests reduced motion, that presentation delay is skipped server-side too. Animation timers never determine dice, money or landing effects.
- Small screens scroll inside the board; short or eight-player sidebars may scroll independently. History remains in memory for the full match.
- No application deployment was performed.

## Finalized rules validation

`npm test` includes all 32 individual card effects, independent deck exhaustion/reshuffling, held-card origin/return, movement chains, fresh utility dice, double transit rent, repair bills without Landmark double-counting, doubles/Lockup, auctions, debt-funded trades, group mortgage restrictions, bankruptcy interest and individual bank auctions. Existing development constraints and seeded bot simulations remain covered. `npm run test:server` adds real Socket.IO tests for private snapshots, auctions, card/utility outcomes, liquidation trades, interest debts, and reconnecting during auctions/trades/debt/Lockup/inheritance. `npm run test:online` exercises the real shared browser table; `npm run test:connection` covers compatible-server verification and failed-request acknowledgments. The engine keeps private decks in authoritative state; `publicGame` strips them and deferred entropy before every broadcast or reconnect reply. Normal multiplayer commands reject client-supplied dice, entropy, deck order, card IDs and financial state.

## Render readiness — not deployed

See [DEPLOYMENT.md](DEPLOYMENT.md) for exact separate-service settings, required environment variables, production validation and Git commands. Both services must leave Root Directory blank to retain the root workspace and shared engine.

`render.yaml` prepares two separate services: a static frontend and a single Node/Socket.IO backend. It creates no database and has not been applied. Before any deployment, review the configuration and explicitly approve deployment.

| Service | Build | Start / publish | Required environment |
| --- | --- | --- | --- |
| Frontend static site | `npm ci --include=dev && npm run build -w client` | Publish `client/dist`; SPA fallback to `/index.html` | `VITE_SERVER_URL=https://<backend>.onrender.com` at build time |
| Node web service | `npm ci --include=dev && npm run build -w server` | `npm start -w server`; health check `/health` | `FRONTEND_URL=https://<frontend>.onrender.com`, production binding `0.0.0.0`, Node 22; use Render-provided `PORT` |

Set the actual exact origins without trailing paths; additional approved frontend origins may be comma-separated. Rebuild the static site after changing `VITE_SERVER_URL`. Do not point a separate static frontend at its own origin for Socket.IO. Use HTTPS origins; Socket.IO will use the corresponding secure transport. Query-string invitations (`?room=ABC234`) use the deployed frontend origin and survive the SPA fallback. Verify `/health` identifies `property-tycoon`, protocol 2, root namespace; then create/join from separate browser profiles and test refresh, bidding, trades and disconnection before opening play to others.

Rooms, private decks, sessions and history exist only in one server process. Do not scale beyond one instance without approved shared storage and routing work. Restarts, redeployments or sleeping the server lose active matches; a saved browser session cannot resurrect a lost room. Render can close WebSockets during instance shutdown, and Free web services can spin down after inactivity. See [Render WebSocket lifecycle](https://render.com/docs/websocket), [Free service limitations](https://render.com/docs/free), and [Blueprint configuration](https://render.com/docs/blueprint-spec). No database has been introduced. The application is prepared for a deployment review, not a persistence or availability guarantee.
