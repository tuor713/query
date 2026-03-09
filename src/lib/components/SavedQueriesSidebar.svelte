<script>
    import SavedItemsSidebar from "./SavedItemsSidebar.svelte";

    let {
        savedQueries = [],
        folders = [],
        currentQueryName = "",
        onQuerySelected,
        onQueryDeleted,
        onFoldersChanged,
        onQueryMoved,
        isCollapsed = false,
        onToggle,
    } = $props();
</script>

<SavedItemsSidebar
    items={savedQueries}
    {folders}
    currentItemName={currentQueryName}
    title="Saved Queries"
    onItemSelected={onQuerySelected}
    onItemDeleted={onQueryDeleted}
    {onFoldersChanged}
    onItemMoved={onQueryMoved}
    {isCollapsed}
    {onToggle}
/>
