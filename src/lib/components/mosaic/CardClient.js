import { MosaicClient } from '@uwdata/mosaic-core';

/**
 * Convert a card `value:` spec to a SQL aggregation expression string.
 *
 * Supported forms:
 *   "count(*)"      raw SQL string, used as-is
 *   {count: }       → count(*)
 *   {count: col}    → count(col)
 *   {sum: col}      → sum(col)
 *   {avg: col}      → avg(col)
 *   {min: col}      → min(col)
 *   {max: col}      → max(col)
 */
export function transformToSql(spec) {
    if (typeof spec === 'string') return spec;
    if (!spec || typeof spec !== 'object') throw new Error(`Invalid card value spec: ${JSON.stringify(spec)}`);
    const entries = Object.entries(spec);
    if (!entries.length) throw new Error('Card value spec has no keys');
    const [fn, col] = entries[0];
    const arg = (col == null || col === '') ? '*' : col;
    return `${fn}(${arg})`;
}

export function formatCardValue(val) {
    if (val == null) return '—';
    const n = typeof val === 'bigint' ? Number(val) : val;
    if (typeof n !== 'number' || Number.isNaN(n)) return String(val);
    if (Number.isInteger(n)) return n.toLocaleString();
    return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

/**
 * A Mosaic client that queries a DuckDB table for a single scalar aggregation
 * and updates a DOM element with the formatted result.
 *
 * Reacts to a filterBy Selection: when the selection changes the coordinator
 * re-runs the query with the current predicate as a WHERE clause.
 *
 * Usage:
 *   const valueEl = document.createElement('div');
 *   const client = new CardMosaicClient(valueEl, 'queries', 'count(*)', sel);
 *   vg.coordinator().connect(client);
 */
export class CardMosaicClient extends MosaicClient {
    constructor(valueEl, tableName, sqlAgg, filterBy) {
        super(filterBy);
        this._valueEl = valueEl;
        this._tableName = tableName;
        this._sqlAgg = sqlAgg;
    }

    query(filter) {
        const where = filter ? ` WHERE ${filter}` : '';
        return `SELECT ${this._sqlAgg} AS __value FROM memory.${this._tableName}${where}`;
    }

    queryResult(data) {
        const rows = [...data];
        const val = rows[0]?.__value;
        this._valueEl.textContent = formatCardValue(val);
        return this;
    }
}
