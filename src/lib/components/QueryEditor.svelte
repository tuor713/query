<script>
    import Monaco from "svelte-monaco";
    import { monarch } from "@malloydata/syntax-highlight/grammars/malloy/malloy.monarch";

    let {
        query = $bindable(""),
        language = $bindable("sql"),
        onExecute,
    } = $props();

    let monaco = $state.raw(null);
    let editor = $state.raw(null);

    import loader from "@monaco-editor/loader";
    loader.init().then(async (monacoInstance) => {
        monaco = monacoInstance;
        monaco.languages.register({ id: "malloy" });
        monaco.languages.setMonarchTokensProvider("malloy", monarch);
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
    <Monaco
        bind:value={query}
        {options}
        bind:editor
        height="100%"
        on:ready={handleEditorMount}
    />
</div>

<style>
    #sqleditor {
        border-width: 1px;
        border-style: solid;
        border-color: black;
        height: auto;
        width: auto;
        min-height: 100px;
        max-height: 50vh;
        overflow: auto;
        resize: vertical;
    }
</style>
