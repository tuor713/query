import { describe, it, expect } from 'vitest';
import { rewriteQueryWithLimit, isSpecialCommand } from './sqlParser.js';

describe('SQL Parser', () => {
  describe('isSpecialCommand', () => {
    it('should identify SHOW commands', () => {
      expect(isSpecialCommand("SHOW TABLES")).toBe(true);
      expect(isSpecialCommand("show databases")).toBe(true);
      expect(isSpecialCommand("  SHOW SCHEMAS  ")).toBe(true);
    });

    it('should identify DESCRIBE commands', () => {
      expect(isSpecialCommand("DESCRIBE users")).toBe(true);
      expect(isSpecialCommand("describe table_name")).toBe(true);
      expect(isSpecialCommand("  DESCRIBE users  ")).toBe(true);
    });

    it('should identify EXPLAIN commands', () => {
      expect(isSpecialCommand("EXPLAIN SELECT * FROM users")).toBe(true);
      expect(isSpecialCommand("explain plan for SELECT * FROM users")).toBe(true);
    });

    it('should not identify regular SELECT as special command', () => {
      expect(isSpecialCommand("SELECT * FROM users")).toBe(false);
      expect(isSpecialCommand("INSERT INTO users VALUES (1, 'test')")).toBe(false);
    });
  });

  describe('rewriteQueryWithLimit', () => {
    it('should wrap simple SELECT without ORDER BY', () => {
      const result = rewriteQueryWithLimit("SELECT id, name FROM users", 100);
      expect(result).toContain("SELECT * FROM (");
      expect(result).toContain("SELECT id, name FROM users");
      expect(result).toContain(") LIMIT 100");
    });

    it('should preserve ORDER BY in outer query', () => {
      const result = rewriteQueryWithLimit("SELECT id, name FROM users ORDER BY created_at DESC", 50);
      expect(result).toContain("SELECT * FROM (");
      expect(result).toContain("SELECT id, name FROM users ORDER BY created_at DESC");
      expect(result).toContain(") ORDER BY created_at DESC LIMIT 50");
    });

    it('should preserve complex ORDER BY with multiple columns', () => {
      const result = rewriteQueryWithLimit("SELECT id, name, email FROM users ORDER BY name ASC, created_at DESC", 200);
      expect(result).toContain("SELECT * FROM (");
      expect(result).toContain("SELECT id, name, email FROM users ORDER BY name ASC, created_at DESC");
      expect(result).toContain(") ORDER BY name ASC, created_at DESC LIMIT 200");
    });

    it('should preserve existing LIMIT when it is smaller than or equal to passed limit', () => {
      const query = "SELECT id FROM users LIMIT 25";
      const result = rewriteQueryWithLimit(query, 100);
      expect(result).toBe(query);
    });

    it('should preserve existing LIMIT when it equals the passed limit', () => {
      const query = "SELECT id FROM users LIMIT 50";
      const result = rewriteQueryWithLimit(query, 50);
      expect(result).toBe(query);
    });

    it('should override existing LIMIT when it is larger than passed limit', () => {
      const query = "SELECT id FROM users LIMIT 200";
      const result = rewriteQueryWithLimit(query, 100);
      expect(result).toContain("SELECT * FROM (");
      expect(result).toContain("SELECT id FROM users LIMIT 200");
      expect(result).toContain(") LIMIT 100");
    });

    it('should override existing LIMIT with ORDER BY when limit is larger', () => {
      const query = "SELECT id, name FROM users ORDER BY name LIMIT 500";
      const result = rewriteQueryWithLimit(query, 100);
      expect(result).toContain("SELECT * FROM (");
      expect(result).toContain("SELECT id, name FROM users ORDER BY name LIMIT 500");
      expect(result).toContain(") ORDER BY name ASC LIMIT 100");
    });

    it('should handle queries without FROM clause', () => {
      const result = rewriteQueryWithLimit("SELECT 1 as test", 10);
      expect(result).toContain("SELECT * FROM (");
      expect(result).toContain("SELECT 1 as test");
      expect(result).toContain(") LIMIT 10");
    });

    it('should fallback to simple wrapping for unparseable queries', () => {
      // This should trigger the fallback mechanism
      const result = rewriteQueryWithLimit("INVALID SQL SYNTAX", 100);
      expect(result).toBe("SELECT * FROM (\nINVALID SQL SYNTAX\n) LIMIT 100");
    });
  });
});