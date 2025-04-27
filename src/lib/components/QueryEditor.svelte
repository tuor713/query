<script>
    import CodeMirror from "svelte-codemirror-editor";
    import { sql } from "@codemirror/lang-sql";

    export let query = "";
</script>

<div id="sqleditor">
    <CodeMirror
        lang={sql()}
        bind:value={query}
        styles={{
            "&": {
                height: "auto",
                "max-height": "400px",
            },
            ".cm-scroller": {
                overflow: "auto",
            },
        }}
    />
</div>

<style>
    #sqleditor {
        max-width: 60vw;
        border-width: 1px;
        border-style: solid;
        border-color: black;
        flex: 2;
    }
</style>