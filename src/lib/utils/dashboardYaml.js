import { parse } from 'yaml';
import {
    parseSpec,
    InstantiateContext,
    ParamNode,
    SelectionNode,
} from '@uwdata/mosaic-spec';

/**
 * Parse and execute a YAML dashboard spec against the live runtime.
 *
 * The spec is an extended superset of the Mosaic declarative spec:
 *   - data:    { <name>: { trino: "SQL", limit?: number } }
 *   - params:  { <name>: <value> | { select: intersect|union|single|crossfilter } }
 *   - layout:  golden-layout tree (type: row|col|panel)
 *              panel content: plot (vgplot/Mosaic) or perspective
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
export async function runYamlDashboard(yamlText, { loadTrino, perspective, golden, container }) {
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

    const root = await buildNode(layout, { perspective, golden, instCtx });
    return golden.layout(container, root);
}

/** Convert a params-section entry to a ParamNode or SelectionNode. */
function makeParamNode(pSpec) {
    if (pSpec === null || typeof pSpec !== 'object') return new ParamNode(pSpec);
    const { select } = pSpec;
    return select ? new SelectionNode(select) : new ParamNode(pSpec.value ?? pSpec);
}

// Keys that belong to the panel container, not to the plot spec
const PANEL_META = new Set(['type', 'title', 'plot', 'perspective', 'items']);

/**
 * Build panel content from a panel spec.
 *
 * For `plot:` panels: forward to mosaic-spec's parseSpec so that mark transforms
 * ({count:}, {sum: col}, {column: $x}, …) and plot attributes (xLabel, yLabel, …
 * as siblings of `plot`) are handled consistently with the Mosaic spec.
 */
async function buildPanelContent(spec, { perspective, instCtx }) {
    if (spec.plot) {
        // Mosaic-compatible plot spec: marks in `plot`, attributes as siblings
        const plotSpec = {
            plot: spec.plot,
            ...Object.fromEntries(Object.entries(spec).filter(([k]) => !PANEL_META.has(k))),
        };
        const ast = parseSpec(plotSpec);
        return ast.root.instantiate(instCtx);
    }
    if (spec.perspective) {
        const { from, ...config } = spec.perspective;
        return await perspective(from, config);
    }
    throw new Error(`Panel "${spec.title ?? '?'}" must have "plot" or "perspective" content`);
}

async function buildNode(spec, runtime) {
    const { type, items, title } = spec;

    if (type === 'row' || type === 'col') {
        const children = await Promise.all((items ?? []).map(item => buildNode(item, runtime)));
        return type === 'row' ? runtime.golden.row(...children) : runtime.golden.col(...children);
    }

    if (type === 'panel') {
        const el = await buildPanelContent(spec, runtime);
        return runtime.golden.panel(title ?? '', el);
    }

    throw new Error(`Unknown layout node type: "${type}"`);
}
