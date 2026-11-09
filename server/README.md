# Property Tycoon backend

Strict TypeScript, Express and Socket.IO using the existing shared engine. Run `npm run dev:server` from the repository root for local development. Production: `npm run build -w server`, then `NODE_ENV=production FRONTEND_URL=https://YOUR-FRONTEND.onrender.com npm start -w server`.

The compiled entry is `server/dist/server/src/main.js`; compiled shared modules live under `server/dist/shared/src`. Production binds `0.0.0.0` and uses Render's `PORT` (local fallback 3101). `/health` returns HTTP 200. `FRONTEND_URL` is required in production; optional `CLIENT_ORIGINS` adds other allowed origins. Both polling and WebSocket transports are supported and origin-checked. Startup, connection and command failures are logged without raw session credentials.

See [DEPLOYMENT.md](../DEPLOYMENT.md) for exact Render Web Service / Static Site settings, environment variables and testing. Rooms remain in memory and are lost on restart or sleep. No database or deployment is introduced by this preparation.
