import { tableFromIPC } from "apache-arrow";

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
    const { queryService, username, password, selectedEnvironment, extraCredentials, logQueryStatus } = opts;

    return async function fetchFromTrino(sql, limit = 1000000) {
        const entry = { sql, status: "running", elapsed: 0 };
        logQueryStatus(entry);
        const start = performance.now();
        try {
            const result = await queryService.executeQuery(
                sql, limit, username, password,
                selectedEnvironment, "arrow", extraCredentials
            );
            const elapsed = performance.now() - start;
            const status = result.success ? "done" : "error";
            logQueryStatus({ ...entry, status, elapsed });
            if (!result.success) throw new Error(result.error ?? "Query failed");
            return result.data;
        } catch (err) {
            if (entry.status === "running") {
                // Network-level failure — executeQuery itself threw
                logQueryStatus({ ...entry, status: "error", elapsed: performance.now() - start });
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
