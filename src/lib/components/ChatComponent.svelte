<script>
    import { onMount } from "svelte";
    import { Send, Pause, MessageSquarePlus } from "@lucide/svelte";
    import ResultViewer from "./ResultViewer.svelte";
    import EnvironmentSelector from "./EnvironmentSelector.svelte";
    import { isSelectOnlyQuery } from "$lib/utils/sqlParser.js";
    import { getDefaultEnvironment } from "$lib/config/environments.js";
    import { StorageService } from "$lib";

    let {
        username = "",
        password = "",
        extraCredentials = [],
        queryService,
        aiService,
    } = $props();

    const storageService = new StorageService();
    let selectedEnvironment = $state(
        storageService.getEnvironment() || getDefaultEnvironment(),
    );

    let messages = $state([]);
    let currentMessage = $state("");
    let isLoading = $state(false);
    let chatContainer;
    let resultViewerInstances = $state({});

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

        const aiResponse =
            await aiService.processAIResponse(conversationMessages);
        console.log(`AI response (turn ${turnCount + 1}):`, aiResponse);

        // If response is empty, stop the conversation
        if (
            isLoading &&
            !aiResponse.text?.trim() &&
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

        // If there's a function call, add the query to the AI message
        if (
            aiResponse.function_call &&
            aiResponse.function_call.name === "execute_sql_query"
        ) {
            aiMessage.query = aiResponse.function_call.arguments.query;
        }

        messages = [...messages, aiMessage];
        setTimeout(scrollToBottom, 10);

        // Handle function calls
        if (aiResponse.function_call) {
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

        if (name === "execute_sql_query") {
            // Validate that the query only contains SELECT statements
            console.log("Processing query", args.query);
            const validation = isSelectOnlyQuery(args.query);

            const toolMessageId = messageId + 1;

            if (!validation.valid) {
                // Add tool message with validation error
                const toolMessage = {
                    id: toolMessageId,
                    type: "tool",
                    content: "",
                    query: args.query,
                    queryError: `Query validation failed: ${validation.error}`,
                    isExecuting: false,
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
                content: "",
                query: args.query,
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
                    // Update the tool message with the result
                    messages = messages.map((msg) =>
                        msg.id === toolMessageId
                            ? {
                                  ...msg,
                                  queryResult: result.data,
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

                    toolResult = { success: true, data: result.data };
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
        }

        return toolResult;
    }

    function handleKeyDown(e) {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    }
</script>

<div class="chat-container">
    <div class="chat-messages" bind:this={chatContainer}>
        {#if messages.length === 0}
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

        {#each messages as message (message.id)}
            <div class="message {message.type}">
                <div class="message-header">
                    <span class="sender"
                        >{message.type === "user"
                            ? "You"
                            : message.type === "tool"
                              ? "Tool Response"
                              : message.function_call
                                ? `AI Assistant: Tool ${message.function_call.name}`
                                : "AI Assistant"}</span
                    >
                    <span class="timestamp"
                        >{message.timestamp.toLocaleTimeString()}</span
                    >
                </div>
                <div class="message-content">
                    {message.content}

                    {#if message.query}
                        <pre><code>{message.query}</code></pre>
                    {/if}

                    {#if message.type === "tool"}
                        <div class="tool-result">
                            {#if message.isExecuting}
                                <div class="query-loading">
                                    <div class="typing-indicator">
                                        <span></span>
                                        <span></span>
                                        <span></span>
                                    </div>
                                    <span>Executing query...</span>
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
        <button
            onclick={isLoading ? cancelRequest : sendMessage}
            disabled={currentMessage.trim() === "" && !isLoading}
            type="submit"
        >
            {#if isLoading}
                <Pause />
            {:else}
                <Send />
            {/if}
        </button>
        <button onclick={newChat} type="submit">
            <MessageSquarePlus />
        </button>
        <div class="environment-selector-wrapper">
            <label>Environment:</label>
            <EnvironmentSelector
                bind:selectedEnvironment
                onChange={handleEnvironmentChange}
            />
        </div>
    </div>
</div>

<style>
    .chat-container {
        display: flex;
        flex-direction: column;
        flex: 1;
        font-family: Inter, ui-sans-serif;
        background: #fafafa;
        height: 100%;
    }

    .environment-selector-wrapper {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
    }

    .environment-selector-wrapper label {
        font-size: 0.9rem;
        font-weight: 500;
        color: #555;
    }

    .chat-messages {
        flex: 1;
        overflow-y: auto;
        padding: 2rem;
        display: flex;
        flex-direction: column;
        gap: 1.5rem;
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
        width: 95%;
        padding: 1rem 1.5rem;
        border-radius: 12px;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    }

    .message.user {
        background: #667eea;
        color: white;
    }

    .message.ai {
        background: white;
        color: #333;
    }

    .message.tool {
        background: #f8f9fa;
        color: #495057;
        border: 1px solid #dee2e6;
    }

    .message-header {
        display: flex;
        justify-content: space-between;
        margin-bottom: 0.5rem;
        font-size: 0.85rem;
        opacity: 0.8;
    }

    .sender {
        font-weight: 600;
    }

    .message-content {
        line-height: 1.5;
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

    .tool-result {
        margin-top: 0.5rem;
    }

    .tool-result :global(.resultviewer) {
        min-height: 400px;
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
        gap: 1rem;
        padding: 1.5rem 2rem;
        background: white;
        border-top: 1px solid #e0e0e0;
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
        padding: 0.5rem 1rem;
        background: #667eea;
        color: white;
        border: none;
        border-radius: 12px;
        cursor: pointer;
        font-weight: 600;
        font-size: 1rem;
        align-self: center;
    }

    .chat-input button:hover:not(:disabled) {
        background: #5a67d8;
    }

    .chat-input button:disabled {
        background: #ccc;
        cursor: not-allowed;
    }
</style>
