import loader from "@monaco-editor/loader";

let setupPromise = null;

export function ensureMonacoSetup() {
    if (setupPromise) return setupPromise;

    setupPromise = (async () => {
        const monaco = await import("monaco-editor");
        const { default: editorWorker } = await import(
            "monaco-editor/esm/vs/editor/editor.worker?worker"
        );

        self.MonacoEnvironment = {
            getWorker(_, _label) {
                return new editorWorker();
            },
        };

        loader.config({ monaco });
        return monaco;
    })();

    return setupPromise;
}
