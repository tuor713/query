export class DashboardStorageService {
  saveSnippet(code) {
    localStorage.setItem("dashboard_snippet", code);
  }

  getSnippet() {
    return localStorage.getItem("dashboard_snippet") || null;
  }

  saveLayoutState(state) {
    localStorage.setItem("dashboard_layout", JSON.stringify(state));
  }

  getLayoutState() {
    const raw = localStorage.getItem("dashboard_layout");
    return raw ? JSON.parse(raw) : null;
  }
}
