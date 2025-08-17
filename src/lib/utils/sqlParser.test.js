import { describe, it, expect } from "vitest";
import {
  rewriteQueryWithLimit,
  isSpecialCommand,
  isSelectOnlyQuery,
} from "./sqlParser.js";

describe("SQL Parser", () => {
  describe("isSpecialCommand", () => {
    it("should identify SHOW commands", () => {
      expect(isSpecialCommand("SHOW TABLES")).toBe(true);
      expect(isSpecialCommand("show databases")).toBe(true);
      expect(isSpecialCommand("  SHOW SCHEMAS  ")).toBe(true);
    });

    it("should identify DESCRIBE commands", () => {
      expect(isSpecialCommand("DESCRIBE users")).toBe(true);
      expect(isSpecialCommand("describe table_name")).toBe(true);
      expect(isSpecialCommand("  DESCRIBE users  ")).toBe(true);
    });

    it("should identify EXPLAIN commands", () => {
      expect(isSpecialCommand("EXPLAIN SELECT * FROM users")).toBe(true);
      expect(isSpecialCommand("explain plan for SELECT * FROM users")).toBe(
        true,
      );
    });

    it("should not identify regular SELECT as special command", () => {
      expect(isSpecialCommand("SELECT * FROM users")).toBe(false);
      expect(isSpecialCommand("INSERT INTO users VALUES (1, 'test')")).toBe(
        false,
      );
    });
  });

  describe("rewriteQueryWithLimit", () => {
    it("should wrap simple SELECT without ORDER BY", () => {
      const result = rewriteQueryWithLimit("SELECT id, name FROM users", 100);
      expect(result).toContain("SELECT * FROM (");
      expect(result).toContain("SELECT id, name FROM users");
      expect(result).toContain(") LIMIT 100");
    });

    it("should preserve ORDER BY in outer query", () => {
      const result = rewriteQueryWithLimit(
        "SELECT id, name FROM users ORDER BY created_at DESC",
        50,
      );
      expect(result).toContain("SELECT * FROM (");
      expect(result).toContain(
        "SELECT id, name FROM users ORDER BY created_at DESC",
      );
      expect(result).toContain(") ORDER BY created_at DESC LIMIT 50");
    });

    it("should preserve complex ORDER BY with multiple columns", () => {
      const result = rewriteQueryWithLimit(
        "SELECT id, name, email FROM users ORDER BY name ASC, created_at DESC",
        200,
      );
      expect(result).toContain("SELECT * FROM (");
      expect(result).toContain(
        "SELECT id, name, email FROM users ORDER BY name ASC, created_at DESC",
      );
      expect(result).toContain(
        ") ORDER BY name ASC, created_at DESC LIMIT 200",
      );
    });

    it("should preserve existing LIMIT when it is smaller than or equal to passed limit", () => {
      const query = "SELECT id FROM users LIMIT 25";
      const result = rewriteQueryWithLimit(query, 100);
      expect(result).toBe(query);
    });

    it("should preserve existing LIMIT when it equals the passed limit", () => {
      const query = "SELECT id FROM users LIMIT 50";
      const result = rewriteQueryWithLimit(query, 50);
      expect(result).toBe(query);
    });

    it("should override existing LIMIT when it is larger than passed limit", () => {
      const query = "SELECT id FROM users LIMIT 200";
      const result = rewriteQueryWithLimit(query, 100);
      expect(result).toContain("SELECT * FROM (");
      expect(result).toContain("SELECT id FROM users LIMIT 200");
      expect(result).toContain(") LIMIT 100");
    });

    it("should override existing LIMIT with ORDER BY when limit is larger", () => {
      const query = "SELECT id, name FROM users ORDER BY name LIMIT 500";
      const result = rewriteQueryWithLimit(query, 100);
      expect(result).toContain("SELECT * FROM (");
      expect(result).toContain(
        "SELECT id, name FROM users ORDER BY name LIMIT 500",
      );
      expect(result).toContain(") ORDER BY name ASC LIMIT 100");
    });

    it("should handle queries without FROM clause", () => {
      const result = rewriteQueryWithLimit("SELECT 1 as test", 10);
      expect(result).toContain("SELECT * FROM (");
      expect(result).toContain("SELECT 1 as test");
      expect(result).toContain(") LIMIT 10");
    });

    it("should fallback to simple wrapping for unparseable queries", () => {
      // This should trigger the fallback mechanism
      const result = rewriteQueryWithLimit("INVALID SQL SYNTAX", 100);
      expect(result).toBe("SELECT * FROM (\nINVALID SQL SYNTAX\n) LIMIT 100");
    });
  });

  describe("isSelectOnlyQuery", () => {
    describe("Valid SELECT queries", () => {
      it("should allow simple SELECT queries", () => {
        const result = isSelectOnlyQuery("SELECT * FROM users");
        expect(result.valid).toBe(true);
        expect(result.error).toBeUndefined();
      });

      it("should allow SELECT with WHERE clause", () => {
        const result = isSelectOnlyQuery(
          "SELECT id, name FROM users WHERE active = true",
        );
        expect(result.valid).toBe(true);
        expect(result.error).toBeUndefined();
      });

      it("should allow SELECT with JOINs", () => {
        const result = isSelectOnlyQuery(`
          SELECT u.name, p.title
          FROM users u
          JOIN projects p ON u.id = p.user_id
        `);
        expect(result.valid).toBe(true);
        expect(result.error).toBeUndefined();
      });

      it("should allow SELECT with ORDER BY and LIMIT", () => {
        const result = isSelectOnlyQuery(
          "SELECT * FROM users ORDER BY created_at DESC LIMIT 10",
        );
        expect(result.valid).toBe(true);
        expect(result.error).toBeUndefined();
      });

      it("should allow WITH clause followed by SELECT (CTE)", () => {
        const result = isSelectOnlyQuery(`
          WITH active_users AS (
            SELECT * FROM users WHERE active = true
          )
          SELECT name, email FROM active_users
        `);
        expect(result.valid).toBe(true);
        expect(result.error).toBeUndefined();
      });

      it("should allow complex WITH clause with multiple CTEs", () => {
        const result = isSelectOnlyQuery(`
          WITH active_users AS (
            SELECT id, name FROM users WHERE active = true
          ),
          user_counts AS (
            SELECT COUNT(*) as total FROM active_users
          )
          SELECT au.name, uc.total
          FROM active_users au, user_counts uc
        `);
        expect(result.valid).toBe(true);
        expect(result.error).toBeUndefined();
      });

      it("should allow SELECT without FROM clause", () => {
        const result = isSelectOnlyQuery(
          "SELECT 1 as test, 'hello' as greeting",
        );
        expect(result.valid).toBe(true);
        expect(result.error).toBeUndefined();
      });
    });

    describe("Valid metadata queries", () => {
      it("should allow SHOW queries", () => {
        const result = isSelectOnlyQuery("SHOW TABLES");
        expect(result.valid).toBe(true);
        expect(result.error).toBeUndefined();
      });

      it("should allow SHOW queries", () => {
        const result = isSelectOnlyQuery("DESCRIBE system.runtime.queries");
        expect(result.valid).toBe(true);
        expect(result.error).toBeUndefined();
      });
    });

    describe("Rejected DML operations", () => {
      it("should reject INSERT statements", () => {
        const result = isSelectOnlyQuery(
          "INSERT INTO users (name, email) VALUES ('John', 'john@example.com')",
        );
        expect(result.valid).toBe(false);
        expect(result.error).toContain("INSERT operations are not allowed");
      });

      it("should reject UPDATE statements", () => {
        const result = isSelectOnlyQuery(
          "UPDATE users SET active = false WHERE id = 1",
        );
        expect(result.valid).toBe(false);
        expect(result.error).toContain("UPDATE operations are not allowed");
      });

      it("should reject DELETE statements", () => {
        const result = isSelectOnlyQuery(
          "DELETE FROM users WHERE active = false",
        );
        expect(result.valid).toBe(false);
        expect(result.error).toContain("DELETE operations are not allowed");
      });

      it("should reject CREATE statements", () => {
        const result = isSelectOnlyQuery(
          "CREATE TABLE new_table (id INT, name VARCHAR(50))",
        );
        expect(result.valid).toBe(false);
        expect(result.error).toContain("CREATE operations are not allowed");
      });

      it("should reject DROP statements", () => {
        const result = isSelectOnlyQuery("DROP TABLE users");
        expect(result.valid).toBe(false);
        expect(result.error).toContain("DROP operations are not allowed");
      });

      it("should reject ALTER statements", () => {
        const result = isSelectOnlyQuery(
          "ALTER TABLE users ADD COLUMN phone VARCHAR(20)",
        );
        expect(result.valid).toBe(false);
        expect(result.error).toContain("ALTER operations are not allowed");
      });

      it("should reject TRUNCATE statements", () => {
        const result = isSelectOnlyQuery("TRUNCATE TABLE users");
        expect(result.valid).toBe(false);
        expect(result.error).toContain("TRUNCATE operations are not allowed");
      });
    });

    describe("Multiple statements", () => {
      it("should allow multiple SELECT statements", () => {
        const result = isSelectOnlyQuery(
          "SELECT * FROM users; SELECT * FROM projects;",
        );
        expect(result.valid).toBe(true);
        expect(result.error).toBeUndefined();
      });

      it("should reject if any statement is not SELECT", () => {
        const result = isSelectOnlyQuery(
          "SELECT * FROM users; INSERT INTO logs (message) VALUES ('test');",
        );
        expect(result.valid).toBe(false);
        expect(result.error).toContain("INSERT operations are not allowed");
      });

      it("should reject mixed SELECT and DML operations", () => {
        const result = isSelectOnlyQuery(
          "SELECT * FROM users; UPDATE users SET last_login = NOW();",
        );
        expect(result.valid).toBe(false);
        expect(result.error).toContain("UPDATE operations are not allowed");
      });
    });

    describe("Edge cases", () => {
      it("should reject empty queries", () => {
        const result = isSelectOnlyQuery("");
        expect(result.valid).toBe(false);
        expect(result.error).toContain("Empty query");
      });

      it("should reject whitespace-only queries", () => {
        const result = isSelectOnlyQuery("   \n\t   ");
        expect(result.valid).toBe(false);
        expect(result.error).toContain("Empty query");
      });

      it("should handle malformed SQL gracefully", () => {
        const result = isSelectOnlyQuery("SELECT FROM WHERE");
        expect(result.valid).toBe(false);
        expect(result.error).toContain("SQL parsing failed");
      });

      it("should handle completely invalid SQL gracefully", () => {
        const result = isSelectOnlyQuery("This is not SQL at all!");
        expect(result.valid).toBe(false);
        expect(result.error).toContain("SQL parsing failed");
      });
    });
  });
});
