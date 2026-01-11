import { SingleConnectionRuntime, InMemoryURLReader } from "@malloydata/malloy";
import type {
  StructDef,
  RunSQLOptions,
  URLReader,
  InvalidationKey,
} from "@malloydata/malloy";
import type { BaseRunner } from "@malloydata/db-trino";
import { TrinoPrestoConnection } from "@malloydata/db-trino";
import { QueryService } from "./QueryService.js";
import { nanoid } from "nanoid";

// Cache for DESCRIBE queries
const describeCache = new Map<
  string,
  {
    result: any;
    timestamp: number;
    ttl: number;
  }
>();

const DESCRIBE_CACHE_TTL = 2 * 60 * 60 * 1000; // 2 hours in milliseconds

function isDescribeQuery(sql: string): boolean {
  const trimmedSql = sql.trim().toUpperCase();
  return trimmedSql.startsWith("DESCRIBE");
}

function getCacheKey(
  sql: string,
  username: string,
  environment: string,
): string {
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
    ttl: DESCRIBE_CACHE_TTL,
  });
}

// Utility functions for URL reading
function isInternalURL(url: string): boolean {
  return url.startsWith("internal://") || url.startsWith("malloy://");
}

async function hashForInvalidationKey(contents: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(contents);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return hashHex;
}

// Cache for dynamic URL fetching
const urlCache = new Map<
  string,
  {
    contents: string;
    timestamp: number;
    ttl: number;
  }
>();

const URL_CACHE_TTL = 5 * 60 * 1000; // 5 minutes in milliseconds

class DynamicURLReader implements URLReader {
  constructor(private defaultTTL: number = URL_CACHE_TTL) {}

  // Allow clearing the cache for testing or manual refresh
  public clearCache(): void {
    urlCache.clear();
  }

  // Allow getting cache statistics
  public getCacheStats(): { size: number; entries: string[] } {
    return {
      size: urlCache.size,
      entries: Array.from(urlCache.keys()),
    };
  }

  public async readURL(
    url: URL,
  ): Promise<{ contents: string; invalidationKey: InvalidationKey }> {
    const urlString = url.toString();
    const cached = urlCache.get(urlString);

    // Check if we have a valid cached result
    if (cached) {
      const now = Date.now();
      if (now - cached.timestamp <= cached.ttl) {
        return {
          contents: cached.contents,
          invalidationKey: await this.invalidationKey(url, cached.contents),
        };
      } else {
        // Cache expired, remove it
        urlCache.delete(urlString);
      }
    }

    // Fetch the URL
    try {
      let fetchString = urlString;
      if (fetchString.startsWith("shared://")) {
        fetchString =
          window.location.origin +
          "/" +
          fetchString.substring("shared://".length);
      }

      const response = await fetch(fetchString);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const contents = await response.text();

      // Cache the result
      urlCache.set(urlString, {
        contents,
        timestamp: Date.now(),
        ttl: this.defaultTTL,
      });

      return {
        contents,
        invalidationKey: await this.invalidationKey(url, contents),
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to fetch URL '${urlString}': ${errorMessage}`);
    }
  }

  public async getInvalidationKey(url: URL): Promise<InvalidationKey> {
    const urlString = url.toString();
    const cached = urlCache.get(urlString);

    if (cached) {
      const now = Date.now();
      if (now - cached.timestamp <= cached.ttl) {
        return await this.invalidationKey(url, cached.contents);
      }
    }

    // If not cached or expired, we need to fetch it
    const result = await this.readURL(url);
    return result.invalidationKey;
  }

  private async invalidationKey(
    url: URL,
    contents: string,
  ): Promise<InvalidationKey> {
    if (isInternalURL(url.toString())) {
      return null;
    }
    return await hashForInvalidationKey(contents);
  }
}

class RemoteTrinoRunner implements BaseRunner {
  constructor(
    baseUrl: string,
    defaultLimit: number,
    username: string,
    password: string,
    environment: string,
    extraCredentials: any[] = [],
  ) {
    this.baseUrl = baseUrl;
    this.defaultLimit = defaultLimit;
    this.username = username;
    this.password = password;
    this.environment = environment;
    this.extraCredentials = extraCredentials;
  }
  baseUrl: string;
  defaultLimit: number;
  username: string;
  password: string;
  environment: string;
  extraCredentials: any[];

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
        console.log(
          "RemoteTrinoRunner.runSQL - using cached result for DESCRIBE query",
        );
        return cachedResult;
      }
    }

    let qs = new QueryService(this.baseUrl);

    const result = await qs.executeQuery(
      sql,
      options.rowLimit ?? this.defaultLimit,
      this.username,
      this.password,
      this.environment,
      "arrow",
      this.extraCredentials,
    );
    console.log("RemoteTrinoRunner.runSQL", result);

    if (result.error || !result.success) {
      const errorResult = {
        rows: [],
        columns: [],
        error: JSON.stringify(result.error),
      };
      return errorResult;
    }

    // Convert arrow result to JSON format
    const jsonResult = qs.convertArrowToJson(result.data);

    const columns = [];
    for (let i = 0; i < jsonResult.columns.length; i++) {
      columns.push({
        name: jsonResult.columns[i],
        type: jsonResult.types[i],
      });
    }

    const outputRows: unknown[][] = [];
    for (const row of jsonResult.rows) {
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
    baseUrl: string,
    defaultLimit: number,
    username: string,
    password: string,
    environment: string,
    extraCredentials: any[] = [],
  ) {
    super(
      arg,
      new RemoteTrinoRunner(
        baseUrl,
        defaultLimit,
        username,
        password,
        environment,
        extraCredentials,
      ),
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
  baseUrl: string,
  username: string,
  password: string,
  environment: string,
  extraCredentials: any[] = [],
): Promise<any> {
  console.log("Running Malloy query", query);
  const connection = new RemoteTrinoConnection(
    "trino",
    baseUrl,
    limit,
    username,
    password,
    environment,
    extraCredentials,
  );

  const runtime = new SingleConnectionRuntime({
    connection: connection,
    urlReader: new DynamicURLReader(URL_CACHE_TTL),
  });
  const res = runtime.loadQuery(query);
  const result = await res.run();
  console.log("Malloy result", result);
  return result;
}
