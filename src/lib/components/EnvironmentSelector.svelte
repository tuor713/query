<script>
    import { getEnvironments } from "../config/environments";

    let { selectedEnvironment = $bindable(), onChange = () => {} } = $props();

    function handleChange(event) {
        selectedEnvironment = event.target.value;
        onChange(selectedEnvironment);
    }
</script>

<select bind:value={selectedEnvironment} onchange={handleChange}>
    {#each getEnvironments() as env}
        <option value={env.id}>{env.name}</option>
    {/each}
</select>

<style>
    select {
        padding: 4px 8px;
        border: 1px solid #ccc;
        border-radius: 4px;
    }
</style>
