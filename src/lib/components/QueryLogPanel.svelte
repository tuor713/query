<script>
    import { Loader, X } from "@lucide/svelte";
    import { formatQueryTime } from "../utils/formatTime.js";

    /** @type {{ sql: string, status: 'running'|'done'|'error', elapsed: number }[]} */
    let { queryLog, running, show = $bindable(), onclose } = $props();

    const wallTime = $derived(
        queryLog.length > 0 ? Math.max(...queryLog.map(q => q.elapsed)) : 0
    );
</script>

{#if running && queryLog.length > 0}
    <div class="query-progress">
        {#each queryLog as q}
            <div class="query-row">
                {#if q.status === 'running'}
                    <Loader size="0.85em" class="spin" />
                {:else if q.status === 'done'}
                    <span class="status-dot done">✓</span>
                {:else}
                    <span class="status-dot error">✗</span>
                {/if}
                <span class="q-sql">{q.sql.length > 80 ? q.sql.slice(0, 80) + '…' : q.sql}</span>
                {#if q.status !== 'running'}
                    <span class="q-time">{formatQueryTime(q.elapsed)}</span>
                {/if}
            </div>
        {/each}
    </div>
{/if}

{#if show && !running && queryLog.length > 0}
    <div class="query-log">
        <div class="query-log-header">
            <span>Query timings</span>
            <button class="icon-btn" onclick={() => { show = false; onclose?.(); }}><X size="0.85em" /></button>
        </div>
        {#each queryLog as q, i}
            <div class="query-row">
                <span class="q-index">{i + 1}</span>
                <span class="status-dot {q.status === 'done' ? 'done' : 'error'}">{q.status === 'done' ? '✓' : '✗'}</span>
                <span class="q-sql">{q.sql}</span>
                <span class="q-time">{formatQueryTime(q.elapsed)}</span>
            </div>
        {/each}
        <div class="query-log-total">
            Total wall time: {formatQueryTime(wallTime)}
        </div>
    </div>
{/if}

<style>
    .query-progress {
        display: flex;
        flex-direction: column;
        gap: 0.2rem;
        padding: 0.4rem 1rem;
        background: #f0f7ff;
        border-bottom: 1px solid #bfdbfe;
        font-size: 0.78rem;
        font-family: monospace;
        flex-shrink: 0;
    }

    .query-log {
        display: flex;
        flex-direction: column;
        gap: 0.2rem;
        padding: 0.4rem 1rem 0.6rem;
        background: #fafafa;
        border-bottom: 1px solid #e0e0e0;
        font-size: 0.78rem;
        font-family: monospace;
        flex-shrink: 0;
        max-height: 200px;
        overflow-y: auto;
    }

    .query-log-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        font-family: Inter, ui-sans-serif;
        font-weight: 600;
        font-size: 0.8rem;
        color: #444;
        margin-bottom: 0.2rem;
    }

    .query-row {
        display: flex;
        align-items: baseline;
        gap: 0.4rem;
        white-space: nowrap;
    }

    .q-sql {
        flex: 1;
        overflow: hidden;
        text-overflow: ellipsis;
        color: #333;
    }

    .q-time {
        color: #666;
        flex-shrink: 0;
    }

    .q-index {
        color: #999;
        min-width: 1.2rem;
        text-align: right;
        flex-shrink: 0;
    }

    .status-dot {
        flex-shrink: 0;
        font-size: 0.7rem;
    }

    .status-dot.done { color: #16a34a; }
    .status-dot.error { color: #dc2626; }

    .query-log-total {
        font-family: Inter, ui-sans-serif;
        font-size: 0.78rem;
        font-weight: 600;
        color: #444;
        border-top: 1px solid #e0e0e0;
        padding-top: 0.3rem;
        margin-top: 0.2rem;
    }

    .icon-btn {
        display: inline-flex;
        align-items: center;
        padding: 0.35rem 0.5rem;
        background: #f5f5f5;
        border: 1px solid #ccc;
        border-radius: 5px;
        cursor: pointer;
        color: #444;
    }

    .icon-btn:hover {
        background: #e5e5e5;
    }

    :global(.spin) {
        animation: spin 1s linear infinite;
        flex-shrink: 0;
    }

    @keyframes spin {
        from { transform: rotate(0deg); }
        to { transform: rotate(360deg); }
    }
</style>
