<script>
    import { onMount, onDestroy } from "svelte";
    import perspective from "@finos/perspective";
    import perspective_viewer from "@finos/perspective-viewer";
    import "@finos/perspective-viewer-datagrid";
    import "@finos/perspective-viewer-d3fc";

    let { perspectiveConfig, id } = $props();

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
            await viewer.restore({ columns: [], plugin: "datagrid" });
        }
    }

    export async function saveViewerConfig() {
        if (viewer) {
            return await viewer.save();
        }
        return { columns: [], plugin: "datagrid" };
    }
</script>

<perspective-viewer {id} class="resultviewer"></perspective-viewer>

<style>
    :global {
        @import url("../../../node_modules/@finos/perspective-viewer/dist/css/themes.css");
    }

    .resultviewer {
        flex-grow: 1;
        min-height: 600px;
        margin-top: 1em;
    }
</style>
