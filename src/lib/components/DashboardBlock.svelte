<script>
    import { onMount, onDestroy } from "svelte";
    import * as vg from "@uwdata/vgplot";
    import { Coordinator, wasmConnector } from "@uwdata/vgplot";
    import { GoldenLayout } from "golden-layout";
    import "golden-layout/dist/css/goldenlayout-base.css";
    import "golden-layout/dist/css/themes/goldenlayout-light-theme.css";
    import { AlertCircle, Loader } from "@lucide/svelte";
    import {
        createFetchFromTrino,
        createLoadTrino,
        createPerspectivePanel,
    } from "../utils/dashboardRuntime.js";
    import { createGoldenBuilder } from "../utils/goldenBuilder.js";

    let { code, queryService, username, password, selectedEnvironment, extraCredentials } = $props();

    let containerEl = $state(null);
    let running = $state(false);
    let error = $state(null);
    let queryLog = $state([]);

    let glInstance = null;
    let coordinatorInstance = null;
    let dbConnector = null;

    async function run() {
        if (!containerEl) return;
        running = true;
        error = null;
        queryLog = [];

        if (glInstance) {
            try { glInstance.destroy(); } catch (_) {}
            glInstance = null;
        }
        containerEl.innerHTML = "";

        if (coordinatorInstance) {
            try { coordinatorInstance.clear(); } catch (_) {}
        }

        coordinatorInstance = new Coordinator();
        dbConnector = wasmConnector();
        coordinatorInstance.databaseConnector(dbConnector);
        vg.coordinator(coordinatorInstance);

        const fetchFromTrino = createFetchFromTrino({
            queryService,
            username,
            password,
            selectedEnvironment,
            extraCredentials,
            logQueryStatus: (entry) => {
                if (entry.status === "running") {
                    queryLog = [...queryLog, entry];
                } else {
                    queryLog = queryLog.map((q) =>
                        q.sql === entry.sql && q.status === "running" ? entry : q,
                    );
                }
            },
        });
        const loadTrino = createLoadTrino(fetchFromTrino, dbConnector);
        const perspective = createPerspectivePanel(dbConnector, coordinatorInstance);
        const golden = createGoldenBuilder(GoldenLayout);

        try {
            // eslint-disable-next-line no-new-func
            const fn = new Function(
                "vg",
                "container",
                "loadTrino",
                "perspective",
                "golden",
                `"use strict"; return (async () => { ${code} })();`,
            );
            const result = await fn(vg, containerEl, loadTrino, perspective, golden);

            if (result && typeof result.saveLayout === "function") {
                glInstance = result;
            }
        } catch (err) {
            console.error("Dashboard block error:", err);
            error = err?.message ?? String(err);
        } finally {
            running = false;
        }
    }

    onMount(() => {
        run();
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

<div class="dashboard-block">
    {#if error}
        <div class="dashboard-error">
            <AlertCircle size={16} />
            <span>{error}</span>
        </div>
    {/if}

    <div class="dashboard-container" bind:this={containerEl}>
        {#if running}
            <div class="dashboard-loading">
                <Loader size={20} />
                <span>Running dashboard…</span>
            </div>
        {/if}
    </div>

    {#if queryLog.length > 0}
        <div class="query-log">
            {#each queryLog as entry}
                <div class="query-log-entry" class:running={entry.status === "running"} class:error={entry.status === "error"}>
                    <span class="query-status">{entry.status}</span>
                    <code class="query-sql">{entry.sql.length > 80 ? entry.sql.slice(0, 80) + "…" : entry.sql}</code>
                    {#if entry.elapsed}
                        <span class="query-elapsed">{(entry.elapsed / 1000).toFixed(2)}s</span>
                    {/if}
                </div>
            {/each}
        </div>
    {/if}

    <details class="code-display">
        <summary>Dashboard Code</summary>
        <pre><code>{code}</code></pre>
    </details>
</div>

<style>
    .dashboard-block {
        border: 1px solid #ddd;
        border-radius: 6px;
        overflow: hidden;
        margin: 1rem 0;
    }

    .dashboard-container {
        width: 100%;
        height: 480px;
        position: relative;
        background: #fff;
    }

    .dashboard-loading {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        color: #666;
    }

    .dashboard-error {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        padding: 0.75rem 1rem;
        background: #fee;
        border-bottom: 1px solid #fcc;
        color: #dc3545;
        font-size: 0.875rem;
    }

    .query-log {
        border-top: 1px solid #eee;
        padding: 0.25rem 0.5rem;
        font-size: 0.75rem;
        background: #f8f9fa;
    }

    .query-log-entry {
        display: flex;
        gap: 0.5rem;
        align-items: center;
        padding: 0.1rem 0;
        color: #555;
    }

    .query-log-entry.running { color: #666; }
    .query-log-entry.error { color: #dc3545; }

    .query-status {
        font-weight: 600;
        min-width: 3.5rem;
    }

    .query-sql {
        flex: 1;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        font-size: 0.7rem;
        color: #333;
    }

    .query-elapsed {
        color: #888;
        white-space: nowrap;
    }

    .code-display {
        border-top: 1px solid #ddd;
        background: #f8f9fa;
    }

    .code-display summary {
        padding: 0.5rem 0.75rem;
        cursor: pointer;
        font-size: 0.8rem;
        font-weight: 500;
        user-select: none;
        color: #555;
    }

    .code-display summary:hover {
        background: #e9ecef;
    }

    .code-display pre {
        margin: 0;
        padding: 1rem;
        background: #fff;
        border-top: 1px solid #ddd;
        overflow-x: auto;
        font-size: 0.8rem;
    }
</style>
