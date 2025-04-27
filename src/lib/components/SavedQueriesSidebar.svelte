<script>
    export let savedQueries = [];
    export let currentQueryName = "";
    export let onQuerySelected;
</script>

<div class="sidebar" id="sidebar">
    <h2>
        <span class="icon">📚</span><span class="label">Saved Queries</span>
    </h2>
    <ul>
        {#each savedQueries as query}
            <li>
                <a on:click={() => onQuerySelected(query)}>
                    <span class={query.name === currentQueryName ? "label selected" : "label"}>
                        {query.name}
                    </span>
                </a>
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

    .sidebar * {
        margin: 0;
        padding: 0;
        box-sizing: border-box;
    }

    .sidebar h2 {
        margin-bottom: 20px;
        white-space: nowrap;
    }

    .sidebar ul {
        list-style-type: none;
    }

    .sidebar .selected {
        font-weight: bold;
    }

    .sidebar ul li a {
        text-decoration: none;
        color: #333;
        display: block;
        padding: 4px 5px;
        border-radius: 4px;
        transition: background-color 0.3s;
        cursor: pointer;
    }

    .sidebar ul li a:hover {
        background-color: #ddd;
    }
</style>