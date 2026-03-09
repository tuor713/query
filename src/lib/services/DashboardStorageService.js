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

  saveDashboards(dashboards) {
    localStorage.setItem("savedDashboards", JSON.stringify(dashboards));
  }

  getDashboards() {
    const raw = localStorage.getItem("savedDashboards");
    return raw ? JSON.parse(raw) : [];
  }

  saveDashboardFolders(folders) {
    localStorage.setItem("dashboardFolders", JSON.stringify(folders));
  }

  getDashboardFolders() {
    const raw = localStorage.getItem("dashboardFolders");
    return raw ? JSON.parse(raw) : [];
  }
}
