<script>
    import EnvironmentSelector from "./EnvironmentSelector.svelte";
    import { Save } from "@lucide/svelte";

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
    } = $props();
</script>

<div>
    <input type="text" placeholder="Query Name" bind:value={queryName} />
    <button onclick={onSave}
        ><Save size="1em" style="vertical-align: middle;" /></button
    >
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
    <span>Language</span>
    <select bind:value={language}>
        <option value="sql" selected>sql</option>
        <option value="malloy">malloy</option>
    </select>
    &nbsp;
    <span>Display</span>
    <select bind:value={display} disabled={language !== "malloy"}>
        <option value="perspective" selected>perspective</option>
        {#if language === "malloy"}
            <option value="malloy">malloy</option>
        {/if}
    </select>
    &nbsp;
    <button id="run" onclick={onExecute} disabled={executing}>
        {#if executing}
            Running...
        {:else}
            Run
        {/if}
    </button>
    &nbsp;
    <button onclick={onReset}>Reset</button>
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
