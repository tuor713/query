<script>
    import { onMount, onDestroy } from "svelte";
    import perspective from "@perspective-dev/client";
    import "@perspective-dev/viewer";
    import "@perspective-dev/viewer-datagrid";
    import "@perspective-dev/viewer-d3fc";

    let { perspectiveConfig, id, adaptiveHeight = false } = $props();

    let worker = $state.raw(null);
    let viewer = $state.raw(null);

    onMount(async () => {
        if (worker === null) {
            worker = await perspective.worker();
        }
    });

    onDestroy(() => {
        if (worker) {
            worker.terminate();
        }
    });

    export async function loadData(arrow) {
        if (!worker) {
            worker = await perspective.worker();
        }

        const table = await worker.table(arrow);
        viewer = document.getElementById(id);

        // needs to be await otherwise restorting configuration will fail
        await viewer.load(table);

        if (perspectiveConfig) {
            await viewer.restore(perspectiveConfig);
        } else {
            await viewer.restore({
                columns: [],
                plugin: "datagrid",
                plugin_config: { edit_mode: "EDIT" },
            });
        }

        // Apply adaptive height after data is loaded
        if (adaptiveHeight && viewer && table) {
            setTimeout(() => {
                adjustViewerHeight(table);
            }, 100);
        }
    }

    async function adjustViewerHeight(table) {
        if (!viewer || !table) return;

        try {
            const numRows = await table.size();

            // Calculate height: header (40px) + rows * 28px + padding
            const headerHeight = 40;
            const rowHeight = 28;
            const padding = 20;
            const minRows = 3;
            const maxRows = 25;

            const displayRows = Math.max(minRows, Math.min(numRows, maxRows));
            const calculatedHeight =
                headerHeight + displayRows * rowHeight + padding;

            viewer.style.height = `${calculatedHeight}px`;
        } catch (error) {
            console.warn("Could not adjust viewer height:", error);
        }
    }

    export async function clearData() {
        if (viewer) {
            viewer.eject();
        }
    }

    export async function saveViewerConfig() {
        if (viewer) {
            const config = await viewer.save();
            const { table, ...rest } = config;
            return rest;
        }
        return { columns: [], plugin: "datagrid" };
    }
</script>

<perspective-viewer {id} class="resultviewer"></perspective-viewer>

<style>
    :global {
        @import url("../../../node_modules/@perspective-dev/viewer/dist/css/themes.css");
    }

    .resultviewer {
        flex-grow: 1;
        min-height: 600px;
        margin-top: 1em;
    }
</style>
