import { tableFromIPC } from "apache-arrow";
import perspectiveClient from "@perspective-dev/client";
import { DuckDBHandler } from "@perspective-dev/client/dist/esm/virtual_servers/duckdb.js";
import "@perspective-dev/viewer";
import "@perspective-dev/viewer-datagrid";
import { PerspectiveMosaicClient } from "./perspectiveMosaicClient.js";

/**
 * Creates a `fetchFromTrino` function bound to the current session credentials.
 *
 * `logQueryStatus` is called with the entry object on each state change
 * (initial "running", then "done" or "error"). The caller owns the log array.
 *
 * @param {{
 *   queryService: any,
 *   username: string,
 *   password: string,
 *   selectedEnvironment: any,
 *   extraCredentials: any,
 *   logQueryStatus: (entry: { sql: string, status: string, elapsed: number }) => void,
 * }} opts
 * @returns {(sql: string, limit?: number) => Promise<ArrayBuffer>}
 */
export function createFetchFromTrino(opts) {
  const {
    queryService,
    username,
    password,
    selectedEnvironment,
    extraCredentials,
    logQueryStatus,
  } = opts;

  return async function fetchFromTrino(sql, limit = 1000000) {
    const entry = { sql, status: "running", elapsed: 0 };
    logQueryStatus(entry);
    const start = performance.now();
    try {
      const result = await queryService.executeQuery(
        sql,
        limit,
        username,
        password,
        selectedEnvironment,
        "arrow",
        extraCredentials,
      );
      const elapsed = performance.now() - start;
      const status = result.success ? "done" : "error";
      logQueryStatus({ ...entry, status, elapsed });
      if (!result.success) throw new Error(result.error ?? "Query failed");
      return result.data;
    } catch (err) {
      if (entry.status === "running") {
        // Network-level failure — executeQuery itself threw
        logQueryStatus({
          ...entry,
          status: "error",
          elapsed: performance.now() - start,
        });
      }
      throw err;
    }
  };
}

/**
 * Creates a `loadTrino` helper that fetches from Trino and inserts into DuckDB.
 *
 * @param {(sql: string, limit?: number) => Promise<ArrayBuffer>} fetchFromTrino
 * @param {any} dbConnector  — wasmConnector instance
 * @returns {(tableName: string, sql: string, limit?: number) => Promise<void>}
 */
export function createLoadTrino(fetchFromTrino, dbConnector) {
  return async function loadTrino(tableName, sql, limit = 1000000) {
    const arrowBuffer = await fetchFromTrino(sql, limit);
    const table = tableFromIPC(arrowBuffer);
    const conn = await dbConnector.getConnection();
    await conn.query(`DROP TABLE IF EXISTS "${tableName}"`);
    await conn.insertArrowTable(table, { name: tableName });
  };
}

/**
 * Creates a `perspective(tableName, config?, opts?)` helper backed by the shared DuckDB instance.
 *
 * Returns an async function that:
 *  1. Wires a DuckDBHandler virtual server over the shared DuckDB connection
 *  2. Opens the named table (which must already be loaded via loadTrino)
 *  3. Optionally connects a PerspectiveMosaicClient to keep the viewer filtered
 *     in sync with a Mosaic Selection (cross-filtering from vgplot charts)
 *  4. Returns a configured <perspective-viewer> DOM element ready to drop into a GL panel
 *
 * The virtual server is created once per `createPerspectivePanel` call (i.e. per dashboard
 * run) and shared across all `perspective(...)` calls within that run.
 *
 * @param {any} dbConnector  — wasmConnector instance (shared with Mosaic coordinator)
 * @param {any} [coordinator] — Mosaic Coordinator instance; required when using filterBy
 * @returns {(tableName: string, config?: object, opts?: { filterBy?: any }) => Promise<HTMLElement>}
 */
export function createPerspectivePanel(dbConnector, coordinator) {
  let pspClientPromise = null;

  async function getPspClient() {
    if (!pspClientPromise) {
      const conn = await dbConnector.getConnection();
      const handler = new DuckDBHandler(conn);
      const port = await perspectiveClient.createMessageHandler(handler);
      pspClientPromise = perspectiveClient.worker(Promise.resolve(port));
    }
    return pspClientPromise;
  }

  return async function perspective(tableName, config = {}, { filterBy } = {}) {
    const client = await getPspClient();

    const viewer = document.createElement("perspective-viewer");
    viewer.style.width = "100%";
    viewer.style.height = "100%";

    viewer.load(client);

    // DuckDBHandler.getHostedTables() qualifies names as "memory.<name>",
    // so open_table must use the same qualified form.

    await viewer.restore({ ...config, table: `memory.${tableName}` });
    console.log("restored view");
    if (filterBy && coordinator) {
      coordinator.connect(new PerspectiveMosaicClient(viewer, filterBy));
    }
    return viewer;
  };
}
