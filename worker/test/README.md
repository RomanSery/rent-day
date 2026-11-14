# API tests

End-to-end tests that drive a running Worker over HTTP and WebSockets with
real accounts and games. Start the Worker first:

```bash
npm run dev            # in worker/, serves http://localhost:8787
```

Then, in another terminal:

```bash
npm run test:api       # two-player smoke test + chance-card alarm test (~30s)
npm run test:api:deep  # three-player rules scenarios with forced dice (~4 min)
```

`BASE=http://host:port` points the tests at another server. The deep
scenarios need `ENVIRONMENT=development` (forced dice) and
`DEV_PREOWN_PROPERTIES` unset, which is the default in `.dev.vars.example`.

The tests create throwaway accounts on every run; the local D1 database in
`.wrangler/state` keeps them, which is harmless.

`npm run test:api:auth` checks the account rules: the 8-character password
minimum, "remember me" cookies, that logging out (and "log out on all
devices") revokes the session server-side, and the per-email lockout after 10
failed logins. The per-IP rate limits are off in development; to check them,
start the Worker with `npx wrangler dev --var DEV_RATE_LIMIT:true` and run
`RATE_LIMIT=1 npm run test:api:auth`.

`npm run test:api:abuse` plays the cheater: watching or chatting in games
you are not in, faking dice for everyone, rolling away an open auction,
listing one property several times in a trade, and creating games outside
the form limits (or more than 3 open lobbies). Start the Worker with
`npx wrangler dev --var DEV_LOBBY_SECONDS:4` and run
`LOBBY_EXPIRY=1 npm run test:api:abuse` to also check that unfilled lobbies
are deleted.

`npm run usage` (test/usage.mjs) is a measuring tool, not a test: scripted
players that behave like the real client play a 4-human game, a 1-human +
3-bot game and a bots-only game, and it prints what each costs in
Cloudflare billing units (Worker and Durable Object requests, D1 and Durable
Object rows read and written) for getting into a game and per turn. It reads
the development-only meters in `src/dev/usage.ts`. Start the Worker with
`npx wrangler dev --var DEV_BOT_PACE_MS:0`, keep other tests off that server,
and pick scenarios with `SCENARIOS=humans,mixed,bots TURNS=40`.

`npm run test:api:timers` covers the turn-timer flows (three timeouts
eliminate a player, a timed-out player in debt mortgages assets). It needs
the Worker started with short timers:

```bash
npx wrangler dev --var DEV_TURN_SECONDS:6 --var DEV_AUCTION_SECONDS:6
```

`npm run test:api:bots` plays a human against two computer players to the
end of a game and checks the lobby controls for bots. Start the Worker with a
fast bot pace so it finishes in under a minute:

```bash
npx wrangler dev --var DEV_BOT_PACE_MS:30
```

`npm run test:api:snapshots` plays a bots-only game to the end, checks
there is one snapshot per turn plus a final one (and prints their size),
then waits for the finished game to be deleted. Start the Worker with fast
bots and a short clean-up delay:

```bash
npx wrangler dev --var DEV_BOT_PACE_MS:0 --var DEV_PURGE_SECONDS:20
```

`npm run test:api:seeded` plays two bots-only games with the same seed and
checks they match turn by turn, and that a different seed plays differently.
Start the Worker with `--var DEV_BOT_PACE_MS:0`. In development, both
`dev/simulate` and `createGame` accept a `seed` (a number or any text) to
replay the same dice.

`npm run sim` (test/sim.mjs) is not a pass/fail test but a measuring tool:
it plays many bots-only games and reports win rate, average rank and final
assets per skill level, so a change to `BotBrain.ts` can be compared before
and after. Start the Worker with no bot pacing:

```bash
npx wrangler dev --var DEV_BOT_PACE_MS:0
GAMES=12 LEVELS=Normal,Normal,Easy,Easy npm run sim
```

`npm run test:api:rejoin` covers leaving and coming back: a player who closes
the page keeps their seat and is sent back into the game by the session
check, a reconnecting socket immediately receives the current game state
(and any open auction), and the others see "disconnected" / "re-connected".
It uses a development-only `devDropConnection` socket message to force a
server-side disconnect.

`npm run test:api:history` checks that finished games are kept in the D1
history and summed up into profiles (`/api/getProfile`): win and loss by
class, head-to-head records, the line for computer players, favourite
properties, and that a game is recorded once. Start the Worker with
`npx wrangler dev --var DEV_BOT_PACE_MS:30`.

`npm run test:api:watch` checks spectating: a signed-in user can find and
watch a public game in progress (`/ws?gameId=...&watch=1`), receives the same
events as the players, can't chat, act or read snapshots, is counted in the
"watching" number, and can't open password-protected or finished games.
`npm run test:api:contact` checks the Contact Us form and inbox: signed-out
and signed-in visitors can send, bad input is refused, the honeypot drops
bots, messages come back as plain text, and only `ADMIN_EMAILS` accounts can
list or delete them. Start the Worker with
`npx wrangler dev --var ADMIN_EMAILS:inbox-admin@t.com` (or set
`ADMIN_EMAIL=` to match your own entry).

To also check that abandoned games leave the list, start the Worker with
`npx wrangler dev --var DEV_WATCH_IDLE_SECONDS:6 --var DEV_ACTIVITY_TOUCH_SECONDS:2`
and run `WATCH_IDLE=1 npm run test:api:watch`.
