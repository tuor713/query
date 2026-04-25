<script>
    import { X, Sparkles } from "@lucide/svelte";
    import { marked } from "marked";

    let {
        isOpen = $bindable(false),
        version = "",
        onDismiss = () => {},
    } = $props();

    const releaseNotes = {
        "0.0.26": `
### New
- [AI Chat] Assissant can generate dashboards directly in chat
- [General] Release notes popup
- [General] Settings page with configurable default query language, AI max turns, and system prompt

### Improved
- [SaneQL] Better error messages for incorrect table names

### No longer broken
- [SaneQL] Support \`bigint\` datatype

### Removed
- [Wvlet] Wvlet language support removed in favor of SaneQL
`,
    };

    const notes = $derived(releaseNotes[version]);
    const notesHtml = $derived(notes ? marked(notes.trim()) : "");

    function dismiss() {
        onDismiss();
        isOpen = false;
    }

    function handleKeyDown(e) {
        if (e.key === "Escape") {
            dismiss();
        }
    }
</script>

<svelte:window on:keydown={handleKeyDown} />

{#if isOpen && notes}
    <div class="modal-overlay">
        <div class="modal-content" onclick={(e) => e.stopPropagation()}>
            <div class="modal-header">
                <h2><Sparkles size={18} />v{version}</h2>
                <button class="close-button" onclick={dismiss}>
                    <X size={20} />
                </button>
            </div>

            <div class="modal-body markdown-body">
                <!-- eslint-disable-next-line svelte/no-at-html-tags -->
                {@html notesHtml}
            </div>

            <div class="modal-footer">
                <button class="dismiss-button" onclick={dismiss}>
                    Got it
                </button>
            </div>
        </div>
    </div>
{/if}

<style>
    .modal-overlay {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.45);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 1000;
    }

    .modal-content {
        background: white;
        border-radius: 12px;
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
        width: 90%;
        max-width: 480px;
        font-family: Inter, ui-sans-serif;
    }

    .modal-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 1.25rem 1.5rem;
        border-bottom: 1px solid #e0e0e0;
    }

    .modal-header h2 {
        margin: 0;
        font-size: 1.1rem;
        font-weight: 600;
        color: #4f46e5;
        display: flex;
        align-items: center;
        gap: 0.4rem;
    }

    .close-button {
        background: none;
        border: none;
        color: #666;
        cursor: pointer;
        padding: 0.25rem;
        border-radius: 4px;
        display: flex;
        align-items: center;
        justify-content: center;
    }

    .close-button:hover {
        background: #f5f5f5;
        color: #333;
    }

    .modal-body {
        padding-left: 1.5rem;
        padding-right: 1.5rem;
        padding-bottom: 1rem;
    }

    .markdown-body :global(p) {
        margin: 0 0 0.4rem 0;
        font-size: 0.88rem;
        color: #555;
        line-height: 1.5;
    }

    .markdown-body :global(strong) {
        display: block;
        font-size: 0.95rem;
        color: #222;
        margin-top: 0.9rem;
    }

    .markdown-body :global(strong:first-child) {
        margin-top: 0;
    }

    .markdown-body :global(ul) {
        padding-inline-start: 20px;
    }

    .modal-footer {
        display: flex;
        justify-content: flex-end;
        padding: 1rem 1.5rem;
        border-top: 1px solid #e0e0e0;
        background: #f9f9f9;
        border-radius: 0 0 12px 12px;
    }

    .dismiss-button {
        padding: 0.45rem 1.5rem;
        border: none;
        border-radius: 8px;
        font-weight: 600;
        cursor: pointer;
        font-size: 0.9rem;
        background: #667eea;
        color: white;
    }

    .dismiss-button:hover {
        background: #5a67d8;
    }
</style>
