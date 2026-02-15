<script>
    import { AlertTriangle, X } from "@lucide/svelte";

    let {
        isOpen = $bindable(false),
        disclaimerText = "DISCLAIMER — AI can make mistakes, always check the results.",
        onAcknowledge = () => {},
    } = $props();

    function acknowledge() {
        onAcknowledge();
        isOpen = false;
    }

    function handleKeyDown(e) {
        if (e.key === "Escape") {
            acknowledge();
        }
    }
</script>

<svelte:window on:keydown={handleKeyDown} />

{#if isOpen}
    <div class="modal-overlay">
        <div class="modal-content" onclick={(e) => e.stopPropagation()}>
            <div class="modal-header">
                <h2><AlertTriangle size={20} /> Disclaimer</h2>
                <button class="close-button" onclick={acknowledge}>
                    <X size={20} />
                </button>
            </div>

            <div class="modal-body">
                <p class="disclaimer-text">
                    {disclaimerText}
                </p>
            </div>

            <div class="modal-footer">
                <button class="acknowledge-button" onclick={acknowledge}>
                    Acknowledge
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
        max-width: 500px;
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
        display: flex;
        align-items: center;
        gap: 0.5rem;
        color: #e6a817;
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
        text-align: center;
    }

    .disclaimer-text {
        font-size: 1.05rem;
        color: #333;
        line-height: 1.6;
        margin: 0;
    }

    .modal-footer {
        display: flex;
        justify-content: center;
        padding: 1.5rem 2rem;
        border-top: 1px solid #e0e0e0;
        background: #f9f9f9;
        border-radius: 0 0 12px 12px;
    }

    .acknowledge-button {
        padding: 0.5rem 2rem;
        border: none;
        border-radius: 8px;
        font-weight: 600;
        cursor: pointer;
        font-size: 0.9rem;
        background: #667eea;
        color: white;
    }

    .acknowledge-button:hover {
        background: #5a67d8;
    }
</style>
