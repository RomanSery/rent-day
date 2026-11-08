# Fat cats boardgame (Rent Day)

Code for https://rentdaygame.coderdreams.com

A multiplayer Monopoly-style game. The React client talks to a backend that
runs entirely on Cloudflare's free tier: no server to keep running.

## How it is put together

| Piece | Where it runs | Notes |
| --- | --- | --- |
| React client (`src/client`, `src/core`) | Cloudflare Workers static assets | Built with Create React App into `build/` and served by the Worker with SPA fallback. |
| REST API (`worker/src/index.ts`) | Cloudflare Worker (Hono) | Same `/api/*` routes the old Express server exposed. Auth is a signed JWT in an HttpOnly cookie. |
| Game state + realtime (`worker/src/game/GameRoom.ts`) | One Durable Object per game | Holds the game, its auctions, lottos and trades in the object's storage and fans out events to the players over WebSockets (`/ws?gameId=...`). Replaces MongoDB + socket.io. |
| Accounts and lobby (`worker/migrations`) | D1 (SQLite) | `users` table and a small `games` index for the lobby list. |
| Game rules (`worker/src/game/controllers`) | inside the Durable Object | The original processors, ported from mongoose to plain objects. |

Delayed server events (the 5s chance-card reveal, the subway mugging message)
use Durable Object alarms instead of `setTimeout`.

## Local development

Requirements: Node.js 22 (the Create React App 4 toolchain is happiest there).

```bash
npm install            # also installs worker/ dependencies
cp worker/.dev.vars.example worker/.dev.vars   # then set JWT_SECRET
npm --prefix worker run db:migrate:local
npm run dev
```

`npm run dev` starts `wrangler dev` on http://localhost:8787 (API, WebSockets,
local D1 and Durable Objects) and the React dev server on
http://localhost:3000, which proxies `/api` to the Worker. The browser opens
the WebSocket directly to `ws://localhost:8787` in development.

Useful commands:

```bash
npm run typecheck:worker     # tsc over the worker + shared core code
npm run build                # production build of the React client into build/
npm --prefix worker run tail # live logs from the deployed Worker
```

With `ENVIRONMENT=development` the dev shortcuts from the old server are on:
the second player starts owning every property, and `forceDie1`/`forceDie2`
are honoured on `/api/actions/roll`.

## Deploying to Cloudflare

One-time setup (needs `npx wrangler login` first):

```bash
cd worker
npm run db:create                 # prints a database_id
# paste the database_id into worker/wrangler.jsonc
npm run db:migrate:remote
npm run secret:jwt                # paste a long random string
```

Then, from the repo root, every deploy is:

```bash
npm run deploy
```

which builds the client and runs `wrangler deploy`. The Worker serves the
client, the API and the WebSockets from a single `*.workers.dev` URL (or a
custom domain added in the Cloudflare dashboard).

### Free-plan notes

- Workers Free allows 100k requests/day and 10ms CPU per request; Durable
  Objects and D1 on the free plan have daily request caps as well. Plenty
  for a hobby game.
- Password hashing uses PBKDF2 via Web Crypto. `PBKDF2_ITERATIONS` in
  `wrangler.jsonc` can be lowered if sign-ups or logins hit the CPU limit.
- Accounts imported from the old MongoDB keep working: bcrypt hashes are
  verified with bcryptjs on login and upgraded to PBKDF2. bcrypt is slow in
  pure JavaScript, so those first logins may exceed the free CPU budget;
  asking migrated users to reset their password is the safe alternative.

### Importing the old users (optional)

Export the `users` collection from Mongo and insert the rows into D1's
`users` table (`id` is the 24-hex ObjectId, `modified_username` is the
lowercased username, `password` is the bcrypt hash). Games in progress are
not worth migrating.
