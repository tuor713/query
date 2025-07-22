<script>
    let { savedQueries = [], currentQueryName = "", onQuerySelected, isCollapsed = false, onToggle } = $props();
</script>

<div class="sidebar" class:collapsed={isCollapsed} id="sidebar">
    <h2>
        <span class="icon">📚</span><span class="label">Saved Queries</span>
        <button
            class="toggle-btn"
            onclick={onToggle}
            title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
            {isCollapsed ? "▶" : "◀"}
        </button>
    </h2>
    <ul>
        {#each savedQueries as query}
            <li>
                <button onclick={() => onQuerySelected(query)} class="query-button">
                    <span
                        class={query.name === currentQueryName
                            ? "label selected"
                            : "label"}
                    >
                        {query.name}
                    </span>
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
        width: 100%;
        text-align: left;
        font: inherit;
    }

    .sidebar ul li .query-button:hover {
        background-color: #ddd;
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
