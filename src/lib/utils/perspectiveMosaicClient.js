import { MosaicClient } from "@uwdata/mosaic-core";

// Map mosaic SQL operator strings to Perspective filter operators
const OP_MAP = {
  "=": "==",
  "==": "==",
  "<>": "!=",
  "!=": "!=",
  "<": "<",
  "<=": "<=",
  ">": ">",
  ">=": ">=",
};

function columnOf(node) {
  return node?.type === "COLUMN_REF" ? node.column : null;
}

function valueOf(node) {
  return node?.type === "LITERAL" ? node.value : undefined;
}

/**
 * Translate a single mosaic-sql AST predicate node into an array of
 * Perspective filter tuples `[column, operator, value]`.
 *
 * Returns an empty array for nodes that cannot be translated.
 */
function translateNode(node) {
  if (!node) return [];

  switch (node.type) {
    case "BINARY": {
      const col = columnOf(node.left);
      const op = OP_MAP[node.op];
      if (col && op != null) {
        const val = valueOf(node.right);
        if (val !== undefined) return [[col, op, val]];
      }
      console.warn(
        "[PerspectiveMosaicClient] untranslatable BINARY node",
        node,
      );
      return [];
    }
    case "IN": {
      const col = columnOf(node.expr);
      if (!col) {
        console.warn(
          "[PerspectiveMosaicClient] IN node missing column ref",
          node,
        );
        return [];
      }
      // InOpNode.values is always an array of AST nodes (via isIn(..., arr.map(asNode)))
      const vals = node.values
        .map((v) => valueOf(v))
        .filter((v) => v !== undefined);
      if (!vals.length)
        console.warn(
          "[PerspectiveMosaicClient] IN node produced no values",
          node,
        );
      if (!vals.length) {
        return [];
      } else if (vals.length === 1) {
        return [[col, "==", vals[0]]];
      } else {
        return [[col, "in", vals]];
      }
    }
    case "UNARY_POSTFIX": {
      const col = columnOf(node.expr);
      if (!col) {
        console.warn(
          "[PerspectiveMosaicClient] UNARY_POSTFIX node missing column ref",
          node,
        );
        return [];
      }
      if (node.op === "IS NULL") return [[col, "is null", null]];
      if (node.op === "IS NOT NULL") return [[col, "is not null", null]];
      console.warn(
        "[PerspectiveMosaicClient] unknown UNARY_POSTFIX op",
        node.op,
      );
      return [];
    }
    case "LOGICAL_OPERATOR": {
      if (node.op === "AND") {
        return node.clauses.flatMap(translateNode);
      }
      if (node.op === "OR") {
        // Convert OR of equalities on the same column to a single IN filter,
        // which covers the common union-selection pattern from bar/point charts.
        const eqs = node.clauses
          .filter(
            (c) => c.type === "BINARY" && c.op === "=" && columnOf(c.left),
          )
          .map((c) => ({ col: columnOf(c.left), val: valueOf(c.right) }))
          .filter((c) => c.val !== undefined);
        if (eqs.length === node.clauses.length) {
          const cols = [...new Set(eqs.map((e) => e.col))];
          if (cols.length === 1) {
            return [[cols[0], "in", eqs.map((e) => e.val)]];
          }
        }
        console.warn(
          "[PerspectiveMosaicClient] OR node could not be collapsed to IN",
          node,
        );
      }
      return [];
    }
    default:
      console.warn(
        "[PerspectiveMosaicClient] unhandled predicate node type",
        node?.type,
        node,
      );
      return [];
  }
}

/**
 * Convert a mosaic-sql predicate (as returned by `Selection.predicate(client)`)
 * to an array of Perspective filter tuples.
 *
 * The predicate is an array of AST nodes (intersect strategy) or a single
 * OrNode (union strategy with multiple clauses).  An empty / null predicate
 * means "no filter" and returns `[]`.
 *
 * @param {any} predicates  The predicate returned by `selection.predicate(client)`.
 * @returns {Array<[string, string, any]>}  Perspective filter tuples.
 */
export function predicateToPerspectiveFilters(predicates) {
  if (!predicates) return [];
  if (Array.isArray(predicates)) {
    return predicates.flatMap(translateNode);
  }
  // Single node (e.g. OrNode from union strategy)
  return translateNode(predicates);
}

/**
 * A Mosaic client that keeps a Perspective viewer in sync with a shared
 * Mosaic Selection.
 *
 * When connected to a Mosaic Coordinator the client reacts to filter
 * changes emitted by its `filterBy` Selection, translates the predicate
 * into Perspective filter tuples, and calls `viewer.restore({ filter })`.
 *
 * Because Perspective is backed by its own DuckDB virtual server this
 * client never issues a coordinator database query – `query()` returns
 * `null`, causing the coordinator to call `update()` directly.
 *
 * Usage (inside a dashboard snippet):
 *
 *   const sel = vg.Selection.intersect();
 *   const chart = vg.plot(..., vg.toggleY({ as: sel }));
 *   const grid  = await perspective('my_table', {}, { filterBy: sel });
 *
 * `createPerspectivePanel` wires this up automatically when `filterBy` is
 * passed.
 */
export class PerspectiveMosaicClient extends MosaicClient {
  /**
   * @param {HTMLElement} viewer   The `<perspective-viewer>` DOM element.
   * @param {import('@uwdata/mosaic-core').Selection} filterBy  The Selection to track.
   */
  constructor(viewer, filterBy) {
    super(filterBy);
    this._viewer = viewer;
    console.log("[PerspectiveMosaicClient] created", { viewer, filterBy });
  }

  query(_filter) {
    // Return a dummy query so Mosaic does not error out.
    return "SELECT 1";
  }

  /**
   * Called by the coordinator after a (null) query completes.
   * Reads the current selection predicate, translates it to Perspective
   * filter tuples, and restores the viewer with the new filters.
   */
  update() {
    const predicate = this.filterBy?.predicate(this);
    const filters = predicateToPerspectiveFilters(predicate);
    console.log("[PerspectiveMosaicClient] update()", { predicate, filters });
    this._viewer.restore({ filter: filters }).catch((err) => {
      console.warn("[PerspectiveMosaicClient] restore() failed", err);
    });
    return this;
  }
}
