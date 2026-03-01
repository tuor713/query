/**
 * Format a duration in milliseconds to a human-readable string.
 * @param {number} ms
 * @returns {string}
 */
export function formatQueryTime(ms) {
    if (ms < 5000) {
        return `${new Intl.NumberFormat().format(Math.round(ms))} ms`;
    } else if (ms < 60000) {
        return `${(ms / 1000).toFixed(1)} sec`;
    } else {
        const minutes = Math.floor(ms / 60000);
        const seconds = Math.round((ms % 60000) / 1000);
        return `${minutes} min ${seconds} sec`;
    }
}
