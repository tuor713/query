/**
 * Service for managing storage of queries and user settings
 */
export class StorageService {
    /**
     * Save a query to local storage
     */
    saveQuery(query) {
        localStorage.setItem("query", query);
    }

    /**
     * Get the most recent query from local storage
     */
    getQuery() {
        return localStorage.getItem("query") || "";
    }

    /**
     * Save the username to local storage
     */
    saveUsername(username) {
        localStorage.setItem("username", username);
    }

    /**
     * Get the username from local storage
     */
    getUsername() {
        return localStorage.getItem("username") || "";
    }

    /**
     * Save the selected environment to local storage
     */
    saveEnvironment(environment) {
        localStorage.setItem("environment", environment);
    }

    /**
     * Get the selected environment from local storage
     */
    getEnvironment() {
        return localStorage.getItem("environment") || null;
    }

    /**
     * Save the collection of saved queries
     */
    saveSavedQueries(queries) {
        localStorage.setItem("savedQueries", JSON.stringify(queries));
    }

    /**
     * Get the collection of saved queries
     */
    getSavedQueries() {
        const savedQueries = localStorage.getItem("savedQueries");
        return savedQueries ? JSON.parse(savedQueries) : [];
    }
}