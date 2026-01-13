/**
 * Service for handling SQL queries and execution
 */
import { rewriteQueryWithLimit, isSpecialCommand } from "../utils/sqlParser.js";
import { tableFromIPC } from "apache-arrow";

export class QueryService {
  constructor(baseUrl) {
    this.baseUrl = baseUrl;
  }

  /**
   * Convert Arrow result to JSON format
   */
  convertArrowToJson(arrowBuffer) {
    const table = tableFromIPC(arrowBuffer);
    const columns = table.schema.fields.map((field) => field.name);
    const types = table.schema.fields.map((field) => field.type.toString());
    console.log("Converting Arrow to JSON with types", types);
    const rows = [];

    for (let i = 0; i < table.numRows; i++) {
      const row = {};
      for (let j = 0; j < columns.length; j++) {
        let value = table.getChildAt(j).get(i);
        // Convert BigInt to Number for Int64 types
        if (typeof value === "bigint") {
          value = Number(value);
        }
        row[columns[j]] = value;
      }
      rows.push(row);
    }

    return {
      success: true,
      columns: columns,
      types: types,
      rows: rows,
    };
  }

  /**
   * Execute a query with optional user credentials
   */
  async executeQuery(
    query,
    limit,
    username,
    password,
    environment = "local",
    format = "arrow",
    extraCredentials = [],
  ) {
    // Check if query is a special command that should not have LIMIT applied
    const finalQuery = isSpecialCommand(query)
      ? query
      : rewriteQueryWithLimit(query, limit);

    const start = performance.now();
    const response = await fetch(`${this.baseUrl}/trino`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query: finalQuery,
        user: username,
        password: password,
        environment: environment,
        format: format,
        extraCredentials: extraCredentials,
      }),
    });

    const timeTaken = performance.now() - start;
    console.log("backend response in ", timeTaken, response);

    if (response.ok) {
      if (format === "arrow") {
        return {
          success: true,
          data: await response.arrayBuffer(),
        };
      } else {
        return await response.json();
      }
    } else {
      const errorData = await response.json();
      return {
        success: false,
        error: errorData.error,
      };
    }
  }
}
