/**
 * SQL parsing utilities for Trino SQL
 */
import pkg from "node-sql-parser";
const { Parser } = pkg;

const parser = new Parser();

/**
 * Extracts ORDER BY clause from a SQL query and returns a modified query structure
 * @param {string} query - The SQL query to parse
 * @param {number} limit - The row limit to apply
 * @returns {string} - The rewritten query with proper ORDER BY handling
 */
export function rewriteQueryWithLimit(query, limit) {
  try {
    // Parse the SQL query using Trino dialect
    const ast = parser.astify(query, { database: "trino" });

    // Handle array of statements (multiple queries)
    if (Array.isArray(ast)) {
      if (ast.length > 1) {
        // Multiple statements - don't modify
        return `SELECT * FROM (\n${query}\n) LIMIT ${limit}`;
      }
      // Single statement in array
      return rewriteSingleQuery(ast[0], query, limit);
    }

    // Single statement
    return rewriteSingleQuery(ast, query, limit);
  } catch (error) {
    console.warn(
      "SQL parsing failed, falling back to simple wrapping:",
      error.message,
    );
    // Fallback to original behavior if parsing fails
    return `SELECT * FROM (\n${query}\n) LIMIT ${limit}`;
  }
}

/**
 * Rewrite a single parsed SQL statement
 * @param {Object} ast - Parsed AST
 * @param {string} originalQuery - Original query string
 * @param {number} limit - Row limit
 * @returns {string} - Rewritten query
 */
function rewriteSingleQuery(ast, originalQuery, limit) {
  // Only handle SELECT statements
  if (ast.type !== "select") {
    return `SELECT * FROM (\n${originalQuery}\n) LIMIT ${limit}`;
  }

  // Check if query already has a LIMIT
  if (ast.limit && ast.limit.value && ast.limit.value.length > 0) {
    const existingLimit = parseInt(ast.limit.value[0].value);
    // Only keep existing limit if it's smaller than or equal to the passed limit
    if (existingLimit <= limit) {
      return originalQuery;
    }
    // Existing limit is larger, so we need to override it with outer limit
  }

  // Extract ORDER BY if present
  if (ast.orderby && ast.orderby.length > 0) {
    try {
      // Generate the ORDER BY clause by creating a dummy query and extracting it
      const dummyQuery = parser.sqlify(
        {
          type: "select",
          columns: [
            {
              expr: {
                type: "column_ref",
                table: null,
                column: { expr: { type: "default", value: "1" } },
              },
              as: null,
            },
          ],
          from: [{ table: "dual", as: null }],
          orderby: ast.orderby,
        },
        { database: "trino" },
      );

      const orderByMatch = dummyQuery.match(/ORDER BY (.+)$/i);
      const orderByClause = orderByMatch ? orderByMatch[1] : null;

      if (orderByClause) {
        return `SELECT * FROM (\n${originalQuery}\n) ORDER BY ${orderByClause} LIMIT ${limit}`;
      }
    } catch (sqlifyError) {
      console.warn(
        "Failed to extract ORDER BY clause, using fallback:",
        sqlifyError.message,
      );
    }
  }

  // No ORDER BY or extraction failed - use simple wrapping
  return `SELECT * FROM (\n${originalQuery}\n) LIMIT ${limit}`;
}

/**
 * Check if a query is a special command that shouldn't have LIMIT applied
 * @param {string} query - The SQL query
 * @returns {boolean} - True if it's a special command
 */
export function isSpecialCommand(query) {
  const trimmedQuery = query.trim().toUpperCase();
  return (
    trimmedQuery.startsWith("SHOW ") ||
    trimmedQuery.startsWith("DESCRIBE ") ||
    trimmedQuery.startsWith("EXPLAIN ")
  );
}

/**
 * Check if a query contains only SELECT statements (no DML operations)
 * @param {string} query - The SQL query to validate
 * @returns {Object} - Object with {valid: boolean, error?: string}
 */
export function isSelectOnlyQuery(query) {
  try {
    // Handle special case for DESCRIBE / SHOW, which parser doesn't handle
    if (
      (query.toUpperCase().startsWith("DESCRIBE ") ||
        query.toUpperCase().startsWith("SHOW ")) &&
      !query.includes(";")
    ) {
      return { valid: true };
    }

    const trimmedQuery = query.trim();
    if (!trimmedQuery) {
      return { valid: false, error: "Empty query" };
    }

    // Parse the SQL query
    const ast = parser.astify(trimmedQuery, { database: "trino" });

    // Handle array of statements (multiple queries)
    if (Array.isArray(ast)) {
      for (const statement of ast) {
        const validation = validateStatement(statement);
        if (!validation.valid) {
          return validation;
        }
      }
      return { valid: true };
    }

    // Single statement
    return validateStatement(ast);
  } catch (error) {
    return { valid: false, error: `SQL parsing failed: ${error.message}` };
  }
}

/**
 * Validate that a parsed statement is a safe SELECT operation
 * @param {Object} ast - Parsed AST statement
 * @returns {Object} - Object with {valid: boolean, error?: string}
 */
function validateStatement(ast) {
  const allowedTypes = ["select", "describe", "show"];

  if (!allowedTypes.includes(ast.type)) {
    const operation = ast.type.toUpperCase();
    return {
      valid: false,
      error: `${operation} operations are not allowed. Only SELECT queries are permitted.`,
    };
  }

  return { valid: true };
}
