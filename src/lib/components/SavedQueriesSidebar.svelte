<script>
    import {
        Book,
        X,
        FolderPlus,
        Pencil,
        Folder,
        FolderOpen,
    } from "@lucide/svelte";

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

    let expandedFolders = $state(new Set());
    let editingFolderId = $state(null);
    let editingFolderName = $state("");
    let draggedQuery = $state(null);
    let dragOverTarget = $state(null);

    // Queries not in any folder
    let topLevelQueries = $derived(
        savedQueries
            .filter((q) => !q.folderId)
            .sort((a, b) => a.name.localeCompare(b.name)),
    );

    // Queries grouped by folder
    function getQueriesInFolder(folderId) {
        return savedQueries
            .filter((q) => q.folderId === folderId)
            .sort((a, b) => a.name.localeCompare(b.name));
    }

    function toggleFolder(folderId) {
        if (expandedFolders.has(folderId)) {
            expandedFolders.delete(folderId);
        } else {
            expandedFolders.add(folderId);
        }
        expandedFolders = new Set(expandedFolders);
    }

    function createFolder() {
        const newFolder = {
            id: crypto.randomUUID(),
            name: "",
        };
        const updatedFolders = [...folders, newFolder];
        onFoldersChanged(updatedFolders);
        editingFolderId = newFolder.id;
        editingFolderName = "";
        expandedFolders.add(newFolder.id);
        expandedFolders = new Set(expandedFolders);
    }

    function startEditingFolder(folder, e) {
        e.stopPropagation();
        editingFolderId = folder.id;
        editingFolderName = folder.name;
    }

    function saveFolderName() {
        if (editingFolderId && editingFolderName.trim()) {
            const updatedFolders = folders.map((f) =>
                f.id === editingFolderId
                    ? { ...f, name: editingFolderName.trim() }
                    : f,
            );
            onFoldersChanged(updatedFolders);
        } else if (editingFolderId && !editingFolderName.trim()) {
            // Remove folder if name is empty (cancelled creation)
            const updatedFolders = folders.filter(
                (f) => f.id !== editingFolderId,
            );
            onFoldersChanged(updatedFolders);
        }
        editingFolderId = null;
        editingFolderName = "";
    }

    function handleFolderKeydown(e) {
        if (e.key === "Enter") {
            saveFolderName();
        } else if (e.key === "Escape") {
            // Cancel editing - remove if new folder with no name
            const folder = folders.find((f) => f.id === editingFolderId);
            if (folder && !folder.name) {
                const updatedFolders = folders.filter(
                    (f) => f.id !== editingFolderId,
                );
                onFoldersChanged(updatedFolders);
            }
            editingFolderId = null;
            editingFolderName = "";
        }
    }

    function deleteFolder(folderId, e) {
        e.stopPropagation();
        // Move all queries in folder to top level before deleting
        const queriesInFolder = savedQueries.filter(
            (q) => q.folderId === folderId,
        );
        queriesInFolder.forEach((q) => {
            onQueryMoved(q.name, null);
        });
        const updatedFolders = folders.filter((f) => f.id !== folderId);
        onFoldersChanged(updatedFolders);
    }

    // Drag and drop handlers
    function handleDragStart(e, query) {
        draggedQuery = query;
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", query.name);
    }

    function handleDragEnd() {
        draggedQuery = null;
        dragOverTarget = null;
    }

    function handleDragOver(e, targetId) {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        dragOverTarget = targetId;
    }

    function handleDragLeave() {
        dragOverTarget = null;
    }

    function handleDrop(e, targetFolderId) {
        e.preventDefault();
        if (draggedQuery) {
            onQueryMoved(draggedQuery.name, targetFolderId);
        }
        draggedQuery = null;
        dragOverTarget = null;
    }
</script>

<div class="sidebar" class:collapsed={isCollapsed} id="sidebar">
    <h3>
        {#if isCollapsed}
            <Book onclick={onToggle} />
        {:else}
            <Book />
            <span class="label">Saved Queries</span>
            <button
                class="icon-btn"
                onclick={createFolder}
                title="Create folder"
            >
                <FolderPlus size="16" />
            </button>
            <button
                class="toggle-btn"
                onclick={onToggle}
                title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
                <X />
            </button>
        {/if}
    </h3>

    <ul>
        <!-- Folders -->
        {#each [...folders].sort( (a, b) => a.name.localeCompare(b.name), ) as folder}
            <li class="folder-item">
                <!-- svelte-ignore a11y_no_static_element_interactions -->
                <!-- svelte-ignore a11y_click_events_have_key_events -->
                <div
                    class="folder-header"
                    class:drag-over={dragOverTarget === folder.id}
                    ondragover={(e) => handleDragOver(e, folder.id)}
                    ondragleave={handleDragLeave}
                    ondrop={(e) => handleDrop(e, folder.id)}
                >
                    <button
                        class="folder-label"
                        onclick={() => toggleFolder(folder.id)}
                    >
                        <span class="folder-icon">
                            {#if expandedFolders.has(folder.id)}
                                <FolderOpen size="14" />
                            {:else}
                                <Folder size="14" />
                            {/if}
                        </span>
                        {#if editingFolderId === folder.id}
                            <!-- svelte-ignore a11y_autofocus -->
                            <input
                                type="text"
                                class="folder-name-input"
                                bind:value={editingFolderName}
                                onblur={saveFolderName}
                                onkeydown={handleFolderKeydown}
                                onclick={(e) => e.stopPropagation()}
                                autofocus
                                placeholder="Folder name"
                            />
                        {:else}
                            <span class="folder-name"
                                >{folder.name || "Untitled"}</span
                            >
                        {/if}
                    </button>
                    <div class="folder-actions">
                        <button
                            class="icon-btn small"
                            onclick={(e) => startEditingFolder(folder, e)}
                            title="Rename folder"
                        >
                            <Pencil size="14" />
                        </button>
                        <button
                            class="icon-btn small delete"
                            onclick={(e) => deleteFolder(folder.id, e)}
                            title="Delete folder"
                        >
                            <X size="14" />
                        </button>
                    </div>
                </div>
                {#if expandedFolders.has(folder.id)}
                    <ul class="folder-contents">
                        {#each getQueriesInFolder(folder.id) as query}
                            <li
                                class="query-item"
                                draggable="true"
                                ondragstart={(e) => handleDragStart(e, query)}
                                ondragend={handleDragEnd}
                            >
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
                        {#if getQueriesInFolder(folder.id).length === 0}
                            <li class="empty-folder">Drop queries here</li>
                        {/if}
                    </ul>
                {/if}
            </li>
        {/each}

        <!-- Top-level drop zone -->
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <li
            class="top-level-zone"
            class:drag-over={dragOverTarget === "top-level"}
            ondragover={(e) => handleDragOver(e, "top-level")}
            ondragleave={handleDragLeave}
            ondrop={(e) => handleDrop(e, null)}
        >
            <!-- Top-level queries -->
            {#each topLevelQueries as query}
                <div
                    class="query-item"
                    draggable="true"
                    ondragstart={(e) => handleDragStart(e, query)}
                    ondragend={handleDragEnd}
                >
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
                </div>
            {/each}
        </li>
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
        overflow-y: auto;
    }

    .sidebar.collapsed {
        width: 25px;
        min-width: 25px;
        padding: 20px 5px;
    }

    .sidebar.collapsed .label {
        display: none;
    }

    .sidebar.collapsed ul {
        display: none;
    }

    .sidebar.collapsed .icon-btn {
        display: none;
    }

    .sidebar * {
        margin: 0;
        padding: 0;
        box-sizing: border-box;
    }

    .sidebar h3 {
        margin-bottom: 20px;
        white-space: nowrap;
        display: flex;
        justify-content: flex-start;
        align-items: center;
        gap: 8px;
    }

    .sidebar h3 .toggle-btn {
        margin-left: auto;
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

    .sidebar ul li .query-button,
    .sidebar .query-item .query-button {
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

    .sidebar ul li .query-button:hover,
    .sidebar .query-item .query-button:hover {
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
        transition:
            opacity 0.3s,
            background-color 0.2s;
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

    .icon-btn {
        background: none;
        border: none;
        cursor: pointer;
        padding: 4px;
        border-radius: 4px;
        color: #666;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: background-color 0.2s;
    }

    .icon-btn:hover {
        background-color: #ddd;
        color: #333;
    }

    .icon-btn.small {
        padding: 2px;
        opacity: 0;
    }

    .folder-header:hover .icon-btn.small {
        opacity: 1;
    }

    .icon-btn.small:hover {
        background-color: #ddd;
        color: #333;
    }

    .icon-btn.small.delete:hover {
        background-color: #ddd;
        color: #d32f2f;
    }

    .folder-item {
        margin-bottom: 4px;
    }

    .folder-header {
        display: flex;
        align-items: center;
        gap: 4px;
    }

    .folder-label {
        display: flex;
        align-items: center;
        gap: 4px;
        flex: 1;
        background: none;
        border: none;
        padding: 4px 5px;
        border-radius: 4px;
        cursor: pointer;
        font: inherit;
        text-align: left;
        transition: background-color 0.3s;
    }

    .folder-label:hover {
        background-color: #ddd;
    }

    .folder-header.drag-over {
        background-color: #d0d0ff;
        outline: 2px dashed #667eea;
    }

    .folder-icon {
        display: flex;
        align-items: center;
        color: #666;
    }

    .folder-name {
        flex: 1;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    .folder-name-input {
        flex: 1;
        border: 1px solid #667eea;
        border-radius: 2px;
        padding: 2px 4px;
        font: inherit;
        font-size: 0.9em;
        outline: none;
    }

    .folder-actions {
        display: flex;
        gap: 2px;
        margin-left: auto;
    }

    .folder-contents {
        margin-left: 20px;
        padding-left: 8px;
        border-left: 1px solid #ddd;
    }

    .empty-folder {
        color: #999;
        font-style: italic;
        font-size: 0.85em;
        padding: 4px 8px;
    }

    .top-level-zone {
        min-height: 20px;
        padding: 4px 0;
        border-radius: 4px;
        transition: background-color 0.2s;
    }

    .top-level-zone.drag-over {
        background-color: #d0d0ff;
        outline: 2px dashed #667eea;
    }

    .query-item[draggable="true"] {
        cursor: grab;
    }

    .query-item[draggable="true"]:active {
        cursor: grabbing;
    }
</style>
