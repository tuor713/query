<script>
    import { onMount } from "svelte";
    import embed from "vega-embed";

    let { spec = {} } = $props();
    let chartContainer = $state(null);
    let error = $state(null);

    onMount(async () => {
        console.log("mounting chart", spec);
        try {
            if (chartContainer && spec) {
                await embed(chartContainer, $state.snapshot(spec), {
                    actions: {
                        export: true,
                        source: false,
                        compiled: false,
                        editor: false,
                    },
                    renderer: "canvas",
                });
            }
        } catch (e) {
            console.error("Error rendering Vega-Lite chart:", e);
            error = e.message;
        }
    });

    // Re-render when spec changes
    $effect(() => {
        if (chartContainer && spec) {
            embed(chartContainer, $state.snapshot(spec), {
                actions: {
                    export: true,
                    source: false,
                    compiled: false,
                    editor: false,
                },
                renderer: "canvas",
            }).catch((e) => {
                console.error("Error rendering Vega-Lite chart:", e);
                error = e.message;
            });
        }
    });
</script>

{#if error}
    <div class="chart-error">
        <strong>Chart Error:</strong>
        {error}
    </div>
{:else}
    <div class="vega-chart" bind:this={chartContainer}></div>
{/if}

<style>
    .vega-chart {
        width: 100%;
        min-height: 300px;
        margin: 1rem 0;
    }

    .chart-error {
        padding: 1rem;
        background: #fee;
        border-radius: 8px;
        border-left: 4px solid #dc3545;
        color: #dc3545;
        margin: 1rem 0;
    }
</style>
