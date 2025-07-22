<script>
    import { environments } from "../config/environments";
    
    let { selectedEnvironment = $bindable(), onChange = () => {} } = $props();
    
    function handleChange(event) {
        selectedEnvironment = event.target.value;
        onChange(selectedEnvironment);
    }
</script>

<label class="env-selector">
    <span>Environment</span>
    <select bind:value={selectedEnvironment} onchange={handleChange}>
        {#each environments as env}
            <option value={env.id}>{env.name}</option>
        {/each}
    </select>
</label>

<style>
    .env-selector {
        display: inline-flex;
        align-items: center;
        gap: 5px;
    }
    
    select {
        padding: 2px 5px;
    }
</style>