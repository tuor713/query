<script>
    import { onMount } from "svelte";
    import {
        Send,
        Pause,
        MessageSquarePlus,
        ChevronDown,
        ChevronRight,
        Settings,
        Brain,
        Wrench,
    } from "@lucide/svelte";
    import { marked } from "marked";
    import ResultViewer from "./ResultViewer.svelte";
    import MarkdownWithCharts from "./MarkdownWithCharts.svelte";
    import EnvironmentSelector from "./EnvironmentSelector.svelte";
    import SettingsDialog from "./SettingsDialog.svelte";
    import MemoryDialog from "./MemoryDialog.svelte";
    import DisclaimerDialog from "./DisclaimerDialog.svelte";
    import { isSelectOnlyQuery } from "$lib/utils/sqlParser.js";
    import { getDefaultEnvironment } from "$lib/config/environments.js";
    import { StorageService, runMalloyQuery, getConfig } from "$lib";

    let {
        username = "",
        password = "",
        extraCredentials = [],
        queryService,
        aiService,
        showDisclaimer = $bindable(true),
    } = $props();

    const storageService = new StorageService();
    let selectedEnvironment = $state(
        storageService.getEnvironment() || getDefaultEnvironment(),
    );
    let selectedModel = $state(storageService.getModel());

    let messages = $state([]);
    let currentMessage = $state("");
    let isLoading = $state(false);
    let chatContainer;
    let resultViewerInstances = $state({});
    let datasetRegistry = $state({}); // Store query results by dataset ID
    let datasetCounter = $state(0); // Counter for generating dataset IDs
    let showSettings = $state(false);
    let showMemory = $state(false);
    let systemPrompt = $state(
        storageService.getSystemPrompt() || aiService.getDefaultSystemPrompt(),
    );
    let aiMemory = $state(storageService.getMemory());

    // Computed display messages for cleaner UI
    let displayMessages = $state([]);

    function computeDisplayMessages() {
        const display = [];
        let i = 0;

        while (i < messages.length) {
            const message = messages[i];

            // Check if this is an AI message with a function call followed by a tool message
            if (
                message.type === "ai" &&
                message.function_call &&
                i + 1 < messages.length
            ) {
                const nextMessage = messages[i + 1];
                if (
                    nextMessage.type === "tool" &&
                    nextMessage.function_name === message.function_call.name
                ) {
                    // Merge the AI function call and tool result into a single display message
                    display.push({
                        ...nextMessage,
                        isMerged: true,
                        aiContent: message.content, // Preserve the AI message content if any
                        function_call: message.function_call,
                    });
                    i += 2; // Skip both messages as we've merged them
                    continue;
                }
            }

            // Otherwise, add the message as-is
            display.push(message);
            i++;
        }

        return display;
    }

    // Update displayMessages whenever messages change
    $effect(() => {
        displayMessages = computeDisplayMessages();
    });

    onMount(() => {
        scrollToBottom();
    });

    function scrollToBottom() {
        if (chatContainer) {
            chatContainer.scrollTop = chatContainer.scrollHeight;
        }
    }

    function cancelRequest() {
        isLoading = false;
    }

    function newChat() {
        messages = [];
        isLoading = false;
        currentMessage = "";
        resultViewerInstances = {};
    }

    function handleEnvironmentChange(newEnvironment) {
        selectedEnvironment = newEnvironment;
        storageService.saveEnvironment(selectedEnvironment);
    }

    function handleModelChange(event) {
        selectedModel = event.target.value;
        storageService.saveModel(selectedModel);
    }

    async function sendMessage() {
        if (!currentMessage.trim()) return;

        const userMessage = {
            id: Date.now(),
            type: "user",
            content: currentMessage,
            timestamp: new Date(),
        };

        messages = [...messages, userMessage];
        currentMessage = "";
        isLoading = true;

        setTimeout(scrollToBottom, 10);

        try {
            await processAIConversation(messages);
        } catch (error) {
            const errorMessage = {
                id: Date.now() + 1,
                type: "ai",
                content: `Sorry, I encountered an error: ${error.message}`,
                timestamp: new Date(),
            };
            messages = [...messages, errorMessage];
        } finally {
            isLoading = false;
            setTimeout(scrollToBottom, 10);
        }
    }

    async function processAIConversation(conversationMessages, turnCount = 0) {
        const maxTurns = 6;

        if (turnCount >= maxTurns) {
            console.log("Max AI turns reached");
            isLoading = false;
            return;
        }

        const aiResponse = await aiService.processAIResponse(
            conversationMessages,
            selectedModel,
            username,
        );
        console.log(`AI response (turn ${turnCount + 1}):`, aiResponse);

        // If response is empty, stop the conversation
        if (
            isLoading &&
            (!aiResponse.text?.trim() || aiResponse.text === "STOP") &&
            !aiResponse.function_call
        ) {
            console.log("Empty AI response, ending conversation");
            return;
        }

        const aiMessage = {
            id: Date.now() + 2 * turnCount + 1,
            type: "ai",
            content: aiResponse.text,
            function_call: aiResponse.function_call,
            timestamp: new Date(),
        };

        messages = [...messages, aiMessage];
        setTimeout(scrollToBottom, 10);

        // Handle function calls
        if (aiResponse.function_call) {
            // Add function name for search and retrieve_doc calls
            if (aiResponse.function_call.name === "search") {
                aiMessage.function_name = "search";
                aiMessage.search_query =
                    aiResponse.function_call.arguments.query;
            } else if (aiResponse.function_call.name === "retrieve_doc") {
                aiMessage.function_name = "retrieve_doc";
                aiMessage.doc_id = aiResponse.function_call.arguments.doc_id;
            } else if (aiResponse.function_call.name === "execute_sql_query") {
                aiMessage.query = aiResponse.function_call.arguments.query;
            } else if (aiResponse.function_call.name === "execute_malloy") {
                aiMessage.query = aiResponse.function_call.arguments.query;
            }

            const toolResult = await handleFunctionCall(
                aiResponse.function_call,
                aiMessage.id,
            );

            // Add the tool result to the conversation context and continue
            if (isLoading && toolResult) {
                const updatedMessages = [...messages];
                // Continue the conversation with the tool result included
                await processAIConversation(updatedMessages, turnCount + 1);
            }
        } else if (aiResponse.text?.trim()) {
            // If there's text content but no function call,
            // we can optionally continue the conversation
            // For now, we'll stop here unless the AI explicitly asks for more
            console.log(
                "AI provided text response, conversation turn complete",
            );
        }
    }

    async function handleFunctionCall(functionCall, messageId) {
        const { name, arguments: args } = functionCall;
        let toolResult = null;

        if (name === "search") {
            const toolMessageId = messageId + 1;

            // Add tool message showing it's executing
            const toolMessage = {
                id: toolMessageId,
                type: "tool",
                function_name: "search",
                content: "",
                expanded: false,
                search_query: args.query,
                isExecuting: true,
                timestamp: new Date(),
            };
            messages = [...messages, toolMessage];
            setTimeout(scrollToBottom, 10);

            try {
                const result = await aiService.search(args.query, username);

                if (isLoading && result.success) {
                    // Update the tool message with the result
                    messages = messages.map((msg) =>
                        msg.id === toolMessageId
                            ? {
                                  ...msg,
                                  content: result.content,
                                  isExecuting: false,
                              }
                            : msg,
                    );

                    toolResult = { success: true, content: result.content };
                } else {
                    // Update the tool message with error
                    messages = messages.map((msg) =>
                        msg.id === toolMessageId
                            ? {
                                  ...msg,
                                  content: `Error: ${result.error}`,
                                  isExecuting: false,
                              }
                            : msg,
                    );

                    toolResult = { error: result.error };
                }
            } catch (error) {
                console.error("Error executing search:", error);
                messages = messages.map((msg) =>
                    msg.id === toolMessageId
                        ? {
                              ...msg,
                              content: `Error: ${error.message}`,
                              isExecuting: false,
                          }
                        : msg,
                );
                toolResult = { error: error.message };
            }

            setTimeout(scrollToBottom, 10);
        } else if (name === "retrieve_doc") {
            const toolMessageId = messageId + 1;

            // Add tool message showing it's executing
            const toolMessage = {
                id: toolMessageId,
                type: "tool",
                function_name: "retrieve_doc",
                content: "",
                expanded: false,
                doc_id: args.doc_id,
                isExecuting: true,
                timestamp: new Date(),
            };
            messages = [...messages, toolMessage];
            setTimeout(scrollToBottom, 10);

            try {
                const result = await aiService.retrieveDoc(
                    args.doc_id,
                    username,
                );

                if (isLoading && result.success) {
                    // Update the tool message with the result
                    messages = messages.map((msg) =>
                        msg.id === toolMessageId
                            ? {
                                  ...msg,
                                  content: result.content,
                                  isExecuting: false,
                              }
                            : msg,
                    );

                    toolResult = { success: true, content: result.content };
                } else {
                    // Update the tool message with error
                    messages = messages.map((msg) =>
                        msg.id === toolMessageId
                            ? {
                                  ...msg,
                                  content: `Error: ${result.error}`,
                                  isExecuting: false,
                              }
                            : msg,
                    );

                    toolResult = { error: result.error };
                }
            } catch (error) {
                console.error("Error retrieving document:", error);
                messages = messages.map((msg) =>
                    msg.id === toolMessageId
                        ? {
                              ...msg,
                              content: `Error: ${error.message}`,
                              isExecuting: false,
                          }
                        : msg,
                );
                toolResult = { error: error.message };
            }

            setTimeout(scrollToBottom, 10);
        } else if (name === "execute_sql_query") {
            // Validate that the query only contains SELECT statements
            console.log("Processing query", args.query);
            const validation = isSelectOnlyQuery(args.query);

            const toolMessageId = messageId + 1;

            if (!validation.valid) {
                // Add tool message with validation error
                const toolMessage = {
                    id: toolMessageId,
                    type: "tool",
                    function_name: "execute_sql_query",
                    content: "",
                    query: args.query,
                    queryError: `Query validation failed: ${validation.error}`,
                    isExecuting: false,
                    expanded: true,
                    timestamp: new Date(),
                };
                messages = [...messages, toolMessage];
                setTimeout(scrollToBottom, 10);
                return { error: validation.error };
            }

            // Add tool message showing it's executing
            const toolMessage = {
                id: toolMessageId,
                type: "tool",
                function_name: "execute_sql_query",
                content: "",
                query: args.query,
                expanded: true,
                isExecuting: true,
                timestamp: new Date(),
            };
            messages = [...messages, toolMessage];
            setTimeout(scrollToBottom, 10);

            try {
                const result = await queryService.executeQuery(
                    args.query,
                    args.limit || 100000,
                    username,
                    password,
                    selectedEnvironment,
                    "arrow",
                    extraCredentials,
                );

                if (isLoading && result.success) {
                    // Assign a dataset ID to this query result
                    const datasetId = `dataset_${++datasetCounter}`;
                    datasetRegistry[datasetId] = result.data;

                    // Update the tool message with the result
                    messages = messages.map((msg) =>
                        msg.id === toolMessageId
                            ? {
                                  ...msg,
                                  queryResult: result.data,
                                  datasetId: datasetId,
                                  isExecuting: false,
                              }
                            : msg,
                    );

                    // Load data into perspective viewer after DOM update
                    setTimeout(async () => {
                        const viewer = resultViewerInstances[toolMessageId];
                        if (viewer && result.data) {
                            await viewer.loadData(result.data);
                        }
                    }, 100);

                    toolResult = {
                        success: true,
                        data: result.data,
                        datasetId: datasetId,
                    };
                } else {
                    // Update the tool message with error
                    messages = messages.map((msg) =>
                        msg.id === toolMessageId
                            ? {
                                  ...msg,
                                  queryError: result.error,
                                  isExecuting: false,
                              }
                            : msg,
                    );

                    toolResult = { error: result.error };
                }
            } catch (error) {
                console.error("Error executing query:", error);
                messages = messages.map((msg) =>
                    msg.id === toolMessageId
                        ? {
                              ...msg,
                              queryError: error.message,
                              isExecuting: false,
                          }
                        : msg,
                );
            }

            setTimeout(scrollToBottom, 10);
        } else if (name === "execute_malloy") {
            // For now, handle Malloy queries the same as SQL queries since they both return arrow data
            console.log("Processing Malloy query", args.query);

            const toolMessageId = messageId + 1;

            // Add tool message showing it's executing
            const toolMessage = {
                id: toolMessageId,
                type: "tool",
                function_name: "execute_malloy",
                content: "",
                query: args.query,
                expanded: true,
                isExecuting: true,
                timestamp: new Date(),
            };
            messages = [...messages, toolMessage];
            setTimeout(scrollToBottom, 10);

            try {
                const result = await runMalloyQuery(
                    args.query,
                    args.limit || 100000,
                    queryService.baseUrl,
                    username,
                    password,
                    selectedEnvironment,
                    extraCredentials,
                );

                if (
                    isLoading &&
                    result &&
                    result.data &&
                    result.data.queryData
                ) {
                    // Assign a dataset ID to this query result
                    const datasetId = `dataset_${++datasetCounter}`;
                    datasetRegistry[datasetId] = result.data.queryData;

                    // Update the tool message with the result
                    messages = messages.map((msg) =>
                        msg.id === toolMessageId
                            ? {
                                  ...msg,
                                  queryResult: result.data.queryData,
                                  datasetId: datasetId,
                                  isExecuting: false,
                              }
                            : msg,
                    );

                    // Load data into perspective viewer after DOM update
                    setTimeout(async () => {
                        const viewer = resultViewerInstances[toolMessageId];
                        if (viewer && result.data.queryData) {
                            await viewer.loadData(result.data.queryData);
                        }
                    }, 100);

                    toolResult = {
                        success: true,
                        data: result.data.queryData,
                        datasetId: datasetId,
                    };
                } else {
                    // Update the tool message with error
                    messages = messages.map((msg) =>
                        msg.id === toolMessageId
                            ? {
                                  ...msg,
                                  queryError:
                                      "No data returned from Malloy query",
                                  isExecuting: false,
                              }
                            : msg,
                    );

                    toolResult = {
                        error: "No data returned from Malloy query",
                    };
                }
            } catch (error) {
                console.error("Error executing Malloy query:", error);
                messages = messages.map((msg) =>
                    msg.id === toolMessageId
                        ? {
                              ...msg,
                              queryError: error.message,
                              isExecuting: false,
                          }
                        : msg,
                );
                toolResult = { error: error.message };
            }

            setTimeout(scrollToBottom, 10);
        } else if (name === "load_memory") {
            const toolMessageId = messageId + 1;

            // Add tool message showing it's executing
            const toolMessage = {
                id: toolMessageId,
                type: "tool",
                function_name: "load_memory",
                content: "",
                expanded: false,
                isExecuting: true,
                timestamp: new Date(),
            };
            messages = [...messages, toolMessage];
            setTimeout(scrollToBottom, 10);

            try {
                const memory = storageService.getMemory();
                const content = memory
                    ? "Memory loaded.\n\nContent:\n" + memory
                    : "No memory stored yet.";

                // Update the tool message with the result
                messages = messages.map((msg) =>
                    msg.id === toolMessageId
                        ? {
                              ...msg,
                              content: content,
                              isExecuting: false,
                          }
                        : msg,
                );

                toolResult = { success: true, content: content };
            } catch (error) {
                console.error("Error loading memory:", error);
                messages = messages.map((msg) =>
                    msg.id === toolMessageId
                        ? {
                              ...msg,
                              content: `Error: ${error.message}`,
                              isExecuting: false,
                          }
                        : msg,
                );
                toolResult = { error: error.message };
            }

            setTimeout(scrollToBottom, 10);
        } else if (name === "save_memory") {
            const toolMessageId = messageId + 1;

            // Add tool message showing it's executing
            const toolMessage = {
                id: toolMessageId,
                type: "tool",
                function_name: "save_memory",
                content: "",
                expanded: false,
                isExecuting: true,
                timestamp: new Date(),
            };
            messages = [...messages, toolMessage];
            setTimeout(scrollToBottom, 10);

            try {
                storageService.saveMemory(args.memory);
                aiMemory = args.memory;
                const content =
                    "Memory saved successfully.\n\nContent:\n" + args.memory;

                // Update the tool message with the result
                messages = messages.map((msg) =>
                    msg.id === toolMessageId
                        ? {
                              ...msg,
                              content: content,
                              isExecuting: false,
                          }
                        : msg,
                );

                toolResult = { success: true, content: content };
            } catch (error) {
                console.error("Error saving memory:", error);
                messages = messages.map((msg) =>
                    msg.id === toolMessageId
                        ? {
                              ...msg,
                              content: `Error: ${error.message}`,
                              isExecuting: false,
                          }
                        : msg,
                );
                toolResult = { error: error.message };
            }

            setTimeout(scrollToBottom, 10);
        }

        return toolResult;
    }

    function handleKeyDown(e) {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    }

    function toggleMessageExpanded(message) {
        // Update the expanded state in the original messages array
        messages = messages.map((msg) =>
            msg.id === message.id
                ? {
                      ...msg,
                      expanded: !message.expanded,
                  }
                : msg,
        );
        // For merged messages, also update the corresponding AI message if it exists
        if (message.isMerged && message.function_call) {
            messages = messages.map((msg) =>
                msg.type === "ai" &&
                msg.function_call &&
                msg.function_call.name === message.function_name
                    ? {
                          ...msg,
                          expanded: !message.expanded,
                      }
                    : msg,
            );
        }
    }

    function openSettings() {
        showSettings = true;
    }

    function openMemory() {
        showMemory = true;
    }

    function handleSystemPromptSave(newPrompt) {
        systemPrompt = newPrompt;
        storageService.saveSystemPrompt(newPrompt);
    }

    function handleMemorySave(newMemory) {
        aiMemory = newMemory;
        storageService.saveMemory(newMemory);
    }

    function getDefaultSystemPrompt() {
        return aiService.getDefaultSystemPrompt();
    }

    function getToolSummary(message) {
        const name = message.function_call?.name || message.function_name;
        const args = message.function_call?.arguments || {};

        switch (name) {
            case "execute_sql_query":
            case "execute_malloy": {
                const query = args.query || message.query || "";
                const firstLine = query.split("\n")[0].trim();
                const truncated =
                    firstLine.length > 50
                        ? firstLine.slice(0, 50) + "..."
                        : firstLine;
                const suffix =
                    firstLine.length <= 50 && query.includes("\n") ? "..." : "";
                return truncated ? `${truncated}${suffix}` : "";
            }
            case "search":
                return args.query || message.search_query || "";
            case "retrieve_doc":
                return args.doc_id || message.doc_id || "";
            case "save_memory":
                return "";
            case "load_memory":
                return "";
            default:
                return "";
        }
    }
</script>

<div class="chat-container">
    <div class="chat-messages" bind:this={chatContainer}>
        {#if displayMessages.length === 0}
            <div class="welcome-message">
                <h2>Welcome to AI Chat!</h2>
                <p>Ask me anything about your data. I can help you:</p>
                <ul>
                    <li>Generate and run SQL queries</li>
                    <li>Analyze your data</li>
                    <li>Answer questions about your datasets</li>
                    <li>Provide insights and recommendations</li>
                </ul>
                <p>
                    Try asking: "Show me the top 10 customers" or "What's the
                    average sales by region?"
                </p>
            </div>
        {/if}

        {#each displayMessages as message (message.id)}
            <div class="message {message.type}">
                <div class="message-header">
                    {#if message.type === "tool" || message.isMerged}
                        <button
                            class="collapse-toggle"
                            onclick={() => toggleMessageExpanded(message)}
                            aria-label={message.expanded
                                ? "Collapse"
                                : "Expand"}
                        >
                            {#if message.expanded}
                                <ChevronDown size={16} />
                            {:else}
                                <ChevronRight size={16} />
                            {/if}
                        </button>
                    {/if}
                    <span class="sender"
                        >{#if message.type === "tool" || message.isMerged}<Wrench
                                size={14}
                            />
                            {message.function_name ||
                                "unknown"}{#if getToolSummary(message)}<span
                                    class="tool-summary"
                                    >{getToolSummary(message)}</span
                                >{/if}{:else if message.type === "user"}You{:else if message.function_call}AI
                            Assistant{:else}AI Assistant{/if}</span
                    >
                    <span class="timestamp"
                        >{message.timestamp.toLocaleTimeString()}</span
                    >
                </div>
                <div
                    class="message-content"
                    class:collapsed={(message.type === "tool" ||
                        message.isMerged) &&
                        !message.expanded}
                >
                    {#if message.type === "ai" && !message.function_call}
                        <MarkdownWithCharts
                            content={message.content || ""}
                            {datasetRegistry}
                        />
                    {:else if message.type === "user"}
                        {message.content}
                    {:else if message.isMerged && message.aiContent}
                        <MarkdownWithCharts
                            content={message.aiContent || ""}
                            {datasetRegistry}
                        />
                    {/if}

                    {#if message.query}
                        <pre><code>{message.query}</code></pre>
                    {/if}

                    {#if message.search_query}
                        <div class="function-args">
                            <strong>Search Query:</strong>
                            {message.search_query}
                        </div>
                    {/if}

                    {#if message.doc_id}
                        <div class="function-args">
                            <strong>Document ID:</strong>
                            {message.doc_id}
                        </div>
                    {/if}

                    {#if message.type === "tool" || message.isMerged}
                        <div class="tool-result">
                            {#if message.isExecuting}
                                <div class="query-loading">
                                    <div class="typing-indicator">
                                        <span></span>
                                        <span></span>
                                        <span></span>
                                    </div>
                                    <span
                                        >{message.function_name === "search"
                                            ? "Searching..."
                                            : message.function_name ===
                                                "retrieve_doc"
                                              ? "Retrieving document..."
                                              : message.function_name ===
                                                  "load_memory"
                                                ? "Loading memory..."
                                                : message.function_name ===
                                                    "save_memory"
                                                  ? "Saving memory..."
                                                  : message.function_name ===
                                                      "execute_malloy"
                                                    ? "Executing Malloy query..."
                                                    : "Executing query..."}</span
                                    >
                                </div>
                            {:else if message.function_name === "search"}
                                <div class="function-result">
                                    <pre><code>{message.content}</code></pre>
                                </div>
                            {:else if message.function_name === "retrieve_doc"}
                                <div class="function-result">
                                    {@html marked(message.content || "")}
                                </div>
                            {:else if message.function_name === "load_memory" || message.function_name === "save_memory"}
                                <div class="function-result">
                                    <pre><code>{message.content}</code></pre>
                                </div>
                            {:else if message.queryResult}
                                <ResultViewer
                                    bind:this={
                                        resultViewerInstances[message.id]
                                    }
                                    perspectiveConfig={{
                                        columns: [],
                                        plugin: "datagrid",
                                        plugin_config: { edit_mode: "EDIT" },
                                    }}
                                    id={`chat-result-${message.id}`}
                                    adaptiveHeight={true}
                                />
                            {:else if message.queryError}
                                <div class="query-error">
                                    <pre><code>{message.queryError}</code></pre>
                                </div>
                            {/if}
                        </div>
                    {/if}

                    {#if message.data}
                        <div class="data-preview">
                            <strong>Data Preview:</strong>
                            <div class="data-info">
                                {#if message.data.success}
                                    Found {message.data.numRows || 0} rows
                                    {#if message.data.columns}
                                        <div class="columns-info">
                                            Columns: {message.data.columns.join(
                                                ", ",
                                            )}
                                        </div>
                                    {/if}
                                {:else}
                                    Error: {message.data.error}
                                {/if}
                            </div>
                        </div>
                    {/if}
                </div>
            </div>
        {/each}

        {#if isLoading}
            <div class="message ai loading">
                <div class="message-header">
                    <span class="sender">AI Assistant</span>
                    <span class="timestamp">thinking...</span>
                </div>
                <div class="message-content">
                    <div class="typing-indicator">
                        <span></span>
                        <span></span>
                        <span></span>
                    </div>
                </div>
            </div>
        {/if}
    </div>

    <div class="chat-input">
        <textarea
            bind:value={currentMessage}
            onkeydown={handleKeyDown}
            placeholder="Ask me anything about your data..."
            rows="3"
        ></textarea>
        <div class="chat-input-controls">
            <div class="chat-input-buttons">
                <button
                    onclick={isLoading ? cancelRequest : sendMessage}
                    disabled={currentMessage.trim() === "" && !isLoading}
                    type="submit"
                    title={isLoading ? "Cancel request" : "Send message"}
                >
                    {#if isLoading}
                        <Pause size={18} />
                    {:else}
                        <Send size={18} />
                    {/if}
                </button>
                <button onclick={newChat} type="submit" title="New chat">
                    <MessageSquarePlus size={18} />
                </button>
                <button onclick={openMemory} type="button" title="AI Memory">
                    <Brain size={18} />
                </button>
                <button onclick={openSettings} type="button" title="Settings">
                    <Settings size={18} />
                </button>
            </div>
            <div class="selectors-row">
                <div class="environment-selector-wrapper">
                    <label>Environment</label>
                    <EnvironmentSelector
                        bind:selectedEnvironment
                        onChange={handleEnvironmentChange}
                    />
                </div>
                <div class="model-selector-wrapper">
                    <label>Model</label>
                    <select value={selectedModel} onchange={handleModelChange}>
                        {#each getConfig().models as model}
                            <option value={model.id}>{model.name}</option>
                        {/each}
                    </select>
                </div>
            </div>
        </div>
    </div>
</div>

<SettingsDialog
    bind:isOpen={showSettings}
    bind:systemPrompt
    onSave={handleSystemPromptSave}
    getDefaultPrompt={getDefaultSystemPrompt}
/>

<MemoryDialog
    bind:isOpen={showMemory}
    bind:memory={aiMemory}
    onSave={handleMemorySave}
/>

<DisclaimerDialog
    bind:isOpen={showDisclaimer}
    disclaimerText={getConfig().disclaimer}
/>

<style>
    .chat-container {
        display: flex;
        flex-direction: column;
        flex: 1;
        font-family: Inter, ui-sans-serif;
        background: #fafafa;
        height: 100%;
    }

    .selectors-row {
        display: flex;
        gap: 0.5rem;
        align-items: flex-start;
    }

    .environment-selector-wrapper {
        display: flex;
        flex-direction: column;
        gap: 0.125rem;
    }

    .environment-selector-wrapper label,
    .model-selector-wrapper label {
        font-size: 0.8rem;
        font-weight: 500;
        color: #888;
    }

    .model-selector-wrapper {
        display: flex;
        flex-direction: column;
        gap: 0.125rem;
    }

    .model-selector-wrapper select {
        padding: 4px 8px;
        border: 1px solid #ccc;
        border-radius: 4px;
        font-size: 0.85rem;
    }

    .chat-messages {
        flex: 1;
        overflow-y: auto;
        padding: 0.5rem 1rem;
        display: flex;
        flex-direction: column;
        gap: 2px;
    }

    .welcome-message {
        text-align: center;
        color: #666;
        padding: 2rem;
        background: white;
        border-radius: 12px;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    }

    .welcome-message h2 {
        color: #333;
        margin-bottom: 1rem;
    }

    .welcome-message ul {
        text-align: left;
        max-width: 400px;
        margin: 1rem auto;
    }

    .message {
        padding: 0.375rem 0.75rem;
        border-radius: 4px;
    }

    .message.user {
        background: transparent;
        color: #333;
    }

    .message.ai {
        background: transparent;
        color: #333;
    }

    .message.tool {
        background: #f8f9fa;
        color: #495057;
        border: 1px solid #dee2e6;
    }

    .message:hover {
        background: rgba(0, 0, 0, 0.1);
    }

    .message-header {
        display: flex;
        align-items: baseline;
        gap: 0.5rem;
        margin-bottom: 0.125rem;
        font-size: 0.8125rem;
    }

    .message-header .timestamp {
        color: #999;
        font-size: 0.75rem;
        font-weight: 400;
    }

    .collapse-toggle {
        background: none;
        border: none;
        color: inherit;
        cursor: pointer;
        padding: 2px;
        display: flex;
        align-items: center;
        justify-content: center;
        opacity: 0.7;
        transition: all 0.2s;
    }

    .collapse-toggle:hover {
        opacity: 1;
    }

    .sender {
        font-weight: 700;
        color: #1d1c1d;
        font-size: 0.9375rem;
        display: inline-flex;
        align-items: center;
        gap: 0.25rem;
        overflow: hidden;
    }

    .tool-summary {
        font-weight: 400;
        color: #666;
        font-size: 0.8125rem;
        margin-left: 0.25rem;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }

    .message-content {
        line-height: 1.6;
    }

    .message-content.collapsed {
        display: none;
    }

    /* Markdown styling for AI messages */
    .message.ai .message-content :global(h1),
    .message.ai .message-content :global(h2),
    .message.ai .message-content :global(h3),
    .message.ai .message-content :global(h4),
    .message.ai .message-content :global(h5),
    .message.ai .message-content :global(h6) {
        margin-top: 1em;
        margin-bottom: 0.5em;
        font-weight: 600;
    }

    .message.ai .message-content :global(h1) {
        font-size: 1.5em;
    }

    .message.ai .message-content :global(h2) {
        font-size: 1.3em;
    }

    .message.ai .message-content :global(h3) {
        font-size: 1.1em;
    }

    .message.ai .message-content :global(p) {
        margin-bottom: 0.8em;
    }

    .message.ai .message-content :global(ul),
    .message.ai .message-content :global(ol) {
        margin-left: 1.5em;
        margin-bottom: 0.8em;
    }

    .message.ai .message-content :global(li) {
        margin-bottom: 0.3em;
    }

    .message.ai .message-content :global(pre) {
        background-color: #f1f1f1;
        border-radius: 4px;
        padding: 12px;
        margin: 0.8em 0;
        overflow-x: auto;
    }

    .message.ai .message-content :global(code) {
        background-color: #f1f1f1;
        padding: 2px 4px;
        border-radius: 3px;
        font-family: "Monaco", "Menlo", "Ubuntu Mono", monospace;
        font-size: 0.75em;
    }

    .message.ai .message-content :global(pre code) {
        background-color: transparent;
        padding: 0;
    }

    .message.ai .message-content :global(blockquote) {
        border-left: 3px solid rgba(255, 255, 255, 0.3);
        margin-left: 0;
        padding-left: 1em;
        font-style: italic;
    }

    .message.ai .message-content :global(a) {
        color: #4a9eff;
        text-decoration: none;
    }

    .message.ai .message-content :global(a:hover) {
        text-decoration: underline;
    }

    .message.ai .message-content :global(table) {
        border-collapse: collapse;
        margin: 0.8em 0;
        width: 100%;
    }

    .message.ai .message-content :global(th),
    .message.ai .message-content :global(td) {
        border: 1px solid rgba(255, 255, 255, 0.2);
        padding: 8px 12px;
        text-align: left;
    }

    .message.ai .message-content :global(th) {
        background-color: rgba(255, 255, 255, 0.05);
        font-weight: 600;
    }

    .message.ai .message-content :global(hr) {
        border: none;
        border-top: 1px solid rgba(255, 255, 255, 0.2);
        margin: 1.5em 0;
    }

    .message.ai .message-content :global(strong) {
        font-weight: 600;
    }

    .message.ai .message-content :global(em) {
        font-style: italic;
    }

    .query-block {
        margin-top: 1rem;
        padding: 1rem;
        background: #f5f5f5;
        border-radius: 8px;
        border-left: 4px solid #667eea;
    }

    .query-block pre {
        margin: 0.5rem 0 0 0;
        font-size: 0.9rem;
        white-space: pre-wrap;
        word-break: break-all;
    }

    .data-preview {
        margin-top: 1rem;
        padding: 1rem;
        background: #e8f5e8;
        border-radius: 8px;
        border-left: 4px solid #4caf50;
    }

    .data-info {
        margin-top: 0.5rem;
        font-size: 0.9rem;
        color: #2e7d32;
    }

    .columns-info {
        margin-top: 0.25rem;
        font-size: 0.8rem;
        color: #4caf50;
        font-style: italic;
    }

    .function-args {
        margin-top: 0.5rem;
        padding: 0.5rem;
        background: #f0f8ff;
        border-radius: 4px;
        font-size: 0.9rem;
        color: #1e40af;
    }

    .function-result {
        margin-top: 0.5rem;
        background: #f8f9fa;
        border-radius: 4px;
        border: 1px solid #dee2e6;
    }

    .function-result pre {
        margin: 0;
        padding: 1rem;
        font-size: 0.85rem;
        white-space: pre-wrap;
        word-break: break-word;
    }

    .tool-result {
        margin-top: 0.5rem;
    }

    .tool-result :global(.resultviewer) {
        min-height: 100px;
        height: auto;
        max-height: 600px;
    }

    .query-loading {
        display: flex;
        align-items: center;
        gap: 1rem;
        padding: 1rem;
        color: #667eea;
        font-size: 0.9rem;
    }

    .query-error {
        padding: 1rem;
        background: #fee;
        border-radius: 8px;
        border-left: 4px solid #dc3545;
    }

    .query-error pre {
        margin: 0;
        font-size: 0.9rem;
        white-space: pre-wrap;
        word-break: break-all;
        color: #dc3545;
    }

    .typing-indicator {
        display: flex;
        gap: 0.25rem;
        align-items: center;
    }

    .typing-indicator span {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: #ccc;
        animation: typing 1.4s infinite ease-in-out;
    }

    .typing-indicator span:nth-child(1) {
        animation-delay: -0.32s;
    }
    .typing-indicator span:nth-child(2) {
        animation-delay: -0.16s;
    }

    @keyframes typing {
        0%,
        80%,
        100% {
            transform: scale(0);
            opacity: 0.5;
        }
        40% {
            transform: scale(1);
            opacity: 1;
        }
    }

    .chat-input {
        display: flex;
        gap: 0.5rem;
        padding: 0.75rem 1rem;
        background: white;
        border-top: 1px solid #e0e0e0;
    }

    .chat-input-controls {
        display: flex;
        flex-direction: column;
        gap: 0.375rem;
        align-self: flex-start;
    }

    .chat-input-buttons {
        display: flex;
        gap: 0.375rem;
    }

    .chat-input textarea {
        flex: 1;
        border: 2px solid #e0e0e0;
        border-radius: 12px;
        padding: 1rem;
        font-family: inherit;
        font-size: 1rem;
        resize: none;
        outline: none;
    }

    .chat-input textarea:focus {
        border-color: #667eea;
    }

    .chat-input button {
        padding: 0.4rem;
        width: 34px;
        height: 34px;
        background: #667eea;
        color: white;
        border: none;
        border-radius: 8px;
        cursor: pointer;
        align-self: center;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
    }

    .chat-input button:hover:not(:disabled) {
        background: #5a67d8;
    }

    .chat-input button:disabled {
        background: #ccc;
        cursor: not-allowed;
    }
</style>
