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

`npm run sim` (test/sim.mjs) is not a pass/fail test but a measuring tool:
it plays many bots-only games and reports win rate, average rank and final
assets per skill level, so a change to `BotBrain.ts` can be compared before
and after. Start the Worker with no bot pacing:

```bash
npx wrangler dev --var DEV_BOT_PACE_MS:0
GAMES=12 LEVELS=Normal,Normal,Easy,Easy npm run sim
```
