# Property Tycoon: separate Render services

Repository: https://github.com/ARJ8102/property-tycoon.git — branch `main`.

No services are deployed by these files or by the build/test commands. Apply these settings in Render only when deployment is approved. The prepared `render.yaml` describes the same two-service layout.

## Verified repository structure

This repository uses npm workspaces (`client`, `shared`, `server`) and one root `package-lock.json`. Keep **Root Directory blank** for both Render services. Do not set it to `client` or `server`: the build needs the root lockfile/workspaces and sibling `shared` sources.

The backend TypeScript configuration has `rootDir: ".."` and `outDir: "dist"`, includes both server/shared sources, and preserves their relative JavaScript imports. Its compiled entry is `server/dist/server/src/main.js`; its compiled engine is under `server/dist/shared/src/`. `npm start -w server` runs that JavaScript entry without tsx, ts-node or source TypeScript.

## Backend — Render Web Service

| Render setting | Exact value |
| --- | --- |
| Repository | `https://github.com/ARJ8102/property-tycoon.git` |
| Branch | `main` |
| Service type | Web Service |
| Runtime | Node |
| Root Directory | Leave blank (repository root) |
| Build Command | `npm ci --include=dev && npm run build -w server` |
| Start Command | `npm start -w server` |
| Health Check Path | `/health` |
| Instances | `1` |
| Automatic deploys | Off until approved |

Required backend environment:

```text
NODE_VERSION=22
NODE_ENV=production
FRONTEND_URL=https://YOUR-FRONTEND.onrender.com
```

Render supplies `PORT`; do not replace it with the local port. Production always binds `0.0.0.0`. `/health` returns HTTP 200 and JSON including `ok: true`, `service: "property-tycoon"`, `protocol: 2`, and `namespace: "/"`.

`FRONTEND_URL` must be the exact public frontend origin, without a path, query, credentials or fragment. A trailing slash is normalized. Optional `CLIENT_ORIGINS` accepts additional comma-separated HTTP(S) origins (custom domains/previews or older development setups). It does not replace required `FRONTEND_URL` in production. Never set a wildcard. Both polling and WebSocket handshakes apply the same allowlist; connection/command failures are logged without room-session secrets or raw command payloads.

## Frontend — Render Static Site

| Render setting | Exact value |
| --- | --- |
| Repository | `https://github.com/ARJ8102/property-tycoon.git` |
| Branch | `main` |
| Service type | Static Site |
| Root Directory | Leave blank (repository root) |
| Build Command | `npm ci --include=dev && npm run build -w client` |
| Publish Directory | `client/dist` |
| Start Command | None — Render serves static files |
| Automatic deploys | Off until approved |

Required frontend environment, **set before the build**:

```text
NODE_VERSION=22
VITE_SERVER_URL=https://YOUR-BACKEND.onrender.com
```

`VITE_SERVER_URL` is a public browser setting, not a secret. Use the backend's HTTPS origin only: no `/api`, `/socket.io`, namespace, query or fragment. Production builds reject a missing or malformed value. Changing it requires rebuilding/redeploying the frontend. The frontend has no production localhost fallback; local development alone uses the Vite proxy. Offline gameplay remains available independently of backend reachability.

Add this Redirect/Rewrite rule (also present in `render.yaml`):

| Source | Destination | Action |
| --- | --- | --- |
| `/*` | `/index.html` | Rewrite |

Room invites are created from the browser's current frontend URL as `?room=ABC234`, so they use the public frontend origin automatically. The rewrite also covers direct/refresh navigation to frontend paths; the static service must not proxy Socket.IO to itself.

## Configure the two public addresses

1. Prepare the backend Web Service with the settings above and the planned frontend origin.
2. Use its actual public HTTPS address as the Static Site's `VITE_SERVER_URL` before building it.
3. Set backend `FRONTEND_URL` to the Static Site's actual public HTTPS origin before multiplayer testing. Include custom-domain origins in `CLIENT_ORIGINS` if needed.
4. Confirm backend `/health`, then open the **frontend** public URL in two browser profiles/tabs. Create a room, copy its invitation, join using an unused token, ready both players, and start.
5. Refresh the invitation and interrupt/reconnect one player. Verify the same seat returns, then test a roll, purchase/auction and trade. Check the backend logs for origin rejection if connecting fails.

Do not guess URL suffixes that Render may assign. Do not use a localhost URL from another device or put backend environment values into the frontend as secrets.

## Local build and validation

```sh
npm ci --include=dev
npm run typecheck
npm test
npm run test:server
npm run check:gitignore
# Use an actual public backend origin for a deployment artifact:
VITE_SERVER_URL=https://YOUR-BACKEND.onrender.com npm run build
```

The browser suites require Playwright Chromium (or pass an existing executable as the first argument):

```sh
npx playwright install chromium
npm run test:production
npm run test:browser
npm run test:online
npm run test:connection
```

`test:production` checks missing/invalid production URL rejection, inspects the generated bundle, serves actual production assets without a Vite proxy, and tests a separate backend, CORS, create/join, public invitations, refresh and offline setup. It builds with a temporary local test backend, so **rebuild with the real Render `VITE_SERVER_URL` before publishing artifacts**. The server tests also spawn the actual `npm start -w server` command with `NODE_ENV=production` and an assigned `PORT`, verify all-interface binding, HTTP 200 health and both Socket.IO transports.

For ordinary local development, no production variables are required:

```sh
# Terminal 1, repository root
npm run dev:server
# Terminal 2, repository root
npm run dev
```

For a manual local production-mode server check (localhost is intentionally used only in this local test):

```sh
FRONTEND_URL=http://localhost:4173 NODE_ENV=production PORT=3101 npm start -w server
VITE_SERVER_URL=http://localhost:3101 npm run build -w client
npm run preview -w client -- --host 0.0.0.0 --port 4173
```

Use the server and preview commands in separate terminals. Vite preview serves an existing bundle and does not provide the development proxy. Copy `client/.env.example` to `client/.env` for Vite development overrides. The server reads process environment; it does not automatically load `server/.env`. Export variables or use Node's `--env-file=server/.env` with the compiled JavaScript entry.

## Git and credentials

`.gitignore` excludes dependency folders, generated `dist`/`build` outputs, test compilation, `.env` variants, AWS local credentials and private-key files while allowing `.env.example` files. Root `package-lock.json` and all source/workspace manifests belong in Git. Never commit actual runtime room session tokens or credentials. Before any subsequent commit/push:

```sh
git status --short
git diff --check
git add .gitignore README.md DEPLOYMENT.md render.yaml package.json package-lock.json client server shared scripts
git diff --cached --check
git diff --cached --stat
git commit -m "Prepare separate Render frontend and backend deployment"
git push -u origin main
```

Do not force-push over an existing remote branch. Repository initialization and remote setup, only if working from a new copy without Git metadata:

```sh
git init -b main
git remote add origin https://github.com/ARJ8102/property-tycoon.git
```

## Operational limitations and approval boundary

Rooms, player sessions, private decks and history are in a **single process's memory**. Restarting, redeploying or sleeping the backend loses active matches. Browser reconnect credentials cannot recover a lost room. Keep one backend instance; shared storage/scaling or a database would require separate approval and work. No database is introduced here.

Deployment readiness is local validation plus a prepared configuration; it is not a claim that the services have been created or tested on Render. Actual public URLs and approved hosting choices must be set before deployment. No automatic deployment should occur as part of committing/pushing this preparation.

References: [Render monorepo roots](https://render.com/docs/monorepo-support), [Blueprint fields](https://render.com/docs/blueprint-spec), [WebSocket lifecycle](https://render.com/docs/websocket), [free-service sleeping limitations](https://render.com/docs/free).
