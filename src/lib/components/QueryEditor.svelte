<script>
    import Monaco from "svelte-monaco";
    import { onMount } from "svelte";
    import { monarch } from "@malloydata/syntax-highlight/grammars/malloy/malloy.monarch";
    import { ensureMonacoSetup } from "$lib/utils/monacoSetup.js";

    let {
        query = $bindable(""),
        language = $bindable("sql"),
        selection = $bindable(""),
        onExecute,
    } = $props();

    let monaco = $state.raw(null);
    let editor = $state.raw(null);
    let monacoReady = $state(false);

    onMount(async () => {
        const monacoModule = await ensureMonacoSetup();
        monaco = monacoModule;
        monaco.languages.register({ id: "malloy" });
        monaco.languages.setMonarchTokensProvider("malloy", monarch);
        monacoReady = true;
    });

    function handleEditorMount() {
        // Add Ctrl+Enter keyboard shortcut for executing queries
        if (monaco) {
            editor.addCommand(
                monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter,
                () => {
                    console.log("Monaco onExecute");
                    if (onExecute) {
                        onExecute();
                    }
                },
            );

            editor.onDidChangeCursorSelection((e) => {
                if (
                    e.selection.startLineNumber !== e.selection.endLineNumber ||
                    e.selection.startColumn !== e.selection.endColumn
                ) {
                    let text = editor.getModel().getValueInRange(e.selection);
                    console.log("Edit selection", e.selection, text);
                    selection = text;
                } else {
                    selection = "";
                }
            });
        }
    }

    // Monaco editor options
    const options = {
        language: language,
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
    {#if monacoReady}
        <Monaco
            bind:value={query}
            {options}
            bind:editor
            height="100%"
            on:ready={handleEditorMount}
        />
    {/if}
</div>

<style>
    #sqleditor {
        border-width: 1px;
        border-style: solid;
        border-color: black;
        height: 6rem;
        width: auto;
        min-height: 2rem;
        max-height: 50vh;
        overflow: auto;
        resize: vertical;
    }
</style>
