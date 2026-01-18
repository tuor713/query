<script>
    let {
        tabs = $bindable([]),
        activeTabId = $bindable(0),
        editorCollapsed = false,
        children,
        collapseButton,
    } = $props();

    function addTab() {
        const newId = Math.max(...tabs.map((t) => t.id), 0) + 1;
        const newTab = {
            id: newId,
            name: `Query ${newId}`,
            query: "",
            queryName: "",
            selection: "",
            limit: 100000,
            language: "sql",
            keepView: false,
            editorCollapsed: false,
            display: "perspective",
            perspectiveConfig: {
                columns: [],
                plugin: "datagrid",
                plugin_config: { edit_mode: "EDIT" },
            },
            error: "",
            lastQueryTime: 0,
            executing: false,
        };
        tabs = [...tabs, newTab];
        activeTabId = newId;
    }

    function closeTab(tabId) {
        if (tabs.length === 1) return; // Don't close the last tab

        tabs = tabs.filter((t) => t.id !== tabId);

        // If we closed the active tab, switch to the first remaining tab
        if (activeTabId === tabId && tabs.length > 0) {
            activeTabId = tabs[0].id;
        }
    }

    function updateTabName(tabId, newName) {
        tabs = tabs.map((tab) =>
            tab.id === tabId ? { ...tab, name: newName } : tab,
        );
    }

    // Initialize with one tab if empty
    if (tabs.length === 0) {
        addTab();
    }
</script>

<div class="tab-container">
    {#if !editorCollapsed}
        <div class="tab-bar">
            {#each tabs as tab (tab.id)}
                <div
                    class="tab {activeTabId === tab.id ? 'active' : ''}"
                    onclick={() => (activeTabId = tab.id)}
                >
                    <input
                        type="text"
                        bind:value={tab.name}
                        size={Math.min(tab.name.length, 20)}
                        onblur={(e) => updateTabName(tab.id, e.target.value)}
                        class="tab-name-input"
                    />
                    {#if tabs.length > 1}
                        <button
                            class="close-btn"
                            onclick={(e) => {
                                e.stopPropagation();
                                closeTab(tab.id);
                            }}
                        >
                            ×
                        </button>
                    {/if}
                </div>
            {/each}
            <button class="add-tab-btn" onclick={addTab}>+</button>
            <div class="collapse-button-wrapper">
                {@render collapseButton()}
            </div>
        </div>
    {/if}

    <div class="tab-content">
        {@render children()}
    </div>
</div>

<style>
    .tab-container {
        display: flex;
        flex-direction: column;
        height: 100%;
    }

    .tab-bar {
        display: flex;
        background: #fff;
        gap: 2px;
        align-items: center;
    }

    .collapse-button-wrapper {
        margin-left: auto;
    }

    .tab {
        display: flex;
        align-items: center;
        padding: 2px 10px;
        background: #f1f1f1;
        border: 1px solid #ccc;
        border-bottom: none;
        cursor: pointer;
        border-radius: 4px 4px 0 0;
    }

    .tab.active {
        background: white;
        border-bottom: 1px solid white;
        position: relative;
        z-index: 1;
    }

    .tab-name-input {
        background: transparent;
        border: none;
        outline: none;
        font-size: 14px;
    }

    .close-btn {
        background: none;
        border: none;
        font-size: 16px;
        cursor: pointer;
        padding: 0;
        width: 20px;
        height: 20px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 50%;
    }

    .close-btn:hover {
        background: #ff6b6b;
        color: white;
    }

    .add-tab-btn {
        padding: 2px 10px;
        background: #f1f1f1;
        border: 1px solid #ccc;
        border-bottom: none;
        cursor: pointer;
        border-radius: 4px 4px 0 0;
        font-size: 16px;
    }

    .add-tab-btn:hover {
        background: #d0d0d0;
    }

    .tab-content {
        flex: 1;
        display: flex;
        flex-direction: column;
    }
</style>
