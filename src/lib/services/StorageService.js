/**
 * Service for managing storage of queries and user settings
 */
export class StorageService {
  saveQuery(query) {
    localStorage.setItem("query", query);
  }

  getQuery() {
    return localStorage.getItem("query") || "";
  }

  saveLanguage(language) {
    localStorage.setItem("language", language);
  }

  getLanguage() {
    return localStorage.getItem("language") || "sql";
  }

  saveUsername(username) {
    localStorage.setItem("username", username);
  }

  getUsername() {
    return localStorage.getItem("username") || "";
  }

  saveEnvironment(environment) {
    localStorage.setItem("environment", environment);
  }

  getEnvironment() {
    return localStorage.getItem("environment") || null;
  }

  saveSavedQueries(queries) {
    localStorage.setItem("savedQueries", JSON.stringify(queries));
  }

  getSavedQueries() {
    const savedQueries = localStorage.getItem("savedQueries");
    return savedQueries ? JSON.parse(savedQueries) : [];
  }

  saveSystemPrompt(systemPrompt) {
    localStorage.setItem("systemPrompt", systemPrompt);
  }

  getSystemPrompt() {
    return localStorage.getItem("systemPrompt") || "";
  }
}
