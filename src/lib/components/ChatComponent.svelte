<script>
    import { onMount } from "svelte";
    import { Send } from "@lucide/svelte";

    let {
        username = "",
        password = "",
        extraCredentials = [],
        selectedEnvironment,
        queryService,
    } = $props();

    let messages = $state([]);
    let currentMessage = $state("");
    let isLoading = $state(false);
    let chatContainer;

    onMount(() => {
        scrollToBottom();
    });

    function scrollToBottom() {
        if (chatContainer) {
            chatContainer.scrollTop = chatContainer.scrollHeight;
        }
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
        const messageToProcess = currentMessage;
        currentMessage = "";
        isLoading = true;

        setTimeout(scrollToBottom, 10);

        try {
            const aiResponse = await processMessageWithAI(messageToProcess);

            const aiMessage = {
                id: Date.now() + 1,
                type: "ai",
                content: aiResponse.text,
                data: aiResponse.data,
                query: aiResponse.query,
                timestamp: new Date(),
            };

            messages = [...messages, aiMessage];
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

    async function processMessageWithAI(message) {
        if (
            message.toLowerCase().includes("query") ||
            message.toLowerCase().includes("sql")
        ) {
            const sampleQuery = `SELECT * FROM sample_table WHERE condition LIKE '%${message}%' LIMIT 10`;

            try {
                const result = await queryService.executeQuery(
                    sampleQuery,
                    1000,
                    username,
                    password,
                    selectedEnvironment,
                    "arrow",
                    extraCredentials,
                );

                return {
                    text: `I've executed a query based on your request. Here's what I found:`,
                    query: sampleQuery,
                    data: result.success ? result.data : null,
                };
            } catch (error) {
                return {
                    text: `I generated this query for you, but couldn't execute it: ${error.message}`,
                    query: sampleQuery,
                    data: null,
                };
            }
        }

        return {
            text: `I understand you're asking about: "${message}". I can help you query and analyze your data. Try asking me to "run a query" or describe what data you're looking for.`,
            data: null,
            query: null,
        };
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
                            : "AI Assistant"}</span
                    >
                    <span class="timestamp"
                        >{message.timestamp.toLocaleTimeString()}</span
                    >
                </div>
                <div class="message-content">
                    {message.content}

                    {#if message.query}
                        <div class="query-block">
                            <strong>Generated Query:</strong>
                            <pre><code>{message.query}</code></pre>
                        </div>
                    {/if}

                    {#if message.data}
                        <div class="data-preview">
                            <strong>Data Preview:</strong>
                            <div class="data-info">
                                Found {message.data.numRows || 0} rows
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
            on:keydown={handleKeyDown}
            placeholder="Ask me anything about your data..."
            rows="3"
        ></textarea>
        <button
            on:click={sendMessage}
            disabled={!currentMessage.trim() || isLoading}
        >
            <Send />
        </button>
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
        max-width: 80%;
        padding: 1rem 1.5rem;
        border-radius: 12px;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    }

    .message.user {
        align-self: flex-end;
        background: #667eea;
        color: white;
    }

    .message.ai {
        align-self: flex-start;
        background: white;
        color: #333;
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
