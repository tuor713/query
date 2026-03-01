<script>
    import EnvironmentSelector from "./EnvironmentSelector.svelte";
    import { Save, Link, CirclePlay, Eraser } from "@lucide/svelte";
    import { formatQueryTime } from "../utils/formatTime.js";

    let {
        queryName = $bindable(""),
        limit = $bindable(100000),
        keepView = $bindable(false),
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
            <button onclick={onReset} title="Reset"><Eraser size="1em" style="vertical-align: middle;" /></button>
            <div class="copy-url-container">
                <button
                    onclick={handleCopyURL}
                    title="Copy URL to current view"
                >
                    <Link size="1em" style="vertical-align: middle;" />
                </button>
                {#if showCopySuccess}
                    <div class="copy-success-popup">URL copied!</div>
                {/if}
            </div>
        </div>
    </div>

    <div class="control-group">
        <label>Limit</label>
        <input type="number" bind:value={limit} class="limit-input" />
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
            <option value="wvlet">wvlet</option>
            <option value="malloy">malloy</option>
        </select>
    </div>

    <div class="control-group">
        <label>Display</label>
        <select bind:value={display}>
            <option value="perspective" selected>perspective</option>
            {#if language === "malloy"}
                <option value="malloy">malloy</option>
            {/if}
            <option value="mosaic">mosaic</option>
        </select>
    </div>

    {#if display === "perspective"}
        <div class="control-group">
            <label>&nbsp;</label>
            <div class="checkbox-container">
                <input type="checkbox" id="keepView" bind:checked={keepView} />
                <label for="keepView" class="checkbox-label">Keep view</label>
            </div>
        </div>
    {/if}

    <div class="run-group">
        {#if lastQueryTime > 0}
            <span class="query-time">{formatQueryTime(lastQueryTime)}</span>
        {/if}
        <button id="run" onclick={onExecute} disabled={executing} title="Run query">
            <CirclePlay size="1.2em" />
        </button>
    </div>
</div>

<style>
    .controls-container {
        display: flex;
        flex-wrap: wrap;
        gap: 15px;
        align-items: flex-end;
        margin-top: 5px;
        width: 100%;
    }

    .run-group {
        display: flex;
        align-items: center;
        gap: 10px;
        margin-left: auto;
    }

    .query-time {
        font-size: 0.8em;
        color: #888;
        white-space: nowrap;
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

    .limit-input {
        width: 5rem;
    }

    #run {
        display: flex;
        align-items: center;
        justify-content: center;
        background: #2563eb;
        color: white;
        border-color: #2563eb;
        padding: 6px 8px;
    }

    #run:hover:not(:disabled) {
        background: #1d4ed8;
        border-color: #1d4ed8;
    }

    #run:disabled {
        background: #93c5fd;
        border-color: #93c5fd;
        opacity: 1;
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

    .checkbox-container {
        display: flex;
        gap: 6px;
        align-items: center;
    }

    .checkbox-label {
        font-size: 0.9em;
        color: #333;
        cursor: pointer;
        margin: 0;
    }

    input[type="checkbox"] {
        cursor: pointer;
        width: 16px;
        height: 16px;
    }
</style>
