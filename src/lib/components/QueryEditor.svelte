<script>
    import Monaco from "svelte-monaco";

    export let query = "";

    // Monaco editor options
    const options = {
        language: "sql",
        theme: "vs",
        automaticLayout: true,
        minimap: {
            enabled: false,
        },
        scrollBeyondLastLine: false,
        lineNumbers: "on",
        wordWrap: "on",
        folding: true,
        fontSize: 12,
    };
</script>

<div id="sqleditor">
    <Monaco bind:value={query} {options} height="100%" />
</div>

<style>
    #sqleditor {
        max-width: 60vw;
        border-width: 1px;
        border-style: solid;
        border-color: black;
        flex: 2;
        height: auto;
        min-height: 100px;
        max-height: 50vh;
        overflow: auto;
        resize: vertical;
    }
</style>
