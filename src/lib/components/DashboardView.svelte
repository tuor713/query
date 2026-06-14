<script>
    import { onDestroy, onMount } from "svelte";
    import Monaco from "svelte-monaco";
    import { ensureMonacoSetup } from "$lib/utils/monacoSetup.js";
    import {
        Play,
        AlertCircle,
        PanelLeftClose,
        PanelLeftOpen,
        Timer,
        Save,
        FilePlus2,
    } from "@lucide/svelte";
    import { DashboardStorageService } from "../services/DashboardStorageService.js";
    import SavedItemsSidebar from "./SavedItemsSidebar.svelte";
    import { formatQueryTime } from "../utils/formatTime.js";
    import { Dashboard } from "../utils/Dashboard.js";
    import QueryLogPanel from "./QueryLogPanel.svelte";

    let {
        username,
        password,
        extraCredentials,
        selectedEnvironment,
        queryService,
    } = $props();

    const storage = new DashboardStorageService();

    // Saved dashboards sidebar state
    let savedDashboards = $state(storage.getDashboards());
    let dashboardFolders = $state(storage.getDashboardFolders());
    let currentDashboardName = $state("");
    let sidebarCollapsed = $state(false);

    function saveDashboard() {
        if (!currentDashboardName.trim()) return;
        const name = currentDashboardName.trim();
        const existing = savedDashboards.find((d) => d.name === name);
        const entry = {
            name,
            snippet: snippetCode,
            mode: editorMode,
            folderId: existing?.folderId ?? null,
        };
        savedDashboards = savedDashboards
            .filter((d) => d.name !== name)
            .concat(entry)
            .sort((a, b) => a.name.localeCompare(b.name));
        storage.saveDashboards(savedDashboards);
    }

    function clearDisplay() {
        dashboard?.destroy();
        dashboard = null;
        if (containerEl) containerEl.innerHTML = "";
        error = null;
        queryLog = [];
    }

    function loadDashboard(savedDashboard) {
        clearDisplay();
        currentDashboardName = savedDashboard.name;
        snippetCode = savedDashboard.snippet;
        editorMode = savedDashboard.mode ?? 'javascript';
    }

    function deleteDashboard(name) {
        savedDashboards = savedDashboards.filter((d) => d.name !== name);
        storage.saveDashboards(savedDashboards);
        if (currentDashboardName === name) currentDashboardName = "";
    }

    function handleDashboardFoldersChanged(updatedFolders) {
        dashboardFolders = updatedFolders;
        storage.saveDashboardFolders(dashboardFolders);
    }

    function handleDashboardMoved(name, targetFolderId) {
        savedDashboards = savedDashboards.map((d) =>
            d.name === name ? { ...d, folderId: targetFolderId } : d,
        );
        storage.saveDashboards(savedDashboards);
    }

    const DEFAULT_YAML_SNIPPET = `# data: named Trino queries loaded into embedded DuckDB
# params: named values or selections (reference as $name in mark encodings)
# layout: row | col | panel  (panels contain plot or perspective)
# plot marks: barY, barX, dot, line, area, rect, hexbin, hexgrid, ...
# plot attributes (siblings of plot): xLabel, yLabel, grid, width, height, ...
# aggregates in encodings: {count: } {sum: col} {avg: col} {min: col} {max: col}
# param refs in encodings: {column: $myParam}

data:
  nodes:
    trino: 'SELECT node_id, state, coordinator FROM system.runtime.nodes'

layout:
  type: row
  items:
    - type: panel
      title: Nodes by State
      plot:
        - mark: barY
          data: {from: nodes}
          x: state
          y: {count: }
          fill: state
      xLabel: State
      yLabel: Count
    - type: panel
      title: Raw Data
      perspective:
        from: nodes
`;

    const DEFAULT_JS_SNIPPET = `// Dashboard snippet — available globals:
// vg                    — vgplot: vg.plot([marks...]), vg.table({from}), vg.barY(), etc.
// loadTrino(name, sql)  — fetch from Trino and load into an embedded DuckDB table "name"
// perspective(name, config?, opts?) — Perspective viewer backed by the same DuckDB table (async)
//   opts.filterBy: vg.Selection     — filter viewer rows from a Mosaic selection
//   opts.selectAs: vg.Selection     — update a Mosaic selection when a row is clicked
//   opts.selectColumns: string[]    — columns used to build the selectAs predicate
// golden                — layout builder:
//   golden.panel(title, element)    — wrap a DOM element as a draggable panel
//   golden.row(...panels)           — arrange panels horizontally
//   golden.col(...panels)           — arrange panels vertically
//   golden.layout(container, root)  — create the GoldenLayout instance (return this)
// container             - The container element where the dashboard will be hosted

// use await Promise.all([loadTrino(...), loadTrino(...)]) for multiple queries
await loadTrino('nodes', 'SELECT node_id, state, coordinator FROM system.runtime.nodes');

return golden.layout(container,
    golden.row(
        golden.panel('Nodes by State', vg.plot([
            vg.barY(vg.from('nodes'), { x: 'state', y: vg.count(), fill: 'state' }),
            vg.xLabel('State'),
            vg.yLabel('Count'),
        ])),
        golden.panel('Raw Data', await perspective('nodes', {
            // plugin: 'datagrid',         // 'datagrid' | 'd3fc_y_bar' | 'd3fc_x_bar' | ...
            // columns: ['node_id', 'state'],   // visible columns (default: all)
            // group_by: ['state'],             // row pivots
            // split_by: [],                    // column pivots
            // aggregates: { node_id: 'count' },
            // sort: [['node_id', 'asc']],      // [column, 'asc'|'desc']
            // filter: [['state', '==', 'active']], // [column, op, value]
        })),
    )
);
`;

    let editorMode = $state(storage.getMode() ?? 'yaml');
    $effect(() => storage.saveMode(editorMode));

    let snippetCode = $state(storage.getSnippet() ?? DEFAULT_YAML_SNIPPET);
    let running = $state(false);
    let error = $state(null);

    let containerEl = $state(null);
    let dashboard = null;

    /** @type {{ sql: string, status: 'running'|'done'|'error', elapsed: number }[]} */
    let queryLog = $state([]);
    let showQueryLog = $state(false);

    // Editor panel resize/collapse
    const EDITOR_WIDTH_KEY = "dashboard_editor_width";
    let editorWidth = $state(
        parseInt(localStorage.getItem(EDITOR_WIDTH_KEY) ?? "420"),
    );
    let editorCollapsed = $state(false);
    let bodyEl = $state(null);
    let dragging = false;

    $effect(() => {
        editorCollapsed;
        requestAnimationFrame(() => dashboard?.updateRootSize());
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
        editorWidth = Math.max(
            150,
            Math.min(e.clientX - rect.left, rect.width - 200),
        );
        dashboard?.updateRootSize();
    }

    function onMouseup() {
        dragging = false;
        localStorage.setItem(EDITOR_WIDTH_KEY, String(editorWidth));
        document.removeEventListener("mousemove", onMousemove);
        document.removeEventListener("mouseup", onMouseup);
        dashboard?.updateRootSize();
    }

    const editorOptions = $derived({
        language: editorMode === 'yaml' ? 'yaml' : 'javascript',
        theme: "vs",
        automaticLayout: true,
        minimap: { enabled: false },
        scrollBeyondLastLine: false,
        lineNumbers: "on",
        wordWrap: "off",
        fontSize: 13,
    });

    async function run() {
        if (!containerEl) return;
        running = true;
        error = null;
        queryLog = [];
        showQueryLog = false;

        storage.saveSnippet(snippetCode);

        dashboard?.destroy();
        dashboard = new Dashboard({ queryService, username, password, selectedEnvironment, extraCredentials });

        try {
            await dashboard.mount(containerEl, snippetCode, {
                onQueryLog: (log) => { queryLog = log; },
                layoutState: storage.getLayoutState(),
                onLayoutStateChange: (state) => storage.saveLayoutState(state),
                mode: editorMode,
            });
        } catch (err) {
            console.error("Dashboard snippet error:", err);
            error = err?.message ?? String(err);
        } finally {
            running = false;
            showQueryLog = false;
        }
    }

    onDestroy(() => dashboard?.destroy());

    let monacoReady = $state(false);
    onMount(async () => {
        await ensureMonacoSetup();
        monacoReady = true;
    });
</script>

<div class="dashboard-root">
    <div class="toolbar">
        <button
            class="icon-btn"
            onclick={() => (editorCollapsed = !editorCollapsed)}
            title={editorCollapsed ? "Show editor" : "Hide editor"}
        >
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
        <div class="mode-toggle">
            <button
                class="mode-btn"
                class:active={editorMode === 'yaml'}
                onclick={() => (editorMode = 'yaml')}
            >YAML</button>
            <button
                class="mode-btn"
                class:active={editorMode === 'javascript'}
                onclick={() => (editorMode = 'javascript')}
            >JS</button>
        </div>
        <span class="hint">Ctrl+Enter to run</span>
        {#if queryLog.length > 0 && !running}
            <button
                class="icon-btn"
                onclick={() => (showQueryLog = !showQueryLog)}
                title="Query timings"
            >
                <Timer size="1em" />
                <span class="timer-label"
                    >{formatQueryTime(
                        Math.max(...queryLog.map((q) => q.elapsed)),
                    )}</span
                >
            </button>
        {/if}
        <div class="save-row">
            <input
                class="name-input"
                type="text"
                placeholder="Dashboard name…"
                bind:value={currentDashboardName}
                onkeydown={(e) => { if (e.key === "Enter") saveDashboard(); }}
            />
            <button
                class="icon-btn"
                onclick={saveDashboard}
                disabled={!currentDashboardName.trim()}
                title="Save dashboard"
            >
                <Save size="1em" />
            </button>
            <button
                class="icon-btn"
                onclick={() => { clearDisplay(); editorMode = 'yaml'; snippetCode = DEFAULT_YAML_SNIPPET; currentDashboardName = ""; }}
                title="New dashboard (reset to example)"
            >
                <FilePlus2 size="1em" />
            </button>
        </div>
    </div>

    {#if error}
        <div class="error-banner">
            <AlertCircle size="1em" style="flex-shrink:0" />
            <pre>{error}</pre>
        </div>
    {/if}

    <QueryLogPanel {queryLog} {running} bind:show={showQueryLog} />

    <div class="main-area">
        <SavedItemsSidebar
            items={savedDashboards}
            folders={dashboardFolders}
            currentItemName={currentDashboardName}
            title="Saved Dashboards"
            onItemSelected={loadDashboard}
            onItemDeleted={deleteDashboard}
            onFoldersChanged={handleDashboardFoldersChanged}
            onItemMoved={handleDashboardMoved}
            isCollapsed={sidebarCollapsed}
            onToggle={() => (sidebarCollapsed = !sidebarCollapsed)}
        />

    <div class="body" bind:this={bodyEl}>
        {#if !editorCollapsed}
            <div class="editor-pane" style="width:{editorWidth}px">
                {#if monacoReady}
                {#key editorMode}
                <Monaco
                    bind:value={snippetCode}
                    options={editorOptions}
                    onkeydown={(e) => {
                        if (e.ctrlKey && e.key === "Enter") {
                            e.preventDefault();
                            run();
                        }
                    }}
                />
                {/key}
                {/if}
            </div>
            <div class="splitter" onmousedown={onSplitterMousedown}></div>
        {/if}
        <div class="gl-pane" bind:this={containerEl}></div>
    </div>
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

    .timer-label {
        font-size: 0.75rem;
        margin-left: 0.25rem;
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

    .mode-toggle {
        display: inline-flex;
        border: 1px solid #ccc;
        border-radius: 5px;
        overflow: hidden;
    }

    .mode-btn {
        padding: 0.3rem 0.6rem;
        background: #f5f5f5;
        border: none;
        cursor: pointer;
        font-size: 0.75rem;
        font-weight: 500;
        color: #666;
    }

    .mode-btn + .mode-btn {
        border-left: 1px solid #ccc;
    }

    .mode-btn.active {
        background: #2563eb;
        color: white;
    }

    .mode-btn:hover:not(.active) {
        background: #e5e5e5;
    }

    .main-area {
        display: flex;
        flex: 1;
        overflow: hidden;
        min-height: 0;
    }

    .save-row {
        display: flex;
        align-items: center;
        gap: 0.35rem;
        margin-left: auto;
    }

    .name-input {
        padding: 0.3rem 0.5rem;
        border: 1px solid #ccc;
        border-radius: 4px;
        font-size: 0.875rem;
        width: 180px;
        font-family: inherit;
    }

    .name-input:focus {
        outline: none;
        border-color: #2563eb;
    }

    .body {
        display: flex;
        flex: 1;
        overflow: hidden;
        min-height: 0;
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
