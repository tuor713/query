<script>
    import { marked } from "marked";
    import VegaLiteChart from "./VegaLiteChart.svelte";
    import DashboardBlock from "./DashboardBlock.svelte";
    import { tableFromIPC, DataType } from "apache-arrow";

    let {
        content = "",
        datasetRegistry = {},
        queryService = null,
        username = "",
        password = "",
        selectedEnvironment = null,
        extraCredentials = [],
    } = $props();

    let vegaLiteBlocks = $state([]);
    let dashboardBlocks = $state([]);
    let htmlContent = $state("");

    // Custom marked renderer for vega-lite and dashboard code blocks
    function renderMarkdown(markdown) {
        const vegaBlocks = [];
        const dashBlocks = [];
        let blockId = 0;

        const renderer = new marked.Renderer();
        const originalCode = renderer.code.bind(renderer);

        renderer.code = function (code) {
            if (code.lang === "vega-lite") {
                console.log("handling vega lite code", code);
                const id = `vega-chart-${Date.now()}-${blockId++}`;
                vegaBlocks.push({ id, spec: code.text });
                return `<div class="vega-lite-placeholder" data-chart-id="${id}"></div>`;
            }
            if (code.lang === "dashboard") {
                const id = `dashboard-block-${Date.now()}-${blockId++}`;
                dashBlocks.push({ id, code: code.text });
                return `<div class="dashboard-placeholder" data-dashboard-id="${id}"></div>`;
            }
            return originalCode(code);
        };

        const html = marked(markdown, { renderer });
        return { html, vegaLiteBlocks: vegaBlocks, dashboardBlocks: dashBlocks };
    }

    function convertArrowType(val, type) {
        // TODO more conversions
        if (DataType.isInt(type) || DataType.isFloat(type)) {
            return Number(val);
        } else {
            return val;
        }
    }

    // Convert Arrow data to JSON for Vega-Lite
    function arrowToJSON(arrowData) {
        if (arrowData instanceof ArrayBuffer) {
            console.log("converting arrow data to json", arrowData);
            const table = tableFromIPC(arrowData);
            console.log("Table:", table, table.toArray());
            return table.toArray().map((row) => {
                let res = {};
                for (const f of table.schema.fields) {
                    res[f.name] = convertArrowType(row[f.name], f.type);
                }
                return res;
            });
        }
        return arrowData;
    }

    // Parse and prepare Vega-Lite specs
    function prepareVegaSpecs(blocks) {
        return blocks.map((block) => {
            try {
                const spec = JSON.parse(block.spec);

                // If the spec references a dataset, inject the data
                if (
                    spec.data &&
                    spec.data.name &&
                    datasetRegistry[spec.data.name]
                ) {
                    const jsonData = arrowToJSON(
                        datasetRegistry[spec.data.name],
                    );
                    spec.data = { values: jsonData };
                }

                return { ...block, spec, rawSpec: JSON.parse(block.spec) };
            } catch (e) {
                console.error("Error parsing Vega-Lite spec:", e);
                return { ...block, spec: null, error: e.message };
            }
        });
    }

    $effect(() => {
        const result = renderMarkdown(content);
        htmlContent = result.html;
        vegaLiteBlocks = prepareVegaSpecs(result.vegaLiteBlocks);
        dashboardBlocks = result.dashboardBlocks;
    });
</script>

<div class="markdown-with-charts">
    {@html htmlContent}
</div>

{#each vegaLiteBlocks as block (block.id)}
    {#if block.spec}
        <VegaLiteChart spec={block.spec} />
        <details class="vega-spec-display">
            <summary>Vega-Lite Specification</summary>
            <pre><code>{JSON.stringify(block.rawSpec, null, 2)}</code></pre>
        </details>
    {:else if block.error}
        <div class="chart-error">
            <strong>Chart Error:</strong>
            {block.error}
        </div>
    {/if}
{/each}

{#each dashboardBlocks as block (block.id)}
    <DashboardBlock
        code={block.code}
        {queryService}
        {username}
        {password}
        {selectedEnvironment}
        {extraCredentials}
    />
{/each}

<style>
    .markdown-with-charts {
        width: 100%;
    }

    .chart-error {
        padding: 1rem;
        background: #fee;
        border-radius: 8px;
        border-left: 4px solid #dc3545;
        color: #dc3545;
        margin: 1rem 0;
    }

    .vega-spec-display {
        margin: 0 0 0.5rem 0;
        border: 1px solid #ddd;
        border-radius: 4px;
        background: #f8f9fa;
    }

    .vega-spec-display summary {
        padding: 0.5rem 0.5rem;
        cursor: pointer;
        font-weight: 500;
        user-select: none;
    }

    .vega-spec-display summary:hover {
        background: #e9ecef;
    }

    .vega-spec-display pre {
        margin: 0;
        padding: 1rem;
        background: #fff;
        border-top: 1px solid #ddd;
        border-radius: 0 0 4px 4px;
        overflow-x: auto;
    }
</style>
