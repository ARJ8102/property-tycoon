# Numbered multiplayer seats

Friends can enter a six-character room code, inspect the public seat list and take any unlocked Away seat. Empty seats accept new players before the match starts. Taking an Away seat keeps its player ID, number, name, token, inventory, money, titles, mortgages, pending actions and turn position. Claims run synchronously in the authoritative room manager; only one socket can win a seat.

Leave Room and Vacate Seat release control and preserve the player. Leave returns to the menu; Vacate explicitly invites a replacement. Both clear browser routing and invalidate the old control credential. A dropped connection also preserves the seat. Refresh recovery with a private session credential remains an optional convenience; another browser needs only the room code. Connected seats cannot be claimed through the public claim command. Locks block claims and session recovery until the host unlocks the seat.

Retire From Game is permanent and uses the existing engine's retirement, debt, card-return, mortgage and asset-auction rules. The legacy `remove` wire command keeps its previous timed retirement behavior for compatibility; the new UI uses separate `release` and `retire` commands.

Host authorization uses a private capability checked separately from the public host player ID. Voluntary departure, retirement, release, or a public claim of the former host's seat explicitly transfers authority to another connected non-retired member, falling back to another non-retired member. Claiming the former host's player never inherits that host capability. If no successor exists, authority is cleared; a lone departed host cannot regain management merely by claiming the seat. Start a new room in that case. Temporary transport recovery with the original private credential preserves host authority.

The host can release occupants, lock/unlock seats, retire players, end the match and close the room. End blocks gameplay and card acknowledgments and offers return to the room lobby. Close deletes the code, clears connected socket bindings and saved browser associations, and notifies everyone. Released or retired sockets immediately lose command authorization. The server never uses client-provided actor IDs.

Disconnected players pause play only when their action is required, including turn order, auctions, trade acceptance, cards and debt. Reclaiming only replaces control metadata; it never reapplies game effects or clears pending presentation.

## Validation and deployment

Run `npm test`, `npm run test:server`, `npm run typecheck`, and `VITE_SERVER_URL=https://YOUR-BACKEND.onrender.com npm run build`. Browser checks include `npm run test:seats` plus the existing game, online, connection, cards, retirement and production scripts. Pass a Chromium executable as the script's first argument if the installed Playwright browser differs from the package's expected version.

Both frontend and backend need redeployment together: the wire protocol is now version 5. No new Render environment variables or database are required. Keep the existing frontend `VITE_SERVER_URL`, backend `FRONTEND_URL`/optional `CLIENT_ORIGINS`, and single backend instance. Rooms remain in memory, expire after six hours with no connected members, and are lost on a backend restart or deployment. Deploy between matches. This change does not trigger deployment.
