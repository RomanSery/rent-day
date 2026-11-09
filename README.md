# Fat cats boardgame (Rent Day)

Code for https://rentdaygame.coderdreams.com

A multiplayer Monopoly-style game. The React client talks to a backend that
runs entirely on Cloudflare's free tier: no server to keep running.

## How it is put together

| Piece | Where it runs | Notes |
| --- | --- | --- |
| React client (`src/client`, `src/core`) | Cloudflare Workers static assets | React 19 + MUI, built with Vite into `build/` and served by the Worker with SPA fallback. |
| REST API (`worker/src/index.ts`) | Cloudflare Worker (Hono) | Same `/api/*` routes the old Express server exposed. Auth is a signed JWT in an HttpOnly cookie. |
| Game state + realtime (`worker/src/game/GameRoom.ts`) | One Durable Object per game | Holds the game, its auctions, lottos and trades in the object's storage and fans out events to the players over WebSockets (`/ws?gameId=...`). Replaces MongoDB + socket.io. |
| Accounts and lobby (`worker/migrations`) | D1 (SQLite) | `users` table and a small `games` index for the lobby list. |
| Game rules (`worker/src/game/controllers`) | inside the Durable Object | The original processors, ported from mongoose to plain objects. |

Delayed server events (the 5s chance-card reveal, the subway mugging message)
use Durable Object alarms instead of `setTimeout`.

### Computer players

A game can include computer players: choose how many when creating a game,
or let the game's creator add them from the lobby. Bots are ordinary entries
in the game's player list flagged `isBot`; the game's Durable Object drives
their turns through its alarm (`worker/src/game/bots`), reusing the same
rule processors as human actions and broadcasting the same dice and state
events, so clients need nothing special to watch them play. Two levels exist:
Easy bids low and never builds, Normal values properties by rent and group
completion, builds houses evenly, answers trades and spends skill points.
When the last human leaves or goes bankrupt the game ends and the remaining
bots are ranked by assets.

## Local development

Requirements: Node.js 20 or newer (tested with 22).

```bash
npm install            # also installs worker/ dependencies
cp worker/.dev.vars.example worker/.dev.vars   # then set JWT_SECRET
npm --prefix worker run db:migrate:local
npm run dev
```

`npm run dev` starts `wrangler dev` on http://localhost:8787 (API, WebSockets,
local D1 and Durable Objects) and the Vite dev server on
http://localhost:3000, which proxies both `/api` and the `/ws` WebSocket to
the Worker (see `vite.config.ts`).

Useful commands:

```bash
npm run typecheck            # tsc over the client
npm run typecheck:worker     # tsc over the worker + shared core code
npm run build                # typecheck + Vite production build into build/
npm run preview              # serve the production build locally
npm --prefix worker run tail # live logs from the deployed Worker
```

End-to-end API tests live in `worker/test` (see its README): `npm run test:api`
and `npm run test:api:deep` from `worker/` against a running `wrangler dev`.

With `ENVIRONMENT=development`, `forceDie1`/`forceDie2` are honoured on
`/api/actions/roll`. Setting `DEV_PREOWN_PROPERTIES=true` as well turns on the
old server's shortcut where the second player starts owning every property.

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
