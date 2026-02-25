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

  saveFolders(folders) {
    localStorage.setItem("queryFolders", JSON.stringify(folders));
  }

  getFolders() {
    const folders = localStorage.getItem("queryFolders");
    return folders ? JSON.parse(folders) : [];
  }

  saveSystemPrompt(systemPrompt) {
    localStorage.setItem("systemPrompt", systemPrompt);
  }

  getSystemPrompt() {
    return localStorage.getItem("systemPrompt") || "";
  }

  saveMemory(memory) {
    localStorage.setItem("aiMemory", memory);
  }

  getMemory() {
    return localStorage.getItem("aiMemory") || "";
  }

  saveModel(model) {
    localStorage.setItem("aiModel", model);
  }

  getModel() {
    return localStorage.getItem("aiModel") || "gpt-oss";
  }

  saveWorkspace(tabs, activeTabId) {
    const serializable = tabs.map(({ id, name, query, queryName, limit, keepView,
        editorCollapsed, perspectiveConfig, mosaicSpec, language, display }) =>
      ({ id, name, query, queryName, limit, keepView, editorCollapsed,
         perspectiveConfig, mosaicSpec, language, display }));
    localStorage.setItem("workspace", JSON.stringify({ tabs: serializable, activeTabId }));
  }

  getWorkspace() {
    const raw = localStorage.getItem("workspace");
    return raw ? JSON.parse(raw) : null;
  }
}
