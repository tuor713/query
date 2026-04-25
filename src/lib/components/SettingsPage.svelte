<script>
    let {
        systemPrompt = "",
        maxTurns = 10,
        defaultLanguage = "sql",
        onSave = () => {},
        onCancel = () => {},
        getDefaultPrompt = () => "",
    } = $props();

    let tempSystemPrompt = $state(systemPrompt);
    let tempMaxTurns = $state(maxTurns);
    let tempDefaultLanguage = $state(defaultLanguage);

    function handleSave() {
        onSave({
            systemPrompt: tempSystemPrompt,
            maxTurns: Math.max(1, Math.min(50, Number(tempMaxTurns) || 10)),
            defaultLanguage: tempDefaultLanguage,
        });
    }

    function handleResetPrompt() {
        tempSystemPrompt = getDefaultPrompt();
    }
</script>

<div class="settings-page">
    <div class="settings-header">
        <h2>Settings</h2>
        <div class="header-actions">
            <button class="cancel-button" onclick={onCancel}>Cancel</button>
            <button class="save-button" onclick={handleSave}>Save</button>
        </div>
    </div>

    <div class="settings-body">
        <section class="settings-section">
            <h3>Data Explorer</h3>
            <div class="setting-group">
                <label for="default-language">Default query language for new tabs</label>
                <select id="default-language" bind:value={tempDefaultLanguage}>
                    <option value="sql">SQL</option>
                    <option value="malloy">Malloy</option>
                    <option value="saneql">SaneQL</option>
                </select>
            </div>
        </section>

        <section class="settings-section">
            <h3>AI Chat</h3>
            <div class="setting-group">
                <label for="max-turns">Max agentic turns per conversation</label>
                <input
                    id="max-turns"
                    type="number"
                    min="1"
                    max="50"
                    bind:value={tempMaxTurns}
                />
                <span class="hint">Number of AI reasoning steps before stopping (default: 10)</span>
            </div>
            <div class="setting-group">
                <div class="label-row">
                    <label for="system-prompt">System prompt</label>
                    <button class="reset-button" onclick={handleResetPrompt}>
                        Reset to default
                    </button>
                </div>
                <textarea
                    id="system-prompt"
                    bind:value={tempSystemPrompt}
                    placeholder="Enter custom system prompt..."
                    rows="20"
                ></textarea>
            </div>
        </section>
    </div>
</div>

<style>
    .settings-page {
        display: flex;
        flex-direction: column;
        height: 100%;
        font-family: Inter, ui-sans-serif;
        background: #fafafa;
    }

    .settings-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 1.25rem 2rem;
        background: white;
        border-bottom: 1px solid #e0e0e0;
        flex-shrink: 0;
    }

    .settings-header h2 {
        margin: 0;
        font-size: 1.1rem;
        font-weight: 600;
        color: #333;
    }

    .header-actions {
        display: flex;
        gap: 0.75rem;
    }

    .settings-body {
        flex: 1;
        overflow-y: auto;
        padding: 2rem;
        max-width: 800px;
    }

    .settings-section {
        margin-bottom: 2.5rem;
    }

    .settings-section h3 {
        margin: 0 0 1.25rem 0;
        font-size: 0.95rem;
        font-weight: 600;
        color: #555;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        padding-bottom: 0.5rem;
        border-bottom: 1px solid #e8e8e8;
    }

    .setting-group {
        margin-bottom: 1.5rem;
    }

    .setting-group:last-child {
        margin-bottom: 0;
    }

    .setting-group label {
        display: block;
        margin-bottom: 0.4rem;
        font-weight: 500;
        color: #333;
        font-size: 0.875rem;
    }

    .label-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 0.4rem;
    }

    .label-row label {
        margin-bottom: 0;
    }

    .setting-group select {
        width: 200px;
        padding: 0.45rem 0.65rem;
        border: 1.5px solid #d0d0d0;
        border-radius: 6px;
        font-size: 0.9rem;
        outline: none;
        background: white;
    }

    .setting-group select:focus {
        border-color: #667eea;
    }

    .setting-group input[type="number"] {
        width: 80px;
        padding: 0.45rem 0.65rem;
        border: 1.5px solid #d0d0d0;
        border-radius: 6px;
        font-size: 0.9rem;
        outline: none;
    }

    .setting-group input[type="number"]:focus {
        border-color: #667eea;
    }

    .hint {
        display: block;
        margin-top: 0.35rem;
        font-size: 0.8rem;
        color: #999;
    }

    .setting-group textarea {
        width: 100%;
        border: 1.5px solid #d0d0d0;
        border-radius: 8px;
        padding: 0.75rem;
        font-family: "Monaco", "Menlo", "Ubuntu Mono", monospace;
        font-size: 0.85rem;
        resize: vertical;
        min-height: 120px;
        outline: none;
        box-sizing: border-box;
        background: white;
    }

    .setting-group textarea:focus {
        border-color: #667eea;
    }

    .cancel-button,
    .save-button,
    .reset-button {
        padding: 0.4rem 1.1rem;
        border: none;
        border-radius: 6px;
        font-weight: 600;
        cursor: pointer;
        font-size: 0.875rem;
    }

    .cancel-button {
        background: #f5f5f5;
        color: #555;
    }

    .cancel-button:hover {
        background: #e8e8e8;
    }

    .save-button {
        background: #667eea;
        color: white;
    }

    .save-button:hover {
        background: #5a67d8;
    }

    .reset-button {
        background: transparent;
        color: #dc3545;
        border: 1px solid #dc3545;
        padding: 0.25rem 0.75rem;
        font-size: 0.8rem;
    }

    .reset-button:hover {
        background: #dc3545;
        color: white;
    }
</style>
