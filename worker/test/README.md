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
