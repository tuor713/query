<script>
    import { onMount } from "svelte";
    import {
        // Services
        initializePerspective,
        QueryService,
        StorageService,

        // Config
        getDefaultEnvironment,

        // Components
        LoginComponent,
        SavedQueriesSidebar,
        QueryEditor,
        QueryControls,
        ErrorDisplay,
        ResultViewer,
        TabContainer,
    } from "$lib";

    // Services
    const storageService = new StorageService();
    const queryService = new QueryService();

    // State
    let username = $state(storageService.getUsername());
    let password = $state("");
    let loggedIn = $state(false);
    let savedQueries = $state(storageService.getSavedQueries());
    let selectedEnvironment = $state(
        storageService.getEnvironment() || getDefaultEnvironment(),
    );

    // Initialize query from URL or local storage
    const urlParams = new URLSearchParams(window.location.search);
    const queryParam = urlParams.get("query");

    // Tab management
    let tabs = $state([
        {
            id: 1,
            name: "Query 1",
            query: queryParam ?? storageService.getQuery() ?? "",
            queryName: "",
            limit: 100000,
            perspectiveConfig: { columns: [], plugin: "datagrid" },
            error: "",
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

    function doLogin(usernameInput, passwordInput) {
        username = usernameInput;
        password = passwordInput;
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
            };
            tabs = [...tabs]; // Trigger reactivity
        }
    }

    async function saveQuery() {
        const activeTab = getActiveTab();
        if (!activeTab || !activeTab.resultViewerComponent) return;

        const config = await activeTab.resultViewerComponent.saveViewerConfig();

        const newQuery = {
            name: activeTab.queryName,
            query: activeTab.query,
            perspectiveConfig: config,
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
            activeTab.perspectiveConfig = { columns: [], plugin: "datagrid" };
            tabs = [...tabs]; // Trigger reactivity
        }
    }

    function handleEnvironmentChange(newEnvironment) {
        selectedEnvironment = newEnvironment;
        storageService.saveEnvironment(selectedEnvironment);
    }

    async function execute() {
        const activeTab = getActiveTab();
        if (!activeTab) {
            console.warn("No active tab", activeTabId);
            return;
        }

        console.log("Executing query", activeTab.query);

        storageService.saveQuery(activeTab.query);

        activeTab.error = "";
        activeTab.executing = true;
        activeTab.lastQueryTime = 0;
        const start = performance.now();

        const refreshTimer = setInterval(() => {
            activeTab.lastQueryTime = performance.now() - start;
            tabs = [...tabs]; // Trigger reactivity
        }, 100);

        const result = await queryService.executeQuery(
            activeTab.query,
            activeTab.limit,
            username,
            password,
            selectedEnvironment,
        );

        activeTab.executing = false;
        clearInterval(refreshTimer);
        activeTab.lastQueryTime = performance.now() - start;

        if (result.success && activeTab.resultViewerComponent) {
            await activeTab.resultViewerComponent.loadData(result.data);
        } else {
            console.log(
                "Error",
                result.success,
                activeTab.resultViewerComponent,
            );
            activeTab.error = result.error;
        }

        tabs = [...tabs]; // Trigger reactivity
    }
</script>

<svelte:window on:keydown={handleKeyDown} />

{#snippet children(activeTab, isActive)}
    {#if activeTab}
        <div style:display={isActive ? "contents" : "none"}>
            <div class="editors">
                <QueryEditor bind:query={activeTab.query} />
            </div>

            <QueryControls
                bind:queryName={activeTab.queryName}
                bind:limit={activeTab.limit}
                bind:selectedEnvironment
                executing={activeTab.executing}
                lastQueryTime={activeTab.lastQueryTime}
                onSave={saveQuery}
                onReset={resetQuery}
                onExecute={execute}
                onEnvironmentChange={handleEnvironmentChange}
            />

            <ErrorDisplay error={activeTab.error} />

            <ResultViewer
                bind:this={activeTab.resultViewerComponent}
                perspectiveConfig={activeTab.perspectiveConfig}
                id={"result" + activeTab.id}
            />
        </div>
    {/if}
{/snippet}

{#if loggedIn}
    <div class="container">
        <SavedQueriesSidebar
            {savedQueries}
            currentQueryName={getActiveTab()?.queryName || ""}
            onQuerySelected={loadSavedQuery}
        />

        <div id="content">
            <TabContainer bind:tabs bind:activeTabId>
                {#each tabs as tab}
                    {@render children(tab, tab.id === activeTabId)}
                {/each}
            </TabContainer>
        </div>
    </div>
{:else}
    <LoginComponent bind:username bind:password onLogin={doLogin} />
{/if}

<style>
    :global(body) {
        margin: 0;
    }

    #content {
        display: flex;
        flex-direction: column;
        flex-grow: 1;
        height: 95vh;
        margin-top: 1em;
        margin-left: 2em;
        margin-right: 2em;
    }

    .editors {
        display: flex;
        flex-direction: row;
    }

    .container {
        display: flex;
        min-height: 100vh;
        max-width: 100vw;
        position: relative;
    }
</style>
