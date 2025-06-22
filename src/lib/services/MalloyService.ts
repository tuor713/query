import { SingleConnectionRuntime } from "@malloydata/malloy";
import type { StructDef, RunSQLOptions } from "@malloydata/malloy";
import type { BaseRunner } from "@malloydata/db-trino";
import { TrinoPrestoConnection } from "@malloydata/db-trino";
import { QueryService } from "./QueryService.js";
import { nanoid } from "nanoid";

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
      return {
        rows: [],
        columns: [],
        error: JSON.stringify(result.error),
      };
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

    return { rows: outputRows, columns };
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
