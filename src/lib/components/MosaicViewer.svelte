<script>
    import * as vg from "@uwdata/vgplot";
    import { parseSpec, astToDOM } from "@uwdata/mosaic-spec";
    import yaml from "yaml";
    import { tableFromIPC } from "apache-arrow";
    import { Pencil } from "@lucide/svelte";

    let spec = $state(`input: table
from: results
width: 800
height: 600`);

    let expanded = $state(true);

    const db = vg.wasmConnector();
    vg.coordinator().databaseConnector(db);
    vg.coordinator().manager.logQueries(true);

    vg.coordinator().logger({
        debug(...args) {
            console.log("debug", args);
        },
        info(...args) {
            console.log("info", args);
        },
        log() {},
        warn() {},
        error() {},
        group() {},
        groupCollapsed() {},
        groupEnd() {},
    });

    export async function reloadLayout() {
        const root = document.getElementById("mosaic-content");
        root.innerHTML = "";

        const ySpec = yaml.parse(spec);
        const ast = parseSpec(ySpec);
        const res = await astToDOM(ast);

        console.log("Got AST", ast, res);
        root.appendChild(res.element);
        console.log("Appendend AST");
    }

    export async function loadData(bytes) {
        console.log("Loading data to DuckDB");
        const conn = await db.getConnection();

        console.log("Clearing previous data");
        await vg.coordinator().exec(["DROP TABLE IF EXISTS results"]);
        vg.coordinator().clear();

        const table = tableFromIPC(bytes);

        console.log("Inserting table", table);
        await conn.insertArrowTable(table, {
            name: "results",
        });

        // Write EOS
        const EOS = new Uint8Array([255, 255, 255, 255, 0, 0, 0, 0]);
        await conn.insertArrowTable(EOS, { name: "results" });

        await reloadLayout();

        console.log("Mosaic Viewer loaded");
    }
</script>

<div id="mosaic">
    <div id="mosaic-content"></div>
    {#if expanded}
        <div id="mosaic-spec-editor">
            <h4>Mosaic Spec</h4>
            <textarea id="mosaic-spec" bind:value={spec} cols="50" rows="20"
            ></textarea>
            <div>
                <button on:click={() => reloadLayout()}>Apply</button>
                <button on:click={() => (expanded = false)}>Hide</button>
            </div>
        </div>
    {:else}
        <div>
            <button on:click={() => (expanded = true)}
                ><Pencil size="1em" style="vertical-align: middle;" /></button
            >
        </div>
    {/if}
</div>

<style>
    #mosaic {
        margin-top: 1em;
        flex-direction: row;
        display: flex;
    }
    #mosaic-content {
        flex-grow: 2;
    }
    #mosaic-spec-editor {
        display: flex;
        flex-direction: column;
        gap: 0.2em;
        flex-grow: 1;
    }

    h4 {
        margin-top: 0;
    }

    button {
        padding: 4px 8px;
        border: 1px solid #ccc;
        border-radius: 4px;
    }

    button {
        cursor: pointer;
        background: #f5f5f5;
    }
</style>
