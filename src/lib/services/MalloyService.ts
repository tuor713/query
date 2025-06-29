import { SingleConnectionRuntime } from "@malloydata/malloy";
import type { StructDef, RunSQLOptions } from "@malloydata/malloy";
import type { BaseRunner } from "@malloydata/db-trino";
import { TrinoPrestoConnection } from "@malloydata/db-trino";
import { QueryService } from "./QueryService.js";
import { nanoid } from "nanoid";

// Cache for DESCRIBE queries
const describeCache = new Map<string, {
  result: any;
  timestamp: number;
  ttl: number;
}>();

const DESCRIBE_CACHE_TTL = 2 * 60 * 60 * 1000; // 2 hours in milliseconds

function isDescribeQuery(sql: string): boolean {
  const trimmedSql = sql.trim().toUpperCase();
  return trimmedSql.startsWith("DESCRIBE");
}

function getCacheKey(sql: string, username: string, environment: string): string {
  return `${environment}:${username}:${sql.trim().toUpperCase()}`;
}

function getCachedResult(cacheKey: string): any | null {
  const cached = describeCache.get(cacheKey);
  if (!cached) return null;
  
  const now = Date.now();
  if (now - cached.timestamp > cached.ttl) {
    describeCache.delete(cacheKey);
    return null;
  }
  
  return cached.result;
}

function setCachedResult(cacheKey: string, result: any): void {
  describeCache.set(cacheKey, {
    result,
    timestamp: Date.now(),
    ttl: DESCRIBE_CACHE_TTL
  });
}

class RemoteTrinoRunner implements BaseRunner {
  constructor(
    defaultLimit: number,
    username: string,
    password: string,
    environment: string,
  ) {
    this.defaultLimit = defaultLimit;
    this.username = username;
    this.password = password;
    this.environment = environment;
  }
  defaultLimit: number;
  username: string;
  password: string;
  environment: string;

  async runSQL(
    sql: string,
    options: RunSQLOptions,
  ): Promise<{
    rows: unknown[][];
    columns: { name: string; type: string; error?: string }[];
    error?: string;
    profilingUrl?: string;
  }> {
    console.log("RemoteTrinoRunner.runSQL", sql);

    // Check if this is a DESCRIBE query and if we have a cached result
    if (isDescribeQuery(sql)) {
      const cacheKey = getCacheKey(sql, this.username, this.environment);
      const cachedResult = getCachedResult(cacheKey);
      if (cachedResult) {
        console.log("RemoteTrinoRunner.runSQL - using cached result for DESCRIBE query");
        return cachedResult;
      }
    }

    let qs = new QueryService();

    const result = await qs.executeQuery(
      sql,
      options.rowLimit ?? this.defaultLimit,
      this.username,
      this.password,
      this.environment,
      "json",
    );
    console.log("RemoteTrinoRunner.runSQL", result);

    if (result.error) {
      const errorResult = {
        rows: [],
        columns: [],
        error: JSON.stringify(result.error),
      };
      return errorResult;
    }
    const columns = [];
    for (let i = 0; i < result.columns.length; i++) {
      columns.push({
        name: result.columns[i],
        type: result.types[i],
      });
    }

    const outputRows: unknown[][] = [];
    for (const row of result.rows) {
      if (!options.rowLimit || outputRows.length < options.rowLimit) {
        const outputrow = [];
        for (const col of columns) {
          outputrow.push(row[col.name]);
        }
        outputRows.push(outputrow as unknown[]);
      }
    }

    const finalResult = { rows: outputRows, columns };

    // Cache DESCRIBE query results
    if (isDescribeQuery(sql)) {
      const cacheKey = getCacheKey(sql, this.username, this.environment);
      setCachedResult(cacheKey, finalResult);
    }

    return finalResult;
  }
}

export class RemoteTrinoConnection extends TrinoPrestoConnection {
  constructor(
    arg: string,
    defaultLimit: number,
    username: string,
    password: string,
    environment: string,
  ) {
    super(
      arg,
      new RemoteTrinoRunner(defaultLimit, username, password, environment),
      {},
    );
  }

  override get dialectName(): string {
    return "trino";
  }

  protected async fillStructDefForSqlBlockSchema(
    sql: string,
    structDef: StructDef,
  ): Promise<void> {
    const tmpQueryName = `myMalloyQuery${nanoid().replace(/-/g, "")}`;
    await this.executeAndWait(`PREPARE ${tmpQueryName} FROM ${sql}`);
    await this.loadSchemaForSqlBlock(
      `DESCRIBE OUTPUT ${tmpQueryName}`,
      structDef,
      `query ${sql.substring(0, 50)}`,
    );
  }
}

export async function runMalloyQuery(
  query: string,
  limit: number,
  username: string,
  password: string,
  environment: string,
): Promise<any> {
  console.log("Running Malloy query", query);
  const connection = new RemoteTrinoConnection(
    "trino",
    limit,
    username,
    password,
    environment,
  );
  const runtime = new SingleConnectionRuntime({ connection: connection });
  const res = runtime.loadQuery(query);
  const result = await res.run();
  console.log("Malloy result", result);
  return result;
}
