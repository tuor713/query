<script>
    import EnvironmentSelector from "./EnvironmentSelector.svelte";
    import { Save, Link } from "@lucide/svelte";

    let {
        queryName = $bindable(""),
        limit = $bindable(100000),
        executing = false,
        lastQueryTime = 0,
        selectedEnvironment = $bindable(),
        language = $bindable("sql"),
        display = $bindable("perspective"),
        onEnvironmentChange,
        onSave,
        onReset,
        onExecute,
        onCopyURL,
    } = $props();

    let showCopySuccess = $state(false);

    async function handleCopyURL() {
        await onCopyURL();
        showCopySuccess = true;
        setTimeout(() => {
            showCopySuccess = false;
        }, 2000);
    }
</script>

<div class="controls-container">
    <div class="control-group">
        <label>Query Name</label>
        <div class="input-row">
            <input
                type="text"
                placeholder="Query Name"
                bind:value={queryName}
            />
            <button onclick={onSave}
                ><Save size="1em" style="vertical-align: middle;" /></button
            >
        </div>
    </div>

    <div class="control-group">
        <label>Limit</label>
        <input type="number" bind:value={limit} class="limit-input" size="8" />
    </div>

    <div class="control-group">
        <label>Environment</label>
        <EnvironmentSelector
            bind:selectedEnvironment
            onChange={onEnvironmentChange}
        />
    </div>

    <div class="control-group">
        <label>Language</label>
        <select bind:value={language}>
            <option value="sql" selected>sql</option>
            <option value="malloy">malloy</option>
        </select>
    </div>

    <div class="control-group">
        <label>Display</label>
        <select bind:value={display} disabled={language !== "malloy"}>
            <option value="perspective" selected>perspective</option>
            {#if language === "malloy"}
                <option value="malloy">malloy</option>
            {/if}
        </select>
    </div>

    <div class="control-group">
        <label>&nbsp;</label>
        <div class="action-buttons">
            <button id="run" onclick={onExecute} disabled={executing}>
                {#if executing}
                    Running...
                {:else}
                    Run
                {/if}
            </button>
            <button onclick={onReset}>Reset</button>
            <div class="copy-url-container">
                <button onclick={handleCopyURL} title="Copy URL to current view">
                    <Link size="1em" style="vertical-align: middle;" />
                </button>
                {#if showCopySuccess}
                    <div class="copy-success-popup">URL copied!</div>
                {/if}
            </div>
        </div>
    </div>

    {#if lastQueryTime > 0}
        <div class="control-group">
            <label>Last Query Time</label>
            <span id="lastQueryTime">
                {new Intl.NumberFormat().format(Math.round(lastQueryTime))} ms
            </span>
        </div>
    {/if}
</div>

<style>
    .controls-container {
        display: flex;
        flex-wrap: wrap;
        gap: 15px;
        align-items: flex-start;
        margin-top: 5px;
    }

    .control-group {
        display: flex;
        flex-direction: column;
        gap: 4px;
    }

    .control-group label {
        font-size: 0.8em;
        font-weight: 500;
        color: #555;
    }

    .input-row {
        display: flex;
        gap: 5px;
        align-items: center;
    }

    .action-buttons {
        display: flex;
        gap: 5px;
    }

    #run {
        width: fit-content;
    }

    input,
    select,
    button {
        padding: 4px 8px;
        border: 1px solid #ccc;
        border-radius: 4px;
    }

    button {
        cursor: pointer;
        background: #f5f5f5;
    }

    button:hover:not(:disabled) {
        background: #e5e5e5;
    }

    button:disabled {
        opacity: 0.6;
        cursor: not-allowed;
    }

    .copy-url-container {
        position: relative;
        display: inline-block;
    }

    .copy-success-popup {
        position: absolute;
        top: -35px;
        left: 50%;
        transform: translateX(-50%);
        background: #333;
        color: white;
        padding: 6px 12px;
        border-radius: 4px;
        font-size: 0.8em;
        white-space: nowrap;
        z-index: 1000;
        pointer-events: none;
    }

    .copy-success-popup::after {
        content: "";
        position: absolute;
        top: 100%;
        left: 50%;
        transform: translateX(-50%);
        border: 5px solid transparent;
        border-top-color: #333;
    }
</style>
