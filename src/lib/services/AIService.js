import { tableFromIPC } from "apache-arrow";
import { StorageService } from "./StorageService.js";

/**
 * AI Service for handling chat interactions with Ollama backend
 */
export class AIService {
  constructor(baseUrl = "http://localhost:8888") {
    this.baseUrl = baseUrl;
    this.storageService = new StorageService();
  }

  getDefaultSystemPrompt() {
    return `You are a helpful AI assistant that can analyze data and run SQL queries.
When users ask about data or request queries, use the "execute_sql_query" function to run the appropriate SQL query.
When there are existing Malloy models or examples available, prefer using the "execute_malloy" function instead of SQL as it provides more reusable and semantic querying capabilities.
You can take multiple turns to answer the user's question. When data has been retrieved successfully (non-zero rows retrieved succesfully), respond with an empty message or 'STOP'.
The user will be able to see the full results of the query.

- Today's date is {{today}}.
- DO NOT generate data modification queries (INSERT, DELETE, DROP, UPDATE, TRUNCATE, etc.)
- Use the "search" and "retrieve_doc" functions to access knowledge and sample queries.
- Where necessary, use DESCRIBE <table> and SHOW TABLES FROM <schema>, SHOW SCHEMAS FROM <catalog> and SHOW CATALOGS for table metadata and schema discovery where needed
- For Malloy queries, include all necessary model definitions, imports, and experimental parameter settings in the query.
`;
  }

  /**
   * Send a chat message to the AI and handle function calls
   */
  async sendMessage(messages) {
    try {
      const response = await fetch(`${this.baseUrl}/ai/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messages: messages,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      const result = await response.json();

      return {
        success: true,
        ...result,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Search for documents using the AI search endpoint
   */
  async search(query) {
    try {
      const response = await fetch(`${this.baseUrl}/ai/search`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          query: query,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      const yamlContent = await response.text();

      return {
        success: true,
        content: yamlContent,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Retrieve a specific document by ID
   */
  async retrieveDoc(docId) {
    try {
      const response = await fetch(`${this.baseUrl}/ai/retrieve_doc`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          doc_id: docId,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      const textContent = await response.text();

      return {
        success: true,
        content: textContent,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Process AI response and handle function calls
   */
  async processAIResponse(chatHistory) {
    // Get custom system prompt or use default
    const customSystemPrompt = this.storageService.getSystemPrompt();
    const defaultSystemPrompt = this.getDefaultSystemPrompt();

    // Replace {{today}} variable with actual date
    const today = new Date().toISOString().split("T")[0];
    const systemPromptContent = (
      customSystemPrompt || defaultSystemPrompt
    ).replace(/\{\{today\}\}/g, today);

    // Build messages array with system prompt and full chat history
    const messages = [
      {
        role: "system",
        content: systemPromptContent,
      },
    ];

    // Add chat history (excluding system messages) - process sequentially to handle async operations
    for (const msg of chatHistory) {
      if (msg.type === "user") {
        messages.push({
          role: "user",
          content: msg.content,
        });
      } else if (msg.type === "ai") {
        messages.push({
          role: "assistant",
          content: msg.content,
          function_call: msg.function_call,
        });
      } else if (msg.type === "tool") {
        let toolContent = msg.content;

        // For SHOW/DESCRIBE queries, format results as tab-separated table
        if (msg.queryResult && msg.query) {
          const queryUpper = msg.query.trim().toUpperCase();
          if (
            queryUpper.startsWith("SHOW") ||
            queryUpper.startsWith("DESCRIBE")
          ) {
            toolContent = await this.formatResultsAsTable(msg.queryResult);
          } else {
            toolContent = await this.formatResultMetadata(msg.queryResult);
          }
        } else if (msg.queryError) {
          toolContent = `Error: ${msg.queryError}`;
        }

        messages.push({
          role: "tool",
          name: msg.function_name || "execute_sql_query",
          content:
            `${msg.function_name || "execute_sql_query"}:\n` + toolContent,
        });
      }
    }

    const aiResponse = await this.sendMessage(messages);

    return aiResponse;
  }

  async formatResultMetadata(resultData) {
    try {
      // Handle Arrow ArrayBuffer format
      if (resultData instanceof ArrayBuffer) {
        const arrowTable = tableFromIPC(resultData);
        const header = arrowTable.schema.fields
          .map((field) => field.name)
          .join("|");

        return (
          "Query successful.\n\n- Schema: " +
          header +
          "\n- Rows: " +
          arrowTable.numRows
        );
      } else if (Array.isArray(resultData)) {
        if (resultData.length > 0) {
          let schema = Object.keys(resultData[0]).join(",");
          return (
            "Query successful.\n\n- Schema: " +
            schema +
            "\n- Rows: " +
            resultData.length
          );
        } else {
          return "Query successful.\n\n- Rows: " + resultData.length;
        }
      } else {
        console.log("Unknown result format:", resultData);
        return "Query executed successfully";
      }
    } catch (error) {
      console.error("Error formatting Arrow results:", error);
      return `Error formatting results: ${error.message}`;
    }
  }

  async formatResultsAsTable(resultData) {
    try {
      // Handle Arrow ArrayBuffer format
      if (resultData instanceof ArrayBuffer) {
        const arrowTable = tableFromIPC(resultData);
        const header = arrowTable.schema.fields
          .map((field) => field.name)
          .join("|");
        const rows = arrowTable.toArray().map((row) => {
          return row.toArray().join("|");
        });
        return "Query successful:\n\n" + [header, ...rows].join("\n");
      }

      return "Query executed successfully";
    } catch (error) {
      console.error("Error formatting Arrow results:", error);
      return `Error formatting results: ${error.message}`;
    }
  }
}
