<script>
    import { onMount, onDestroy } from "svelte";
    import * as vg from "@uwdata/vgplot";
    import { Coordinator, wasmConnector } from "@uwdata/vgplot";
    import { tableFromIPC } from "apache-arrow";
    import { GoldenLayout } from "golden-layout";
    import "golden-layout/dist/css/goldenlayout-base.css";
    import "golden-layout/dist/css/themes/goldenlayout-light-theme.css";
    import Monaco from "svelte-monaco";
    import { Play, AlertCircle, PanelLeftClose, PanelLeftOpen, Timer, X, Loader } from "@lucide/svelte";
    import { DashboardStorageService } from "../services/DashboardStorageService.js";
    import { formatQueryTime } from "../utils/formatTime.js";

    let { username, password, extraCredentials, selectedEnvironment, queryService } = $props();

    const storage = new DashboardStorageService();

    const DEFAULT_SNIPPET = `// Dashboard snippet — available globals:
// vg              — vgplot: vg.plot([marks...]), vg.table({from}), vg.from(), vg.barY(), etc.
// loadTrino(tableName, sql, limit?) — fetch from Trino and load into DuckDB in one step
// golden          — layout builder:
//   golden.panel(title, domElement)  — wrap a DOM element as a draggable panel
//   golden.row(...panels)            — arrange panels horizontally
//   golden.col(...panels)            — arrange panels vertically
//   golden.layout(container, root)   — create the GoldenLayout instance (return this)
// coordinator     — Mosaic coordinator (shared across all panels for cross-filtering)
// duckdb, fetchFromTrino, tableFromIPC — lower-level helpers if needed

await loadTrino('nodes', 'SELECT node_id, state, coordinator FROM system.runtime.nodes');

return golden.layout(container,
    golden.row(
        golden.panel('Nodes by State', vg.plot([
            vg.barY(vg.from('nodes'), { x: 'state', y: vg.count(), fill: 'state' }),
            vg.xLabel('State'),
            vg.yLabel('Count'),
        ])),
        golden.panel('Raw Data', vg.table({ from: 'nodes' })),
    )
);
`;

    let snippetCode = $state(storage.getSnippet() ?? DEFAULT_SNIPPET);
    let running = $state(false);
    let error = $state(null);

    let containerEl = $state(null);
    let glInstance = null;
    let coordinatorInstance = null;
    let dbConnector = null;

    // Query execution log
    /** @type {{ sql: string, status: 'running'|'done'|'error', elapsed: number }[]} */
    let queryLog = $state([]);
    let showQueryLog = $state(false);

    // Editor panel resize/collapse
    const EDITOR_WIDTH_KEY = "dashboard_editor_width";
    let editorWidth = $state(parseInt(localStorage.getItem(EDITOR_WIDTH_KEY) ?? "420"));
    let editorCollapsed = $state(false);
    let bodyEl = $state(null);
    let dragging = false;

    $effect(() => {
        // Re-measure GL after editor panel is shown/hidden (runs after DOM update)
        editorCollapsed;
        requestAnimationFrame(() => glInstance?.updateRootSize());
    });

    function onSplitterMousedown(e) {
        dragging = true;
        e.preventDefault();
        document.addEventListener("mousemove", onMousemove);
        document.addEventListener("mouseup", onMouseup);
    }

    function onMousemove(e) {
        if (!dragging || !bodyEl) return;
        const rect = bodyEl.getBoundingClientRect();
        const newWidth = Math.max(150, Math.min(e.clientX - rect.left, rect.width - 200));
        editorWidth = newWidth;
        glInstance?.updateRootSize();
    }

    function onMouseup() {
        dragging = false;
        localStorage.setItem(EDITOR_WIDTH_KEY, String(editorWidth));
        document.removeEventListener("mousemove", onMousemove);
        document.removeEventListener("mouseup", onMouseup);
        glInstance?.updateRootSize();
    }

    const editorOptions = {
        language: "javascript",
        theme: "vs",
        automaticLayout: true,
        minimap: { enabled: false },
        scrollBeyondLastLine: false,
        lineNumbers: "on",
        wordWrap: "off",
        fontSize: 13,
    };

    async function run() {
        if (!containerEl) return;
        running = true;
        error = null;
        queryLog = [];
        showQueryLog = false;

        // Tear down previous GL instance
        if (glInstance) {
            try { glInstance.destroy(); } catch (_) {}
            glInstance = null;
        }
        containerEl.innerHTML = "";

        // Clear previous coordinator
        if (coordinatorInstance) {
            try { coordinatorInstance.clear(); } catch (_) {}
        }

        // Create fresh coordinator + DuckDB connector
        coordinatorInstance = new Coordinator();
        dbConnector = wasmConnector();
        coordinatorInstance.databaseConnector(dbConnector);

        // Set as the vgplot global coordinator so vg.plot() etc. use it
        vg.coordinator(coordinatorInstance);

        // Save snippet
        storage.saveSnippet(snippetCode);

        const fetchFromTrino = async (sql, limit = 1000000) => {
            const entry = { sql, status: "running", elapsed: 0 };
            queryLog = [...queryLog, entry];
            const start = performance.now();
            try {
                const result = await queryService.executeQuery(
                    sql, limit, username, password,
                    selectedEnvironment, "arrow", extraCredentials
                );
                entry.elapsed = performance.now() - start;
                if (!result.success) {
                    entry.status = "error";
                    queryLog = [...queryLog];
                    throw new Error(result.error ?? "Query failed");
                }
                entry.status = "done";
                queryLog = [...queryLog];
                return result.data;
            } catch (err) {
                entry.elapsed = performance.now() - start;
                entry.status = "error";
                queryLog = [...queryLog];
                throw err;
            }
        };

        // loadTrino(tableName, sql, limit?) — fetch from Trino and insert into DuckDB in one step
        const loadTrino = async (tableName, sql, limit = 1000000) => {
            const arrowBuffer = await fetchFromTrino(sql, limit);
            const table = tableFromIPC(arrowBuffer);
            const conn = await dbConnector.getConnection();
            await conn.query(`DROP TABLE IF EXISTS "${tableName}"`);
            await conn.insertArrowTable(table, { name: tableName });
        };

        // golden — declarative Golden Layout builder
        // golden.panel(title, domElement, options?) → GL component config
        // golden.row(...items)  → GL row config
        // golden.col(...items)  → GL column config
        // golden.layout(container, rootConfig) → initialised GoldenLayout instance
        let _panelCounter = 0;
        const _pendingPanels = new Map(); // componentType → () => HTMLElement

        const golden = {
            panel(title, element, options = {}) {
                const componentType = `__panel_${++_panelCounter}`;
                _pendingPanels.set(componentType, element);
                return { type: "component", componentType, title, ...options };
            },
            row(...items) {
                return { type: "row", content: items.flat() };
            },
            col(...items) {
                return { type: "column", content: items.flat() };
            },
            layout(containerEl, rootConfig) {
                const gl = new GoldenLayout(containerEl);
                for (const [componentType, element] of _pendingPanels) {
                    gl.registerComponentFactoryFunction(componentType, (glContainer) => {
                        glContainer.element.style.overflow = "auto";
                        glContainer.element.appendChild(element);
                    });
                }
                gl.loadLayout({ root: rootConfig });
                return gl;
            },
        };

        try {
            // Execute snippet as async function body
            // eslint-disable-next-line no-new-func
            const fn = new Function(
                "vg", "coordinator", "duckdb", "GoldenLayout",
                "container", "fetchFromTrino", "tableFromIPC",
                "loadTrino", "golden",
                `"use strict"; return (async () => { ${snippetCode} })();`
            );
            const result = await fn(
                vg, coordinatorInstance, dbConnector, GoldenLayout,
                containerEl, fetchFromTrino, tableFromIPC,
                loadTrino, golden
            );

            // If snippet returned a GoldenLayout instance, restore saved layout geometry
            if (result && typeof result.saveLayout === "function") {
                glInstance = result;
                glInstance.on("stateChanged", () => {
                    try {
                        storage.saveLayoutState(glInstance.saveLayout());
                    } catch (_) {}
                });
                const savedLayout = storage.getLayoutState();
                if (savedLayout) {
                    try { glInstance.loadLayout(savedLayout); } catch (_) {}
                }
            }
        } catch (err) {
            console.error("Dashboard snippet error:", err);
            error = err?.message ?? String(err);
        } finally {
            running = false;
            showQueryLog = false;
        }
    }

    onMount(() => {
        // Don't auto-run on mount — user explicitly clicks Run
    });

    onDestroy(() => {
        if (glInstance) {
            try { glInstance.destroy(); } catch (_) {}
        }
        if (coordinatorInstance) {
            try { coordinatorInstance.clear(); } catch (_) {}
        }
    });
</script>

<div class="dashboard-root">
    <div class="toolbar">
        <button class="icon-btn" onclick={() => (editorCollapsed = !editorCollapsed)} title={editorCollapsed ? "Show editor" : "Hide editor"}>
            {#if editorCollapsed}
                <PanelLeftOpen size="1em" />
            {:else}
                <PanelLeftClose size="1em" />
            {/if}
        </button>
        <button class="run-btn" onclick={run} disabled={running}>
            <Play size="1em" />
            {running ? "Running…" : "Run"}
        </button>
        <span class="hint">Ctrl+Enter to run</span>
        {#if queryLog.length > 0 && !running}
            <button class="icon-btn" onclick={() => (showQueryLog = !showQueryLog)} title="Query timings">
                <Timer size="1em" />
                <span class="timer-summary">{formatQueryTime(Math.max(...queryLog.map(q => q.elapsed)))}</span>
            </button>
        {/if}
    </div>

    {#if error}
        <div class="error-banner">
            <AlertCircle size="1em" style="flex-shrink:0" />
            <pre>{error}</pre>
        </div>
    {/if}

    {#if running && queryLog.length > 0}
        <div class="query-progress">
            {#each queryLog as q}
                <div class="query-progress-row">
                    {#if q.status === 'running'}
                        <Loader size="0.85em" class="spin" />
                    {:else if q.status === 'done'}
                        <span class="status-dot done">✓</span>
                    {:else}
                        <span class="status-dot error">✗</span>
                    {/if}
                    <span class="q-sql">{q.sql.length > 80 ? q.sql.slice(0, 80) + '…' : q.sql}</span>
                    {#if q.status !== 'running'}
                        <span class="q-time">{formatQueryTime(q.elapsed)}</span>
                    {/if}
                </div>
            {/each}
        </div>
    {/if}

    {#if showQueryLog && !running}
        <div class="query-log">
            <div class="query-log-header">
                <span>Query timings</span>
                <button class="icon-btn" onclick={() => (showQueryLog = false)}><X size="0.85em" /></button>
            </div>
            {#each queryLog as q, i}
                <div class="query-log-row">
                    <span class="q-index">{i + 1}</span>
                    {#if q.status === 'done'}
                        <span class="status-dot done">✓</span>
                    {:else}
                        <span class="status-dot error">✗</span>
                    {/if}
                    <span class="q-sql">{q.sql}</span>
                    <span class="q-time">{formatQueryTime(q.elapsed)}</span>
                </div>
            {/each}
            <div class="query-log-total">
                Total wall time: {formatQueryTime(Math.max(...queryLog.map(q => q.elapsed)))}
            </div>
        </div>
    {/if}

    <div class="body" bind:this={bodyEl}>
        {#if !editorCollapsed}
            <div class="editor-pane" style="width:{editorWidth}px">
                <Monaco bind:value={snippetCode} options={editorOptions} onkeydown={(e) => {
                    if (e.ctrlKey && e.key === "Enter") { e.preventDefault(); run(); }
                }} />
            </div>
            <div class="splitter" onmousedown={onSplitterMousedown}></div>
        {/if}
        <div class="gl-pane" bind:this={containerEl}></div>
    </div>
</div>

<style>
    .dashboard-root {
        display: flex;
        flex-direction: column;
        height: 100%;
        overflow: hidden;
        font-family: Inter, ui-sans-serif;
    }

    .toolbar {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        padding: 0.5rem 1rem;
        border-bottom: 1px solid #e0e0e0;
        background: #fafafa;
        flex-shrink: 0;
    }

    .run-btn {
        display: inline-flex;
        align-items: center;
        gap: 0.4rem;
        padding: 0.35rem 0.85rem;
        background: #2563eb;
        color: white;
        border: none;
        border-radius: 5px;
        font-size: 0.875rem;
        font-weight: 500;
        cursor: pointer;
    }

    .run-btn:hover:not(:disabled) {
        background: #1d4ed8;
    }

    .run-btn:disabled {
        opacity: 0.6;
        cursor: default;
    }

    .hint {
        font-size: 0.75rem;
        color: #999;
    }

    .error-banner {
        display: flex;
        align-items: flex-start;
        gap: 0.5rem;
        padding: 0.5rem 1rem;
        background: #fef2f2;
        border-bottom: 1px solid #fecaca;
        color: #b91c1c;
        font-size: 0.8rem;
        flex-shrink: 0;
    }

    .error-banner pre {
        margin: 0;
        white-space: pre-wrap;
        word-break: break-word;
        font-family: monospace;
    }

    .timer-summary {
        font-size: 0.75rem;
        margin-left: 0.25rem;
    }

    .query-progress {
        display: flex;
        flex-direction: column;
        gap: 0.2rem;
        padding: 0.4rem 1rem;
        background: #f0f7ff;
        border-bottom: 1px solid #bfdbfe;
        font-size: 0.78rem;
        font-family: monospace;
        flex-shrink: 0;
    }

    .query-log {
        display: flex;
        flex-direction: column;
        gap: 0.2rem;
        padding: 0.4rem 1rem 0.6rem;
        background: #fafafa;
        border-bottom: 1px solid #e0e0e0;
        font-size: 0.78rem;
        font-family: monospace;
        flex-shrink: 0;
        max-height: 200px;
        overflow-y: auto;
    }

    .query-log-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        font-family: Inter, ui-sans-serif;
        font-weight: 600;
        font-size: 0.8rem;
        color: #444;
        margin-bottom: 0.2rem;
    }

    .query-progress-row, .query-log-row {
        display: flex;
        align-items: baseline;
        gap: 0.4rem;
        white-space: nowrap;
    }

    .q-sql {
        flex: 1;
        overflow: hidden;
        text-overflow: ellipsis;
        color: #333;
    }

    .q-time {
        color: #666;
        flex-shrink: 0;
    }

    .q-index {
        color: #999;
        min-width: 1.2rem;
        text-align: right;
        flex-shrink: 0;
    }

    .status-dot {
        flex-shrink: 0;
        font-size: 0.7rem;
    }

    .status-dot.done { color: #16a34a; }
    .status-dot.error { color: #dc2626; }

    .query-log-total {
        font-family: Inter, ui-sans-serif;
        font-size: 0.78rem;
        font-weight: 600;
        color: #444;
        border-top: 1px solid #e0e0e0;
        padding-top: 0.3rem;
        margin-top: 0.2rem;
    }

    :global(.spin) {
        animation: spin 1s linear infinite;
        flex-shrink: 0;
    }

    @keyframes spin {
        from { transform: rotate(0deg); }
        to { transform: rotate(360deg); }
    }

    .body {
        display: flex;
        flex: 1;
        overflow: hidden;
        min-height: 0;
    }

    .icon-btn {
        display: inline-flex;
        align-items: center;
        padding: 0.35rem 0.5rem;
        background: #f5f5f5;
        border: 1px solid #ccc;
        border-radius: 5px;
        cursor: pointer;
        color: #444;
    }

    .icon-btn:hover {
        background: #e5e5e5;
    }

    .editor-pane {
        flex-shrink: 0;
        border-right: 1px solid #e0e0e0;
        overflow: hidden;
        min-width: 150px;
    }

    .splitter {
        width: 5px;
        flex-shrink: 0;
        cursor: col-resize;
        background: #e0e0e0;
        transition: background 0.15s;
    }

    .splitter:hover {
        background: #aaa;
    }

    .gl-pane {
        flex: 1;
        position: relative;
        overflow: hidden;
        min-width: 0;
    }

    /* Golden Layout needs position:relative on the root container */
    :global(.lm_goldenlayout) {
        position: absolute !important;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
    }

    :global(.lm_content) {
        background: white !important;
    }
</style>
