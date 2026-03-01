<script>
    import { onMount } from "svelte";
    import {
        // Services
        initializePerspective,
        QueryService,
        StorageService,
        AIService,
        loadConfig,
        getConfig,

        // Config
        getDefaultEnvironment,
        runMalloyQuery,

        // Components
        LoginComponent,
        SavedQueriesSidebar,
        QueryEditor,
        QueryControls,
        ErrorDisplay,
        ResultViewer,
        MosaicViewer,
        TabContainer,
        ChatComponent,
        DashboardView,
    } from "$lib";

    import { MalloyRenderer } from "@malloydata/render";
    import { API } from "@malloydata/malloy";
    import {
        Bot,
        Database,
        ChevronDown,
        ChevronRight,
        LogOut,
        LayoutDashboard,
    } from "@lucide/svelte";
    // required patch in wvlet package to resolve package.json issue
    import { WvletCompiler } from "@wvlet/wvlet";

    const VERSION = "0.0.20";

    let backendUrl = window.location.origin;
    if (import.meta.env.DEV) {
        console.log("*** DEV MODE ***");
        backendUrl = "http://localhost:8888";
    }

    // Services
    const storageService = new StorageService();
    const queryService = new QueryService(backendUrl);
    const aiService = new AIService(backendUrl);

    // State
    let username = $state(storageService.getUsername());
    let password = $state("");
    let extraCredentials = $state([]);
    let loggedIn = $state(false);
    let savedQueries = $state(storageService.getSavedQueries());
    let selectedEnvironment = $state(
        storageService.getEnvironment() || getDefaultEnvironment(),
    );
    let sidebarCollapsed = $state(false);
    let folders = $state(storageService.getFolders());

    // Initialize query from URL or local storage
    const urlParams = new URLSearchParams(window.location.search);
    const queryParam = urlParams.get("query");
    const viewParam = urlParams.get("view");
    const viewModeParam = urlParams.get("viewMode");

    // Initialize activeView from URL parameter or default to "query"
    let activeView = $state(
        viewModeParam === "query" || viewModeParam === "chat" || viewModeParam === "dashboard"
            ? viewModeParam
            : "query",
    ); // "query", "chat", or "dashboard"
    let showDisclaimer = $state(true);

    // Parse view parameter if present
    let initialTabData = {
        query: queryParam ?? storageService.getQuery() ?? "",
        queryName: "",
        limit: 100000,
        perspectiveConfig: {
            columns: [],
            plugin: "datagrid",
            plugin_config: { edit_mode: "EDIT" },
        },
        mosaicSpec: null,
        language: storageService.getLanguage(),
        display: "perspective",
        editorCollapsed: false,
    };

    if (viewParam) {
        try {
            const viewData = JSON.parse(atob(viewParam));
            initialTabData = {
                query: viewData.query || initialTabData.query,
                queryName: viewData.queryName || initialTabData.queryName,
                limit: viewData.limit || initialTabData.limit,
                perspectiveConfig:
                    viewData.perspectiveConfig ||
                    initialTabData.perspectiveConfig,
                mosaicSpec: viewData.mosaicSpec || initialTabData.mosaicSpec,
                language: viewData.language || initialTabData.language,
                display: viewData.display || initialTabData.display,
                editorCollapsed:
                    viewData.editorCollapsed ?? initialTabData.editorCollapsed,
            };
        } catch (error) {
            console.error("Failed to parse view parameter:", error);
        }
    }

    // Tab management — restore full workspace if no URL params override
    const savedWorkspace =
        !queryParam && !viewParam ? storageService.getWorkspace() : null;
    let tabs = $state(
        savedWorkspace
            ? savedWorkspace.tabs.map((t) => ({
                  ...t,
                  selection: "",
                  error: "",
                  lastQueryTime: 0,
                  executing: false,
                  resultViewerComponent: null,
              }))
            : [
                  {
                      id: 1,
                      name: "Query 1",
                      query: initialTabData.query,
                      queryName: initialTabData.queryName,
                      selection: "",
                      limit: initialTabData.limit,
                      keepView: false,
                      editorCollapsed: initialTabData.editorCollapsed,
                      perspectiveConfig: initialTabData.perspectiveConfig,
                      mosaicSpec: initialTabData.mosaicSpec,
                      error: "",
                      language: initialTabData.language,
                      display: initialTabData.display,
                      lastQueryTime: 0,
                      executing: false,
                      resultViewerComponent: null,
                  },
              ],
    );
    let activeTabId = $state(savedWorkspace ? savedWorkspace.activeTabId : 1);

    // Get current active tab
    function getActiveTab() {
        return tabs.find((t) => t.id === activeTabId);
    }

    function setEditorCollapsed(value) {
        const tab = getActiveTab();
        if (tab) {
            tab.editorCollapsed = value;
            tabs = [...tabs];
        }
    }

    // Persist workspace whenever tabs or activeTabId change
    $effect(() => {
        console.log("Persisting workspace");
        storageService.saveWorkspace(tabs, activeTabId);
    });

    let configLoaded = $state(false);

    onMount(async () => {
        await loadConfig(backendUrl);
        configLoaded = true;
        await initializePerspective();
    });

    function handleKeyDown(e) {
        if (e.ctrlKey && e.key === "Enter" && loggedIn) {
            e.preventDefault();
            execute();
        }
    }

    function doLogin(usernameInput, passwordInput, extraCredentialsInput = []) {
        username = usernameInput;
        password = passwordInput;
        extraCredentials = extraCredentialsInput;
        loggedIn = true;
        storageService.saveUsername(username);
    }

    function loadSavedQuery(toLoad) {
        const activeTab = getActiveTab();
        if (activeTab) {
            activeTab.queryName = toLoad.name;
            activeTab.query = toLoad.query;
            activeTab.perspectiveConfig = toLoad.perspectiveConfig ?? {
                columns: [],
                plugin: "datagrid",
                plugin_config: { edit_mode: "EDIT" },
            };
            activeTab.mosaicSpec = toLoad.mosaicSpec ?? null;
            activeTab.display = toLoad.display ?? "perspective";
            activeTab.language = toLoad.language ?? "sql";
            activeTab.limit = toLoad.limit ?? 100000;
            activeTab.editorCollapsed = toLoad.editorCollapsed ?? false;
            tabs = [...tabs]; // Trigger reactivity
        }
    }

    function deleteSavedQuery(queryName) {
        savedQueries = savedQueries.filter((q) => q.name !== queryName);
        storageService.saveSavedQueries(savedQueries);
    }

    async function saveQuery() {
        const activeTab = getActiveTab();
        if (!activeTab) return;

        let perspectiveConfig = activeTab.perspectiveConfig;
        let mosaicSpec = activeTab.mosaicSpec;

        if (activeTab.display === "perspective") {
            perspectiveConfig =
                await activeTab.resultViewerComponent.saveViewerConfig();
        } else if (activeTab.display === "mosaic") {
            mosaicSpec = activeTab.resultViewerComponent.getSpec();
        }

        const existingQuery = savedQueries.find(
            (q) => q.name === activeTab.queryName,
        );
        const newQuery = {
            name: activeTab.queryName,
            query: activeTab.query,
            perspectiveConfig,
            mosaicSpec,
            language: activeTab.language,
            display: activeTab.display,
            limit: activeTab.limit,
            editorCollapsed: activeTab.editorCollapsed,
            ...(existingQuery?.folderId
                ? { folderId: existingQuery.folderId }
                : {}),
        };

        savedQueries = savedQueries
            .filter((q) => q.name !== activeTab.queryName)
            .concat(newQuery)
            .sort((a, b) => a.name.localeCompare(b.name));

        storageService.saveSavedQueries(savedQueries);
    }

    async function resetQuery() {
        const activeTab = getActiveTab();
        if (activeTab) {
            activeTab.query = "";
            activeTab.queryName = "";
            activeTab.perspectiveConfig = {
                columns: [],
                plugin: "datagrid",
                plugin_config: { edit_mode: "EDIT" },
            };
            activeTab.mosaicSpec = null;

            if (activeTab.resultViewerComponent?.clearData) {
                await activeTab.resultViewerComponent.clearData();
            }
            tabs = [...tabs]; // Trigger reactivity
        }
    }

    function handleEnvironmentChange(newEnvironment) {
        selectedEnvironment = newEnvironment;
        storageService.saveEnvironment(selectedEnvironment);
    }

    function toggleSidebar() {
        sidebarCollapsed = !sidebarCollapsed;
    }

    function handleFoldersChanged(updatedFolders) {
        folders = updatedFolders;
        storageService.saveFolders(folders);
    }

    function handleQueryMoved(queryName, targetFolderId) {
        savedQueries = savedQueries.map((q) =>
            q.name === queryName ? { ...q, folderId: targetFolderId } : q,
        );
        storageService.saveSavedQueries(savedQueries);
    }

    async function copyURL() {
        const activeTab = getActiveTab();
        if (!activeTab) return;

        try {
            let perspectiveConfig = activeTab.perspectiveConfig;
            let mosaicSpec = activeTab.mosaicSpec;

            if (activeTab.display === "perspective") {
                perspectiveConfig =
                    await activeTab.resultViewerComponent.saveViewerConfig();
            } else if (activeTab.display === "mosaic") {
                mosaicSpec = activeTab.resultViewerComponent.getSpec();
            }

            const viewData = {
                query: activeTab.query,
                perspectiveConfig,
                mosaicSpec,
                language: activeTab.language,
                display: activeTab.display,
                limit: activeTab.limit,
                queryName: activeTab.queryName,
                editorCollapsed: activeTab.editorCollapsed,
            };

            const encodedView = btoa(JSON.stringify(viewData));
            const currentUrl = new URL(window.location.href);
            currentUrl.searchParams.set("view", encodedView);

            await navigator.clipboard.writeText(currentUrl.toString());
            console.log("URL copied to clipboard");
        } catch (error) {
            console.error("Failed to copy URL:", error);
        }
    }

    async function execute() {
        const activeTab = getActiveTab();
        if (!activeTab) {
            console.warn("No active tab", activeTabId);
            return;
        }

        console.log("Executing query", activeTab.query);
        console.log("Executing language", activeTab.language);

        let queryToExecute = activeTab.query;
        if (activeTab.selection && activeTab.selection.length > 0) {
            queryToExecute = activeTab.selection;
        }

        activeTab.error = "";
        activeTab.executing = true;
        activeTab.lastQueryTime = 0;
        const start = performance.now();

        const refreshTimer = setInterval(() => {
            activeTab.lastQueryTime = performance.now() - start;
            tabs = [...tabs]; // Trigger reactivity
        }, 100);

        if (activeTab.language === "sql") {
            var result = null;
            var error = null;
            try {
                result = await queryService.executeQuery(
                    queryToExecute,
                    activeTab.limit,
                    username,
                    password,
                    selectedEnvironment,
                    "arrow",
                    extraCredentials,
                );
            } catch (e) {
                console.error(e);
                error = String(e);
            }

            activeTab.executing = false;
            clearInterval(refreshTimer);
            activeTab.lastQueryTime = performance.now() - start;

            if (
                error === null &&
                result.success &&
                activeTab.resultViewerComponent
            ) {
                // Save current config if keepView is enabled
                if (activeTab.keepView && activeTab.display === "perspective") {
                    const currentConfig =
                        await activeTab.resultViewerComponent.saveViewerConfig();
                    activeTab.perspectiveConfig = currentConfig;
                }
                await activeTab.resultViewerComponent.loadData(result.data);
            } else {
                console.log("Error", result, activeTab.resultViewerComponent);
                activeTab.error = error || result.error;
            }
        } else if (activeTab.language === "wvlet") {
            var result = null;
            var error = null;
            try {
                const compiler = new WvletCompiler({ target: "trino" });
                const compiledSQL = compiler.compile(queryToExecute, {
                    target: "trino",
                });
                console.log("Compiled Wvlet to SQL:", compiledSQL);

                result = await queryService.executeQuery(
                    compiledSQL,
                    activeTab.limit,
                    username,
                    password,
                    selectedEnvironment,
                    "arrow",
                    extraCredentials,
                );
            } catch (e) {
                console.error(e);
                error = String(e);
            }

            activeTab.executing = false;
            clearInterval(refreshTimer);
            activeTab.lastQueryTime = performance.now() - start;

            if (
                error === null &&
                result.success &&
                activeTab.resultViewerComponent
            ) {
                // Save current config if keepView is enabled
                if (activeTab.keepView && activeTab.display === "perspective") {
                    const currentConfig =
                        await activeTab.resultViewerComponent.saveViewerConfig();
                    activeTab.perspectiveConfig = currentConfig;
                }
                await activeTab.resultViewerComponent.loadData(result.data);
            } else {
                console.log("Error", result, activeTab.resultViewerComponent);
                activeTab.error = error || result.error;
            }
        } else {
            // handle Malloy
            var error = null;
            var result = null;
            try {
                result = await runMalloyQuery(
                    queryToExecute,
                    activeTab.limit,
                    backendUrl,
                    username,
                    password,
                    selectedEnvironment,
                    extraCredentials,
                );
                console.log(result);
            } catch (e) {
                console.error(e);
                error = String(e);
            }

            activeTab.executing = false;
            clearInterval(refreshTimer);
            activeTab.lastQueryTime = performance.now() - start;

            if (error === null) {
                if (activeTab.display === "perspective") {
                    // Save current config if keepView is enabled
                    if (activeTab.keepView) {
                        const currentConfig =
                            await activeTab.resultViewerComponent.saveViewerConfig();
                        activeTab.perspectiveConfig = currentConfig;
                    }
                    await activeTab.resultViewerComponent.loadData(
                        result.data.queryData,
                    );
                } else {
                    const el = document.getElementById(
                        "malloyrender" + activeTab.id,
                    );
                    if (el) {
                        el.innerHTML = "";
                        const renderer = new MalloyRenderer({});
                        const malloyViz = renderer.createViz({});
                        malloyViz.setResult(API.util.wrapResult(result));
                        malloyViz.render(el);
                    }
                }
            } else {
                activeTab.error = error;
            }
        }

        tabs = [...tabs]; // Trigger reactivity
    }
</script>

<svelte:window on:keydown={handleKeyDown} />

{#snippet collapseButton()}
    <button
        class="editor-toggle"
        onclick={() => setEditorCollapsed(!getActiveTab()?.editorCollapsed)}
        title={getActiveTab()?.editorCollapsed ? "Show editor" : "Hide editor"}
    >
        {#if getActiveTab()?.editorCollapsed}
            <ChevronRight size="1em" style="vertical-align: middle;" />
        {:else}
            <ChevronDown size="1em" style="vertical-align: middle;" />
        {/if}
        Editor
    </button>
{/snippet}

{#snippet children(activeTab, isActive)}
    {#if activeTab}
        <div style:display={isActive ? "contents" : "none"}>
            {#if !activeTab.editorCollapsed}
                <div class="editors">
                    <QueryEditor
                        bind:query={activeTab.query}
                        bind:language={activeTab.language}
                        bind:selection={activeTab.selection}
                        onExecute={execute}
                    />
                </div>
            {/if}

            <div class="controls-row">
                <QueryControls
                    bind:queryName={activeTab.queryName}
                    bind:limit={activeTab.limit}
                    bind:keepView={activeTab.keepView}
                    bind:selectedEnvironment
                    bind:language={activeTab.language}
                    bind:display={activeTab.display}
                    executing={activeTab.executing}
                    lastQueryTime={activeTab.lastQueryTime}
                    onSave={saveQuery}
                    onReset={resetQuery}
                    onExecute={execute}
                    onCopyURL={copyURL}
                    onEnvironmentChange={handleEnvironmentChange}
                />
                {#if activeTab.editorCollapsed}
                    <div class="collapse-button-wrapper">
                        {@render collapseButton()}
                    </div>
                {/if}
            </div>

            <ErrorDisplay error={activeTab.error} />

            {#if activeTab.display === "perspective"}
                <ResultViewer
                    bind:this={activeTab.resultViewerComponent}
                    perspectiveConfig={activeTab.perspectiveConfig}
                    id={"result" + activeTab.id}
                />
            {:else if activeTab.display === "malloy"}
                <div
                    id={"malloyrender" + activeTab.id}
                    class="malloyrender"
                ></div>
            {:else}
                <MosaicViewer
                    bind:this={activeTab.resultViewerComponent}
                    initialSpec={activeTab.mosaicSpec}
                />
            {/if}
        </div>
    {/if}
{/snippet}

{#if loggedIn && configLoaded}
    <div class="app-container">
        <header>
            <h1>Trino Data Explorer <span class="version">{VERSION}</span></h1>
            <div class="header-nav">
                <div class="nav-tabs">
                    <button
                        class="nav-tab {activeView === 'query' ? 'active' : ''}"
                        onclick={() => (activeView = "query")}
                    >
                        <Database size="1em" /> Query Explorer
                    </button>
                    <button
                        class="nav-tab {activeView === 'chat' ? 'active' : ''}"
                        onclick={() => (activeView = "chat")}
                    >
                        <Bot size="1em" /> AI Chat <i>(alpha)</i>
                    </button>
                    <button
                        class="nav-tab {activeView === 'dashboard' ? 'active' : ''}"
                        onclick={() => (activeView = "dashboard")}
                    >
                        <LayoutDashboard size="1em" /> Dashboard <i>(alpha)</i>
                    </button>
                    <button
                        class="nav-tab logout-btn"
                        onclick={() => {
                            loggedIn = false;
                            password = "";
                        }}
                        title="Logout"
                    >
                        <LogOut size="1em" /> Logout
                    </button>
                </div>
            </div>
        </header>

        <div class="container">
            {#if activeView === "query"}
                <SavedQueriesSidebar
                    {savedQueries}
                    {folders}
                    currentQueryName={getActiveTab()?.queryName || ""}
                    onQuerySelected={loadSavedQuery}
                    onQueryDeleted={deleteSavedQuery}
                    onFoldersChanged={handleFoldersChanged}
                    onQueryMoved={handleQueryMoved}
                    isCollapsed={sidebarCollapsed}
                    onToggle={toggleSidebar}
                />

                <div id="content">
                    <TabContainer
                        bind:tabs
                        bind:activeTabId
                        editorCollapsed={getActiveTab()?.editorCollapsed ??
                            false}
                        {collapseButton}
                    >
                        {#each tabs as tab (tab.id)}
                            {@render children(tab, tab.id === activeTabId)}
                        {/each}
                    </TabContainer>
                </div>
            {:else if activeView === "chat"}
                <div id="chat-content">
                    <ChatComponent
                        {username}
                        {password}
                        {extraCredentials}
                        {queryService}
                        {aiService}
                        bind:showDisclaimer
                    />
                </div>
            {:else if activeView === "dashboard"}
                <div id="dashboard-content">
                    <DashboardView
                        {username}
                        {password}
                        {extraCredentials}
                        {selectedEnvironment}
                        {queryService}
                    />
                </div>
            {/if}
        </div>
    </div>
{:else}
    <LoginComponent bind:username bind:password onLogin={doLogin} />
{/if}

<style>
    :global(body) {
        margin: 0;
    }

    .app-container {
        display: flex;
        flex-direction: column;
        height: 100vh;
        overflow: hidden;
    }

    header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        font-family: Inter, ui-sans-serif;
        padding: 0.5rem 2rem;
        background: white;
        border-bottom: 1px solid #e0e0e0;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
        height: 45px;
        box-sizing: border-box;
    }

    header h1 {
        margin: 0;
        color: #333;
        font-size: 1.25rem;
    }

    .version {
        color: #999;
        font-size: 0.75rem;
        font-weight: normal;
        margin-left: 0.5rem;
    }

    .header-nav {
        display: flex;
        align-items: center;
        gap: 1.5rem;
    }

    #content {
        display: flex;
        flex-direction: column;
        flex-grow: 1;
        /* should be 45 but for some reason that gives a scrollbar */
        height: calc(100vh - 60px);
        margin-top: 1em;
        margin-left: 2em;
        margin-right: 2em;
    }

    .editors {
        display: grid;
        grid-template-columns: minmax(0px, auto) 0px;
    }

    .controls-row {
        display: flex;
        align-items: flex-start;
        gap: 15px;
    }

    .collapse-button-wrapper {
        margin-left: auto;
    }

    .controls-row .collapse-button-wrapper {
        margin-top: 18px;
    }

    .editor-toggle {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        padding: 4px 8px;
        background: #f5f5f5;
        border: 1px solid #ccc;
        border-radius: 4px;
        cursor: pointer;
        font-weight: 500;
    }

    .editor-toggle:hover {
        background: #e5e5e5;
    }

    .malloyrender {
        flex-grow: 1;
        min-height: 600px;
        margin-top: 1em;
    }

    .container {
        display: flex;
        flex: 1;
        max-width: 100vw;
        position: relative;
        overflow: hidden;
    }

    .nav-tabs {
        display: flex;
        gap: 0.5rem;
    }

    .nav-tab {
        display: inline-flex;
        align-items: center;
        gap: 0.5rem;
        padding: 0.5rem 1rem;
        background: #f5f5f5;
        color: #666;
        border: none;
        border-radius: 8px;
        font-weight: 500;
        transition:
            transform 0.2s ease,
            box-shadow 0.2s ease,
            background-color 0.2s ease,
            color 0.2s ease;
        font-size: 0.9rem;
        cursor: pointer;
    }

    .nav-tab:hover {
        transform: translateY(-1px);
        background: #e0e0e0;
    }

    .nav-tab.active {
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        box-shadow: 0 2px 8px rgba(102, 126, 234, 0.3);
    }

    .nav-tab.logout-btn {
        margin-left: 0.5rem;
        color: #888;
    }

    .nav-tab.logout-btn:hover {
        background: #fee2e2;
        color: #dc2626;
    }

    #chat-content {
        display: flex;
        flex-direction: column;
        flex-grow: 1;
        height: calc(100vh - 45px);
    }

    #dashboard-content {
        display: flex;
        flex-direction: column;
        flex-grow: 1;
        height: calc(100vh - 45px);
        overflow: hidden;
    }
</style>
