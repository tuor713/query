<script>
    export let error = "";
</script>

{#if error}
    <div id="error">
        {error}
    </div>
{/if}

<style>
    #error {
        background-color: salmon;
        margin-top: 2em;
        padding: 10px;
        border-radius: 4px;
        color: white;
    }
</style>