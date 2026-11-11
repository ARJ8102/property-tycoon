# Online recovery investigation and verification

## Confirmed code defects

- The eight-second timer guarded **all command acknowledgments**: create, join,
  resume, lobby changes and gameplay actions. It was not the Socket.IO connection
  timeout. Identity verification has a separate three-second timeout.
- Leaving an active game deliberately retained its session credentials. App startup
  selected online mode when those credentials existed; the connection handler then
  restored the seat. New-room submission was disabled while credentials existed.
  This combination explained the abandoned-room restoration trap.
- Pending was only React state, so same-tick submissions could overlap. Request
  callbacks/timers were not canceled on disconnect, and old callbacks could report
  errors or clear the pending flag during a newer connection/request.
- A timeout did not synchronize authoritative state. The command could already
  have committed, leaving the client uncertain about the outcome.
- Parsed sessionStorage values were trusted without shape validation.

The original production timeout itself is **not reproduced or attributed to
Render**. Normal server command handling is synchronous and its error paths
acknowledge; no missing normal-handler acknowledgment, serialization deadlock or
turn-dependent exception was found. A real browser regression deliberately commits
an action and delays the reply past eight seconds: recovery now restores the same
seat and committed state exactly once. This demonstrates the recovery fix, not the
cause of the original lost/delayed reply. Deployment logs from the incident would
be needed to establish that cause. The existing five-second heartbeat timeout may
be sensitive to mobile background suspension/network loss; it remains unchanged
because that has not been established as the incident's cause.

## Changes

- One synchronous in-flight request guard; timers cancel on completion,
  disconnect, exit and unmount. Late callbacks cannot mutate a new connection.
- Command timeout stays at eight seconds. It reconnects and securely resumes to
  obtain the latest authoritative snapshot, without retrying the command. There
  are still no automatic financial-action retries. Existing per-seat command-ID
  deduplication and revision checks remain enforced on the server across resumes.
- A failed resume displays the actual server rejection and removes the obsolete
  displayed room, retaining credentials until the user explicitly leaves/forgets.
- Explicit exit clears credentials and the room query parameter immediately,
  without waiting for a backend response. Active-match exit asks for confirmation.
  Exit is available in the status bar and in online game dialogs, including initial
  turn selection. Offline UI and gameplay rules are unchanged.
- The saved-seat view offers reconnect, start a new online game, and return to
  offline setup. Invalid stored credentials are discarded. Credentials are held
  only in sessionStorage, not localStorage; unrelated localStorage is untouched.
  Starting a new online game also resets the invitation code and join/create
  selection. Local exit still succeeds if preparing the leave request throws.
- Server logs include received command/action type, room code, processing duration,
  acknowledgment outcome and connection/disconnection reasons. No payloads, session
  secrets or credential-bearing request IDs are logged. Logger failure cannot
  prevent an acknowledgment. An asynchronous operation finishing after disconnect
  cannot leave an old socket falsely marked connected.

## Server policy preserved

Temporary disconnects retain seats and room state. Missing required actors pause
the game; other players receive updated presence. Hosts are retained in active
matches; lobby host migration remains unchanged. All-disconnected rooms expire
only after the existing six-hour retention interval. Server restarts lose rooms
because storage remains in memory. Missing rooms produce an explicit error and
clients can reconnect, discard the old seat, start a new room, or play offline.
Explicitly leaving an active game abandons its reconnect credentials; it does not
remove the seat or alter multiplayer/gameplay rules, so the remaining match may
stay paused awaiting that player.

## Redeployment and three-device verification

Both services require redeployment after the fix reaches main. Redeploy the backend
Web Service, then the frontend Static Site. No environment changes are required:

- Frontend: `https://property-tycoon-bbnu.onrender.com`
- Backend: `https://property-tycoon-server.onrender.com`
- Frontend `VITE_SERVER_URL=https://property-tycoon-server.onrender.com`
- Backend `FRONTEND_URL=https://property-tycoon-bbnu.onrender.com`

1. Open the frontend on three devices, create a capacity-three room and join from
   the other devices using different tokens. Ready all players and start.
2. Resolve initial order; play at least nine turns, including purchases and trade
   review. Verify all three boards, cash balances and turn indicators agree.
3. Briefly disable networking on the active device. Verify reconnecting status,
   paused controls and accurate disconnected presence on the other devices.
   Restore networking and verify the same seat/token/cash/position returns with
   no duplicate players or repeated transactions.
4. Refresh each browser, including the host. Verify the same seat and latest state
   return. Also test closing/reopening a tab with awareness that sessionStorage
   lifetime is browser-dependent; credentials are intentionally not account-based.
5. Exit from the active match (also test from a Bank/turn-order dialog). Confirm
   abandonment. Verify offline setup appears, refresh stays offline, and the URL
   no longer contains `room`. Start offline play; then return to setup and create
   a fresh online room without restoring the abandoned match.
6. On a disposable test match, restart the backend. Verify the explicit
   “Room expired or server restarted” error and working new-online/offline choices.
   Open an expired invitation on a fresh browser and verify a meaningful error
   plus a working return to offline setup.
7. Correlate any recurrence with Render logs: `Command received`,
   `Command acknowledgment` (ok and durationMs), `Command failed`, and
   `Socket disconnected` (reason). A command received without completion differs
   from a transport loss before receipt. Do not share sessionStorage secrets.

Automated coverage is in `server/test/recovery.test.mjs`, existing server tests,
`client/test/connection.browser.mjs`, and `client/test/online.browser.mjs`.

## Validation completed

- TypeScript checks and production builds (with the deployed backend origin).
- 120 shared-engine tests and 46 server tests.
- 22 existing gameplay browser checks, seven online browser checks, seven
  connection/recovery browser checks and four production browser checks.
- Git ignore hygiene and whitespace checks.

Browser suites used the installed Chromium executable explicitly. Tests requiring
local sockets, subprocesses or Chromium ran outside the restricted sandbox.
