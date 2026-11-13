// Development-only usage meters, for estimating what the game costs on
// Cloudflare's plans (worker/test/usage.mjs drives them).
//
// They count the things Cloudflare bills: Worker requests, Durable Object
// requests (RPC calls, WebSocket connects and messages, alarms), D1 rows read
// and written (from D1's own result metadata), and Durable Object storage
// keys read and written (the key-value API is billed as one row per key).
//
// Nothing here runs unless ENVIRONMENT=development.

export interface D1Usage {
  queries: number;
  rowsRead: number;
  rowsWritten: number;
}

export interface WorkerUsage {
  requests: number;
  rpcCalls: number;
  d1: D1Usage;
}

export interface RoomUsage {
  wsConnects: number;
  wsMessages: number;
  alarms: number;
  keysRead: number;
  keysWritten: number;
  keysDeleted: number;
  alarmWrites: number;
  d1: D1Usage;
}

export const emptyD1 = (): D1Usage => ({ queries: 0, rowsRead: 0, rowsWritten: 0 });

export const emptyRoomUsage = (): RoomUsage => ({
  wsConnects: 0,
  wsMessages: 0,
  alarms: 0,
  keysRead: 0,
  keysWritten: 0,
  keysDeleted: 0,
  alarmWrites: 0,
  d1: emptyD1(),
});

/** Worker-side totals for this isolate (wrangler dev runs one). */
export const workerUsage: WorkerUsage = { requests: 0, rpcCalls: 0, d1: emptyD1() };

export const resetWorkerUsage = (): void => {
  workerUsage.requests = 0;
  workerUsage.rpcCalls = 0;
  workerUsage.d1 = emptyD1();
};

const addMeta = (tally: D1Usage, meta: { rows_read?: number; rows_written?: number } | undefined): void => {
  tally.queries++;
  tally.rowsRead += meta?.rows_read ?? 0;
  tally.rowsWritten += meta?.rows_written ?? 0;
};

/**
 * A D1 database that adds every query's rows read / written to `tally`.
 * first() is answered through all(), which runs the same query, because
 * first() alone does not return the metadata.
 */
export const meterD1 = (db: D1Database, tally: () => D1Usage): D1Database => {
  const raw = new WeakMap<object, D1PreparedStatement>();

  const wrap = (stmt: D1PreparedStatement): D1PreparedStatement => {
    const proxy = new Proxy(stmt, {
      get(target, prop) {
        if (prop === "bind") {
          return (...values: unknown[]) => wrap(target.bind(...values));
        }
        if (prop === "run" || prop === "all") {
          return async () => {
            const result = await target.all();
            addMeta(tally(), result.meta);
            return result;
          };
        }
        if (prop === "first") {
          return async (column?: string) => {
            const result = await target.all<Record<string, unknown>>();
            addMeta(tally(), result.meta);
            const row = result.results?.[0] ?? null;
            return column ? (row ? row[column] ?? null : null) : row;
          };
        }
        if (prop === "raw") {
          return async (options?: { columnNames?: boolean }) => {
            const result = await target.all();
            addMeta(tally(), result.meta);
            return target.raw(options as { columnNames: true });
          };
        }
        const value = Reflect.get(target, prop, target);
        return typeof value === "function" ? value.bind(target) : value;
      },
    });
    raw.set(proxy, stmt);
    return proxy;
  };

  return new Proxy(db, {
    get(target, prop) {
      if (prop === "prepare") {
        return (query: string) => wrap(target.prepare(query));
      }
      if (prop === "batch") {
        return async (statements: D1PreparedStatement[]) => {
          const results = await target.batch(statements.map((s) => raw.get(s) ?? s));
          for (const r of results) {
            addMeta(tally(), r.meta);
          }
          return results;
        };
      }
      const value = Reflect.get(target, prop, target);
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
};

/** Durable Object storage that counts keys read, written and deleted. */
export const meterStorage = (storage: DurableObjectStorage, usage: () => RoomUsage): DurableObjectStorage =>
  new Proxy(storage, {
    get(target, prop) {
      const value = Reflect.get(target, prop, target);
      if (typeof value !== "function") {
        return value;
      }
      const fn = value.bind(target);
      switch (prop) {
        case "get":
          return async (keyOrKeys: string | string[], ...rest: unknown[]) => {
            usage().keysRead += Array.isArray(keyOrKeys) ? keyOrKeys.length : 1;
            return fn(keyOrKeys, ...rest);
          };
        case "list":
          return async (...args: unknown[]) => {
            const result = (await fn(...args)) as Map<string, unknown>;
            usage().keysRead += result.size;
            return result;
          };
        case "put":
          return async (keyOrEntries: string | Record<string, unknown>, ...rest: unknown[]) => {
            usage().keysWritten += typeof keyOrEntries === "string" ? 1 : Object.keys(keyOrEntries).length;
            return fn(keyOrEntries, ...rest);
          };
        case "delete":
          return async (keyOrKeys: string | string[], ...rest: unknown[]) => {
            usage().keysDeleted += Array.isArray(keyOrKeys) ? keyOrKeys.length : 1;
            return fn(keyOrKeys, ...rest);
          };
        case "setAlarm":
        case "deleteAlarm":
          return async (...args: unknown[]) => {
            usage().alarmWrites++;
            return fn(...args);
          };
        default:
          return fn;
      }
    },
  });

/** A Durable Object stub that counts the RPC calls made through it. */
export const meterStub = <T extends object>(stub: T): T =>
  new Proxy(stub, {
    get(target, prop) {
      const value = Reflect.get(target, prop, target);
      if (typeof value !== "function") {
        return value;
      }
      return (...args: unknown[]) => {
        workerUsage.rpcCalls++;
        // call through the stub: on an RPC method, .apply would itself be
        // taken for a remote method name
        return (target as Record<string | symbol, (...a: unknown[]) => unknown>)[prop](...args);
      };
    },
  });
