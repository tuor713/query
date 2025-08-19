<script>
    import { onMount } from "svelte";
    import {
        // Services
        initializePerspective,
        QueryService,
        StorageService,
        AIService,

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
    } from "$lib";

    import { MalloyRenderer } from "@malloydata/render";
    import { API } from "@malloydata/malloy";
    import { Bot, Database } from "@lucide/svelte";

    // Services
    const storageService = new StorageService();
    const queryService = new QueryService();
    const aiService = new AIService();

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
    let activeView = $state("query"); // "query" or "chat"

    // Initialize query from URL or local storage
    const urlParams = new URLSearchParams(window.location.search);
    const queryParam = urlParams.get("query");
    const viewParam = urlParams.get("view");

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
        language: storageService.getLanguage(),
        display: "perspective",
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
                language: viewData.language || initialTabData.language,
                display: viewData.display || initialTabData.display,
            };
        } catch (error) {
            console.error("Failed to parse view parameter:", error);
        }
    }

    // Tab management
    let tabs = $state([
        {
            id: 1,
            name: "Query 1",
            query: initialTabData.query,
            queryName: initialTabData.queryName,
            limit: initialTabData.limit,
            perspectiveConfig: initialTabData.perspectiveConfig,
            error: "",
            language: initialTabData.language,
            display: initialTabData.display,
            lastQueryTime: 0,
            executing: false,
            resultViewerComponent: null,
        },
    ]);
    let activeTabId = $state(1);

    // Get current active tab
    function getActiveTab() {
        return tabs.find((t) => t.id === activeTabId);
    }

    onMount(async () => {
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
            activeTab.display = toLoad.display ?? "perspective";
            activeTab.language = toLoad.language ?? "sql";
            activeTab.limit = toLoad.limit ?? 100000;
            tabs = [...tabs]; // Trigger reactivity
        }
    }

    function deleteSavedQuery(queryName) {
        savedQueries = savedQueries.filter((q) => q.name !== queryName);
        storageService.saveSavedQueries(savedQueries);
    }

    async function saveQuery() {
        const activeTab = getActiveTab();
        if (!activeTab || !activeTab.resultViewerComponent) return;

        const config = await activeTab.resultViewerComponent.saveViewerConfig();

        const newQuery = {
            name: activeTab.queryName,
            query: activeTab.query,
            perspectiveConfig: config,
            language: activeTab.language,
            display: activeTab.display,
            limit: activeTab.limit,
        };

        savedQueries = savedQueries
            .filter((q) => q.name !== activeTab.queryName)
            .concat(newQuery)
            .sort((a, b) => a.name.localeCompare(b.name));

        storageService.saveSavedQueries(savedQueries);
    }

    function resetQuery() {
        const activeTab = getActiveTab();
        if (activeTab) {
            activeTab.query = "";
            activeTab.queryName = "";
            activeTab.perspectiveConfig = {
                columns: [],
                plugin: "datagrid",
                plugin_config: { edit_mode: "EDIT" },
            };
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

    async function copyURL() {
        const activeTab = getActiveTab();
        if (!activeTab || !activeTab.resultViewerComponent) return;

        try {
            const perspectiveConfig =
                await activeTab.resultViewerComponent.saveViewerConfig();

            const viewData = {
                query: activeTab.query,
                perspectiveConfig: perspectiveConfig,
                language: activeTab.language,
                display: activeTab.display,
                limit: activeTab.limit,
                queryName: activeTab.queryName,
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

        storageService.saveQuery(activeTab.query);
        storageService.saveLanguage(activeTab.language);

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
                    activeTab.query,
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
                    activeTab.query,
                    activeTab.limit,
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

{#snippet children(activeTab, isActive)}
    {#if activeTab}
        <div style:display={isActive ? "contents" : "none"}>
            <div class="editors">
                <QueryEditor
                    bind:query={activeTab.query}
                    bind:language={activeTab.language}
                    onExecute={execute}
                />
            </div>

            <QueryControls
                bind:queryName={activeTab.queryName}
                bind:limit={activeTab.limit}
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
                <MosaicViewer bind:this={activeTab.resultViewerComponent} />
            {/if}
        </div>
    {/if}
{/snippet}

{#if loggedIn}
    <div class="app-container">
        <header>
            <h1>Trino Data Explorer</h1>
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
                </div>
            </div>
        </header>

        <div class="container">
            {#if activeView === "query"}
                <SavedQueriesSidebar
                    {savedQueries}
                    currentQueryName={getActiveTab()?.queryName || ""}
                    onQuerySelected={loadSavedQuery}
                    onQueryDeleted={deleteSavedQuery}
                    isCollapsed={sidebarCollapsed}
                    onToggle={toggleSidebar}
                />

                <div id="content">
                    <TabContainer bind:tabs bind:activeTabId>
                        {#each tabs as tab}
                            {@render children(tab, tab.id === activeTabId)}
                        {/each}
                    </TabContainer>
                </div>
            {:else}
                <div id="chat-content">
                    <ChatComponent
                        {username}
                        {password}
                        {extraCredentials}
                        {queryService}
                        {aiService}
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
        min-height: 100vh;
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

    #chat-content {
        display: flex;
        flex-direction: column;
        flex-grow: 1;
        height: calc(100vh - 45px);
        margin-top: 1em;
        margin-left: 2em;
        margin-right: 2em;
    }
</style>
