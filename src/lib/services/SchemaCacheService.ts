// Generic TTL cache used to memoize schema/DESCRIBE lookups across query languages.

interface CacheEntry<T> {
  result: T;
  timestamp: number;
  ttl: number;
}

export class TTLCache<T = any> {
  private cache = new Map<string, CacheEntry<T>>();

  constructor(private defaultTTL: number) {}

  get(key: string): T | null {
    const cached = this.cache.get(key);
    if (!cached) return null;

    if (Date.now() - cached.timestamp > cached.ttl) {
      this.cache.delete(key);
      return null;
    }

    return cached.result;
  }

  set(key: string, result: T, ttl?: number): void {
    this.cache.set(key, {
      result,
      timestamp: Date.now(),
      ttl: ttl ?? this.defaultTTL,
    });
  }

  clear(): void {
    this.cache.clear();
  }
}

// Canonical shape both Malloy and SaneQL can build from / reduce to, so a
// schema fetched by one query language can be reused by the other.
export interface SchemaColumn {
  name: string;
  type: string;
}

export function isDescribeQuery(sql: string): boolean {
  return sql.trim().toUpperCase().startsWith("DESCRIBE");
}

// Shared key format so the same table/environment/user resolves to the same
// cache entry regardless of which query language (Malloy, SaneQL) asked for it.
export function getSchemaCacheKey(
  sql: string,
  username: string,
  environment: string,
): string {
  return `${environment}:${username}:${sql.trim().toUpperCase()}`;
}

// Shared cache for DESCRIBE/schema query results (Malloy and SaneQL).
export const DESCRIBE_CACHE_TTL = 2 * 60 * 60 * 1000; // 2 hours in milliseconds
export const schemaCache = new TTLCache<SchemaColumn[]>(DESCRIBE_CACHE_TTL);
