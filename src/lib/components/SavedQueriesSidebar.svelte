<script>
    import { Book, X } from "@lucide/svelte";

    let {
        savedQueries = [],
        currentQueryName = "",
        onQuerySelected,
        onQueryDeleted,
        isCollapsed = false,
        onToggle,
    } = $props();
</script>

<div class="sidebar" class:collapsed={isCollapsed} id="sidebar">
    <h2>
        {#if isCollapsed}
            <Book onclick={onToggle} />
        {:else}
            <Book />
            <span class="label">Saved Queries</span>
            <button
                class="toggle-btn"
                onclick={onToggle}
                title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
                <X />
            </button>
        {/if}
    </h2>
    <ul>
        {#each savedQueries as query}
            <li class="query-item">
                <button
                    onclick={() => onQuerySelected(query)}
                    class="query-button"
                >
                    <span
                        class={query.name === currentQueryName
                            ? "label selected"
                            : "label"}
                    >
                        {query.name}
                    </span>
                </button>
                <button
                    class="delete-button"
                    onclick={(e) => {
                        e.stopPropagation();
                        onQueryDeleted(query.name);
                    }}
                    title="Delete query"
                >
                    <X size="14" />
                </button>
            </li>
        {/each}
    </ul>
</div>

<style>
    /* Sidebar styles */
    .sidebar {
        width: 250px;
        min-width: 250px;
        background-color: #f1f1f1;
        font-family: Inter, ui-sans-serif;
        color: #3c3c3c;
        padding: 20px;
        transition: all 0.3s ease;
        overflow-x: hidden;
    }

    .sidebar.collapsed {
        width: 25px;
        min-width: 25px;
        padding: 20px 5px;
    }

    .sidebar.collapsed .label,
    .sidebar.collapsed .icon {
        display: none;
    }

    .sidebar.collapsed ul {
        display: none;
    }

    .sidebar * {
        margin: 0;
        padding: 0;
        box-sizing: border-box;
    }

    .sidebar h2 {
        margin-bottom: 20px;
        white-space: nowrap;
        display: flex;
        justify-content: space-between;
        align-items: center;
    }

    .sidebar ul {
        list-style-type: none;
    }

    .sidebar .selected {
        font-weight: bold;
    }

    .query-item {
        position: relative;
        display: flex;
        align-items: center;
        gap: 4px;
    }

    .sidebar ul li .query-button {
        background: none;
        border: none;
        text-decoration: none;
        color: #333;
        display: block;
        padding: 4px 5px;
        border-radius: 4px;
        transition: background-color 0.3s;
        cursor: pointer;
        flex: 1;
        text-align: left;
        font: inherit;
    }

    .sidebar ul li .query-button:hover {
        background-color: #ddd;
    }

    .delete-button {
        background: none;
        border: none;
        cursor: pointer;
        padding: 2px;
        border-radius: 2px;
        color: #666;
        opacity: 0;
        transition: opacity 0.3s, background-color 0.2s;
        flex-shrink: 0;
        display: flex;
        align-items: center;
        justify-content: center;
    }

    .query-item:hover .delete-button {
        opacity: 1;
    }

    .delete-button:hover {
        background-color: #ddd;
        color: #d32f2f;
    }

    .toggle-btn {
        background: none;
        border: none;
        font-size: 16px;
        cursor: pointer;
        padding: 2px;
        border-radius: 2px;
        transition: background-color 0.2s;
        flex-shrink: 0;
    }

    .toggle-btn:hover {
        background-color: #ddd;
    }
</style>
