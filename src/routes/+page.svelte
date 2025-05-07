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

    let query = $state(queryParam ?? storageService.getQuery() ?? "");
    let queryName = $state("");
    let error = $state("");
    let lastQueryTime = $state(0);
    let executing = $state(false);
    let limit = $state(100000);
    let perspectiveConfig = $state.raw({ columns: [], plugin: "datagrid" });

    // References to components with methods
    let resultViewerComponent;

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
        queryName = toLoad.name;
        query = toLoad.query;
        perspectiveConfig = toLoad.perspectiveConfig ?? {
            columns: [],
            plugin: "datagrid",
        };
    }

    async function saveQuery() {
        const config = await resultViewerComponent.saveViewerConfig();

        const newQuery = {
            name: queryName,
            query: query,
            perspectiveConfig: config,
        };

        savedQueries = savedQueries
            .filter((q) => q.name !== queryName)
            .concat(newQuery)
            .sort((a, b) => a.name.localeCompare(b.name));

        storageService.saveSavedQueries(savedQueries);
    }

    function resetQuery() {
        query = "";
        queryName = "";
        perspectiveConfig = { columns: [], plugin: "datagrid" };
    }

    function handleEnvironmentChange(newEnvironment) {
        selectedEnvironment = newEnvironment;
        storageService.saveEnvironment(selectedEnvironment);
    }

    async function execute() {
        storageService.saveQuery(query);

        error = "";
        executing = true;
        lastQueryTime = 0;
        const start = performance.now();

        const refreshTimer = setInterval(() => {
            lastQueryTime = performance.now() - start;
        }, 100);

        const result = await queryService.executeQuery(
            query,
            limit,
            username,
            password,
            selectedEnvironment,
        );

        executing = false;
        clearInterval(refreshTimer);
        lastQueryTime = performance.now() - start;

        if (result.success) {
            await resultViewerComponent.loadData(result.data);
        } else {
            error = result.error;
        }
    }
</script>

<svelte:window on:keydown={handleKeyDown} />

{#if loggedIn}
    <div class="container">
        <SavedQueriesSidebar
            {savedQueries}
            currentQueryName={queryName}
            onQuerySelected={loadSavedQuery}
        />

        <div id="content">
            <div id="editors">
                <QueryEditor bind:query />
            </div>

            <QueryControls
                bind:queryName
                bind:limit
                bind:selectedEnvironment
                {executing}
                {lastQueryTime}
                onSave={saveQuery}
                onReset={resetQuery}
                onExecute={execute}
                onEnvironmentChange={handleEnvironmentChange}
            />

            <ErrorDisplay {error} />

            <ResultViewer
                bind:this={resultViewerComponent}
                {perspectiveConfig}
            />
        </div>
    </div>
{:else}
    <LoginComponent bind:username bind:password onLogin={doLogin} />
{/if}

<style>
    #content {
        display: flex;
        flex-direction: column;
        flex-grow: 1;
        height: 95vh;
        margin-top: 1em;
        margin-left: 2em;
        margin-right: 2em;
    }

    #editors {
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
