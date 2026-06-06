import { parse } from 'yaml';
import {
    parseSpec,
    InstantiateContext,
    ParamNode,
    SelectionNode,
} from '@uwdata/mosaic-spec';
import { CardMosaicClient, transformToSql, formatCardValue } from '../components/mosaic/index.js';

/**
 * Parse and execute a YAML dashboard spec against the live runtime.
 *
 * The spec is an extended superset of the Mosaic declarative spec:
 *   - data:    { <name>: { trino: "SQL", limit?: number } }
 *   - params:  { <name>: <value> | { select: intersect|union|single|crossfilter } }
 *   - layout:  golden-layout tree (type: row|col|panel) OR Mosaic layout tree
 *              (type: hconcat|vconcat|hspace|vspace|card)
 *
 * Panel content types (keys inside a `panel` node):
 *   - plot:        Mosaic/vgplot marks + attributes
 *   - perspective: Perspective datagrid
 *   - hconcat:     array of element specs laid out horizontally
 *   - vconcat:     array of element specs laid out vertically
 *
 * Element spec types (type: field):
 *   - card:    metric card — label + scalar aggregation query
 *   - hconcat: horizontal flex container; children in `items:`
 *   - vconcat: vertical flex container; children in `items:`
 *   - hspace:  horizontal spacer; size in `value:` (px or CSS string)
 *   - vspace:  vertical spacer; size in `value:`
 *
 * Plot specs follow the Mosaic format:
 *   - marks are items in the `plot` array
 *   - attributes (xLabel, yLabel, grid, width, …) are siblings of `plot`
 *   - transforms in encodings: {count: }, {sum: col}, {avg: col}, …
 *   - param refs in encodings:  {column: $myParam}
 *
 * Dashboard.js calls vg.coordinator(coordinator) before invoking this function,
 * so InstantiateContext() (with no args) automatically picks up our coordinator
 * via createAPIContext() → coordinator() from @uwdata/mosaic-core.
 *
 * params strategy: ParamNode/SelectionNode are instantiated into instCtx.activeParams
 * upfront. parseSpec() for individual plot specs creates ParamRefNodes for $-refs;
 * those resolve against the pre-populated instCtx.activeParams at instantiation time.
 */
export async function runYamlDashboard(yamlText, { vg, loadTrino, perspective, golden, container }) {
    const spec = parse(yamlText);
    if (!spec || typeof spec !== 'object') throw new Error('Invalid YAML dashboard spec');

    const { data = {}, params: paramSpecs = {}, layout } = spec;
    if (!layout) throw new Error('Dashboard spec must have a "layout" section');

    // Load all Trino data sources in parallel
    await Promise.all(
        Object.entries(data).map(([name, src]) => {
            if (typeof src?.trino === 'string') return loadTrino(name, src.trino, src.limit);
            throw new Error(`Unknown data source for "${name}" — expected { trino: "SQL" }`);
        })
    );

    // InstantiateContext uses the global Mosaic coordinator (set by Dashboard.js via vg.coordinator(...))
    const instCtx = new InstantiateContext();

    // Pre-populate instCtx.activeParams so $-references inside plot specs resolve correctly.
    // Each Param/Selection is instantiated once here and shared across all panels.
    for (const [name, pSpec] of Object.entries(paramSpecs)) {
        instCtx.activeParams.set(name, makeParamNode(pSpec).instantiate(instCtx));
    }

    // Pre-create any $-selections defined implicitly via `as: $name` in plot interactor
    // items (items that have a `select:` field). Mosaic's Toggle/interactor code reads
    // the Selection via ParamRefNode.instantiate(ctx) at plot-build time; if the name is
    // absent from activeParams at that point, the interactor receives undefined and crashes
    // on first use. Defaulting to 'intersect' matches Mosaic's own default for toggleX/Y.
    preScanSelections(layout, instCtx);

    const runtime = { vg, perspective, golden, instCtx };

    if (GOLDEN_TYPES.has(layout.type)) {
        const root = await buildNode(layout, runtime);
        return golden.layout(container, root);
    } else {
        // Pure Mosaic/flex layout — no GoldenLayout wrapper needed
        const el = await buildElement(layout, runtime);
        container.style.cssText = 'overflow: auto; width: 100%; height: 100%; box-sizing: border-box;';
        container.appendChild(el);
        return null;
    }
}

/** Convert a params-section entry to a ParamNode or SelectionNode. */
function makeParamNode(pSpec) {
    if (pSpec === null || typeof pSpec !== 'object') return new ParamNode(pSpec);
    const { select } = pSpec;
    return select ? new SelectionNode(select) : new ParamNode(pSpec.value ?? pSpec);
}

/**
 * Walk the layout tree and pre-register any $-selections implicitly defined by
 * `as: $name` in plot interactor items (items that carry a `select:` field).
 * Entries already present in instCtx.activeParams (from the explicit `params:` section)
 * are never overwritten.
 */
function preScanSelections(layoutNode, instCtx) {
    if (!layoutNode || typeof layoutNode !== 'object') return;
    if (layoutNode.type === 'panel' && Array.isArray(layoutNode.plot)) {
        for (const item of layoutNode.plot) {
            if (item?.select && typeof item.as === 'string' && item.as.startsWith('$')) {
                const name = item.as.slice(1);
                if (!instCtx.activeParams.has(name)) {
                    instCtx.activeParams.set(name, new SelectionNode('intersect').instantiate(instCtx));
                }
            }
        }
    }
    for (const child of (layoutNode.items ?? [])) {
        preScanSelections(child, instCtx);
    }
}

/**
 * Resolve a $-prefixed param reference to its live Param/Selection instance.
 * Returns the ref unchanged if it is not a string starting with "$".
 */
function resolveRef(ref, instCtx) {
    if (typeof ref === 'string' && ref.startsWith('$')) {
        return instCtx.activeParams.get(ref.slice(1));
    }
    return ref;
}

// ─── Golden layout node types ────────────────────────────────────────────────

const GOLDEN_TYPES = new Set(['row', 'col', 'panel']);

// Keys consumed by the golden panel container, not forwarded to content builders
const PANEL_META = new Set(['type', 'title', 'plot', 'perspective', 'hconcat', 'vconcat', 'items']);

async function buildNode(spec, runtime) {
    const { type, items, title } = spec;

    if (type === 'row' || type === 'col') {
        // Build children sequentially so that plot panels (which register $-selections
        // in instCtx.activeParams via `as:`) are always instantiated before downstream
        // perspective panels that reference those selections via `filterBy:`.
        const children = [];
        for (const item of (items ?? [])) {
            children.push(await buildNode(item, runtime));
        }
        return type === 'row' ? runtime.golden.row(...children) : runtime.golden.col(...children);
    }

    if (type === 'panel') {
        const el = await buildPanelContent(spec, runtime);
        return runtime.golden.panel(title ?? '', el);
    }

    throw new Error(`Unknown golden layout node type: "${type}". Use row/col/panel for GoldenLayout or hconcat/vconcat/card/hspace/vspace for flex layout.`);
}

/**
 * Build the DOM element content of a golden `panel` node.
 *
 * Supported content keys:
 *   plot:        Mosaic/vgplot marks + attributes
 *   perspective: Perspective datagrid (supports filterBy: $sel)
 *   hconcat:     array of element specs → horizontal flex
 *   vconcat:     array of element specs → vertical flex
 */
async function buildPanelContent(spec, runtime) {
    if (spec.plot) {
        // Mosaic-compatible plot spec: marks in `plot`, attributes as siblings
        const plotSpec = {
            plot: spec.plot,
            ...Object.fromEntries(Object.entries(spec).filter(([k]) => !PANEL_META.has(k))),
        };
        const ast = parseSpec(plotSpec);
        return ast.root.instantiate(runtime.instCtx);
    }
    if (spec.perspective) {
        const { from, filterBy: filterByRef, ...config } = spec.perspective;
        const opts = {};
        if (filterByRef != null) {
            opts.filterBy = resolveRef(filterByRef, runtime.instCtx);
        }
        return await runtime.perspective(from, config, opts);
    }
    if (spec.hconcat != null) {
        return buildElement({ type: 'hconcat', items: spec.hconcat }, runtime);
    }
    if (spec.vconcat != null) {
        return buildElement({ type: 'vconcat', items: spec.vconcat }, runtime);
    }
    throw new Error(`Panel "${spec.title ?? '?'}" must have "plot", "perspective", "hconcat", or "vconcat" content`);
}

// ─── Mosaic / flex element types ─────────────────────────────────────────────

/**
 * Build a DOM element from a typed element spec.
 *
 * Recognized spec.type values:
 *   hconcat  horizontal flex container; children in spec.items
 *   vconcat  vertical flex container; children in spec.items
 *   hspace   horizontal spacer (spec.value: px or CSS string)
 *   vspace   vertical spacer
 *   card     metric card (spec.label, spec.from, spec.value, spec.filterBy)
 */
async function buildElement(spec, runtime) {
    const { vg } = runtime;

    switch (spec.type) {
        case 'hconcat': {
            const children = [];
            for (const item of (spec.items ?? [])) {
                children.push(await buildElement(item, runtime));
            }
            return vg.hconcat(...children);
        }
        case 'vconcat': {
            const children = [];
            for (const item of (spec.items ?? [])) {
                children.push(await buildElement(item, runtime));
            }
            return vg.vconcat(...children);
        }
        case 'hspace':
            return vg.hspace(spec.value ?? spec.width ?? 10);
        case 'vspace':
            return vg.vspace(spec.value ?? spec.height ?? 10);
        case 'card':
            return buildCard(spec, runtime);
        default:
            // Fallback: treat as panel content (supports plot:/perspective: keys)
            return buildPanelContent(spec, runtime);
    }
}

// ─── Card component ───────────────────────────────────────────────────────────

async function buildCard(spec, runtime) {
    const { instCtx, vg } = runtime;
    const { label, from: tableName, value: valueTrSpec, filterBy: filterByRef } = spec;

    if (!tableName) throw new Error(`Card "${label ?? '?'}" missing "from" field`);
    if (!valueTrSpec) throw new Error(`Card "${label ?? '?'}" missing "value" field`);

    const sqlAgg = transformToSql(valueTrSpec);
    const filterBy = filterByRef != null ? resolveRef(filterByRef, instCtx) : undefined;

    const card = document.createElement('div');
    Object.assign(card.style, {
        padding: '16px 24px',
        margin: '8px',
        background: '#fff',
        border: '1px solid #e0e0e0',
        borderRadius: '8px',
        minWidth: '140px',
        display: 'flex',
        flexDirection: 'column',
        gap: '6px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
    });

    const labelEl = document.createElement('div');
    Object.assign(labelEl.style, {
        fontSize: '11px',
        fontWeight: '600',
        color: '#888',
        textTransform: 'uppercase',
        letterSpacing: '0.06em',
    });
    labelEl.textContent = label ?? '';

    const valueEl = document.createElement('div');
    Object.assign(valueEl.style, {
        fontSize: '28px',
        fontWeight: '700',
        color: '#111',
        lineHeight: '1',
    });
    valueEl.textContent = '…';

    card.appendChild(labelEl);
    card.appendChild(valueEl);

    vg.coordinator().connect(new CardMosaicClient(valueEl, tableName, sqlAgg, filterBy));

    return card;
}
