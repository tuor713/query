<script>
    import { X } from "@lucide/svelte";

    let {
        isOpen = $bindable(false),
        systemPrompt = $bindable(""),
        onSave = () => {},
        getDefaultPrompt = () => "",
    } = $props();

    let tempSystemPrompt = $state(systemPrompt);

    function closeDialog() {
        isOpen = false;
    }

    function handleSave() {
        onSave(tempSystemPrompt);
        isOpen = false;
    }

    function handleReset() {
        tempSystemPrompt = getDefaultPrompt();
    }

    function handleKeyDown(e) {
        if (e.key === "Escape") {
            closeDialog();
        }
    }

    // Update temp value when dialog opens
    $effect(() => {
        if (isOpen) {
            tempSystemPrompt = systemPrompt;
        }
    });
</script>

<svelte:window on:keydown={handleKeyDown} />

{#if isOpen}
    <div class="modal-overlay" onclick={closeDialog}>
        <div class="modal-content" onclick={(e) => e.stopPropagation()}>
            <div class="modal-header">
                <h2>Settings</h2>
                <button class="close-button" onclick={closeDialog}>
                    <X size={20} />
                </button>
            </div>

            <div class="modal-body">
                <div class="setting-group">
                    <label for="system-prompt">System Prompt</label>
                    <textarea
                        id="system-prompt"
                        bind:value={tempSystemPrompt}
                        placeholder="Enter custom system prompt..."
                        rows="15"
                    ></textarea>
                </div>
            </div>

            <div class="modal-footer">
                <button class="reset-button" onclick={handleReset}>
                    Reset to Default
                </button>
                <div class="footer-right">
                    <button class="cancel-button" onclick={closeDialog}>
                        Cancel
                    </button>
                    <button class="save-button" onclick={handleSave}>
                        Save
                    </button>
                </div>
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
        background: rgba(0, 0, 0, 0.5);
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
        max-width: 1000px;
        max-height: 80vh;
        overflow-y: auto;
        font-family: Inter, ui-sans-serif;
    }

    .modal-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 1.5rem 2rem;
        border-bottom: 1px solid #e0e0e0;
    }

    .modal-header h2 {
        margin: 0;
        color: #333;
        font-size: 1.25rem;
        font-weight: 600;
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
        padding: 2rem;
    }

    .setting-group {
        margin-bottom: 1.5rem;
    }

    .setting-group label {
        display: block;
        margin-bottom: 0.5rem;
        font-weight: 600;
        color: #333;
        font-size: 0.9rem;
    }

    .setting-group textarea {
        width: 100%;
        border: 2px solid #e0e0e0;
        border-radius: 8px;
        padding: 0.75rem;
        font-family: "Monaco", "Menlo", "Ubuntu Mono", monospace;
        font-size: 0.9rem;
        resize: vertical;
        min-height: 120px;
        outline: none;
        box-sizing: border-box;
    }

    .setting-group textarea:focus {
        border-color: #667eea;
    }

    .modal-footer {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 1.5rem 2rem;
        border-top: 1px solid #e0e0e0;
        background: #f9f9f9;
        border-radius: 0 0 12px 12px;
    }

    .footer-right {
        display: flex;
        gap: 1rem;
    }

    .cancel-button,
    .save-button,
    .reset-button {
        padding: 0.5rem 1.5rem;
        border: none;
        border-radius: 8px;
        font-weight: 600;
        cursor: pointer;
        font-size: 0.9rem;
    }

    .cancel-button {
        background: #f5f5f5;
        color: #666;
    }

    .cancel-button:hover {
        background: #e0e0e0;
    }

    .save-button {
        background: #667eea;
        color: white;
    }

    .save-button:hover {
        background: #5a67d8;
    }

    .reset-button {
        background: #f8f9fa;
        color: #dc3545;
        border: 1px solid #dc3545;
    }

    .reset-button:hover {
        background: #dc3545;
        color: white;
    }
</style>
