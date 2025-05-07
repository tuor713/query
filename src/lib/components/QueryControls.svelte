<script>
    import EnvironmentSelector from "./EnvironmentSelector.svelte";

    export let queryName = "";
    export let limit = 100000;
    export let executing = false;
    export let lastQueryTime = 0;
    export let selectedEnvironment;
    export let onEnvironmentChange;
    export let onSave;
    export let onReset;
    export let onExecute;
</script>

<div>
    <input type="text" placeholder="Query Name" bind:value={queryName} />
    <button on:click={onSave}>Save Query</button>
    &nbsp;
    <button on:click={onReset}>Reset</button>
    &nbsp;
    <label class="limit-control">
        <span>Limit</span>
        <input type="number" bind:value={limit} class="limit-input" size="8" />
    </label>
    &nbsp;
    <EnvironmentSelector
        bind:selectedEnvironment
        onChange={onEnvironmentChange}
    />
    &nbsp;
    <button id="run" on:click={onExecute} disabled={executing}>
        {#if executing}
            Running...
        {:else}
            Run
        {/if}
    </button>
    &nbsp;
    {#if lastQueryTime > 0}
        <span id="lastQueryTime">
            {new Intl.NumberFormat().format(Math.round(lastQueryTime))} ms
        </span>
    {/if}
</div>

<style>
    #run {
        margin-top: 1em;
        width: fit-content;
    }

    .limit-control {
        display: inline-flex;
        align-items: center;
        gap: 5px;
    }

    .limit-input {
        width: 80px;
        padding: 2px 5px;
    }
</style>
