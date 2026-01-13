# Project Description

This project is a Trino Data Explorer - a single page web application that allows users to explore datasets from a Trino backend in the browser. It uses Perspective grid as well as Mosaic with embedded DuckDB to achieve this. Additionally, it supports Malloy for higher level querying, visualization and particularly reusability of data models and metrics. The application also includes an AI chat assistant for natural language query generation.

## Technologies and Layout

- **Frontend:** Svelte 5 with SvelteKit
- **Backend:** Python Tornado server (backend/server.py)
- **Database:** Trino (not included in this repo)
- **Key Libraries:** Perspective.js, Mosaic, DuckDB WASM, Malloy, Monaco Editor, Vega-Lite, Apache Arrow

## Feature Navigation Guide

### 1. Query Editor & Execution
**Primary File:** `src/lib/components/QueryEditor.svelte`
- Lines 1-77: Monaco-based code editor with syntax highlighting
- Lines 17-25: Language registration for Malloy and Wvlet
- Lines 28-50: Keyboard shortcuts (Ctrl+Enter to execute)

**Related Files:**
- `src/lib/services/QueryService.js:44-73` - Main executeQuery() function
- `src/lib/utils/sqlParser.js:11-55` - Query rewriting with LIMIT injection
- `src/lib/utils/wvletsyntax.js` - Wvlet syntax highlighting

### 2. Multi-Tab Interface
**Primary File:** `src/lib/components/TabContainer.svelte`
- Lines 1-36: Tab management (add, close, rename)
- Lines 48-82: Tab bar UI with inline name editing
- Each tab maintains independent query state and results

### 3. Query Controls & Configuration
**Primary File:** `src/lib/components/QueryControls.svelte`
- Lines 55-63: Language selection (SQL, Wvlet, Malloy)
- Lines 65-73: Display mode selection (Perspective, Malloy native, Mosaic)
- Lines 81-91: Run button with execution state

**Environment Configuration:**
- `src/lib/config/environments.js:4-43` - Predefined Trino environments
- `src/lib/components/EnvironmentSelector.svelte` - Environment switcher

### 4. Perspective Grid Integration
**Primary File:** `src/lib/components/ResultViewer.svelte`
- Lines 16-42: loadData() - loads Arrow data into Perspective table
- Lines 44-59: Adaptive height calculation
- Lines 61-67: Config save/restore functionality

**Initialization:**
- `src/lib/services/PerspectiveInitializer.js:1-12` - WASM loading

**Features:** Interactive data grid with sorting, filtering, pivoting, and multiple view types

### 5. Mosaic/DuckDB Integration
**Primary File:** `src/lib/components/MosaicViewer.svelte`
- Lines 35-47: loadData() - inserts Arrow data into DuckDB
- Lines 49-58: reloadLayout() - parses YAML spec and renders visualizations
- Lines 63-125: YAML spec editor with Monaco integration

**Features:** In-browser DuckDB with declarative YAML-based visualization specs

### 6. Malloy Query Support
**Primary File:** `src/lib/services/MalloyService.ts`
- Lines 21-68: DESCRIBE query caching (2-hour TTL)
- Lines 70-180: Dynamic URL reader for Malloy imports with caching
- Lines 182-232: Remote Trino runner for Malloy execution
- Lines 253-271: Main runMalloyQuery() function

**Execution Flow:**
- `src/routes/+page.svelte:320-363` - Malloy query execution with native rendering

**Features:** Semantic modeling layer with reusable data definitions and native visualizations

### 7. AI Chat Assistant (Alpha)
**Primary File:** `src/lib/components/ChatComponent.svelte`
- Lines 70-127: Message processing and conversation management
- Lines 129-238: AI conversation loop with function calling
- Lines 240-496: Function call handlers (search, retrieve_doc, execute_sql_query, execute_malloy)
- Lines 539-605: Persistent AI memory (load_memory, save_memory)

**AI Service:**
- `src/lib/services/AIService.js:12-90` - System prompt and instructions
- `src/lib/services/AIService.js:95-120` - Message sending to AI backend
- `src/lib/services/AIService.js:125-156` - Document search
- `src/lib/services/AIService.js:191-252` - Response processing

**Features:** Natural language query generation, multi-turn conversations, automatic execution, persistent memory

### 8. Vega-Lite Chart Integration
**Primary Files:**
- `src/lib/components/VegaLiteChart.svelte:1-57` - Vega-Lite embedding and rendering
- `src/lib/components/MarkdownWithCharts.svelte:1-140` - Custom markdown renderer with Vega-Lite support
  - Lines 10-29: Vega-Lite code block detection
  - Lines 56-75: Dataset injection into Vega specs

**Usage:** AI generates Vega-Lite specs in markdown; charts render inline in chat

### 9. Backend API
**Primary File:** `backend/server.py`
- Lines 53-154: `/trino` endpoint (TrinoArrowHandler)
  - Lines 88-112: Arrow format query execution
  - Lines 115-135: JSON format query execution
- Lines 157-180: `/ai/search` endpoint - Document search
- Lines 183-207: `/ai/retrieve_doc` endpoint - Document retrieval
- Lines 210-278: `/ai/chat` endpoint (AIHandler)

**LLM Support:**
- `backend/llm.py:1-119` - Ollama LLM client implementation
- `backend/llm_factory.py:92-162` - AI functions definitions

### 10. Saved Queries Management
**Primary File:** `src/lib/components/SavedQueriesSidebar.svelte`
- Lines 44-59: Query list with load/delete actions

**Storage Service:**
- `src/lib/services/StorageService.js:1-52` - LocalStorage-based persistence
- Stores: queries, username, environment, language, system prompt, AI memory

**Main App:**
- `src/routes/+page.svelte:144-162` - Query saving logic

### 11. Authentication & Login
**Primary File:** `src/lib/components/LoginComponent.svelte`
- Lines 15-30: Extra credentials support (additional key-value pairs)

**Main App:**
- `src/routes/+page.svelte:111-121` - Login handler

### 12. URL Sharing & Deep Linking
**Primary File:** `src/routes/+page.svelte`
- Lines 60-86: URL parameter parsing for view restoration
- Lines 177-194: copyURL() - exports view state to shareable URL

## Data Flow Architecture

1. User writes query in Monaco editor
2. Query sent to backend `/trino` endpoint via QueryService
3. Backend executes on Trino, returns Apache Arrow IPC format
4. Frontend loads Arrow data into chosen renderer (Perspective/Mosaic/Malloy)
5. Results displayed with interactive visualizations

## Query Languages Supported

1. **SQL** - Direct Trino SQL execution
2. **Wvlet** - Compiled to SQL before execution
3. **Malloy** - Semantic modeling layer with native visualizations

## Visualization Options

1. **Perspective** - Interactive data grid with pivoting (default)
2. **Mosaic** - Declarative visualizations with embedded DuckDB
3. **Malloy Native** - Malloy's built-in rendering
4. **Vega-Lite** - Charts in AI chat responses

## Claude Instructions

- No need to run `npm run dev` to check the frontend. You can run `npm run build` to check for errors in the frontend.
- `npm run build` needs to be run with extended memory, e.g. `export NODE_OPTIONS="--max-old-space-size=8192"`
- Use file:line_number references (e.g., `QueryEditor.svelte:28`) when discussing specific code locations
