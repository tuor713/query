/**
 * Service for handling SQL queries and execution
 */
import { rewriteQueryWithLimit, isSpecialCommand } from "../utils/sqlParser.js";

export class QueryService {
  constructor(baseUrl = "http://localhost:8888") {
    this.baseUrl = baseUrl;
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
