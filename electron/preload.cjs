// Keep minimal. You can expose safe APIs if needed.
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("appInfo", {
  electron: process.versions.electron,
  chrome: process.versions.chrome,
});

contextBridge.exposeInMainWorld("electronAPI", {
  /**
   * Export current window contents to a PDF file (desktop only).
   * Used from the /print/:patientId view.
   */
  exportHistoryPdf(options) {
    return ipcRenderer.invoke("export-history-pdf", options || {});
  },
});

contextBridge.exposeInMainWorld("dbFileApi", {
  loadDbBytes(username) {
    return ipcRenderer.invoke("db-file-load", username);
  },
  saveDbBytes(username, data) {
    return ipcRenderer.invoke("db-file-save", { username, data });
  },
});

contextBridge.exposeInMainWorld("authApi", {
  login(username) {
    return ipcRenderer.invoke("user-login", username);
  },
  create(username, userData) {
    return ipcRenderer.invoke("user-create", { username, userData });
  },
  update(username, userData) {
    return ipcRenderer.invoke("user-update", { username, userData });
  },
  hasUsers() {
    return ipcRenderer.invoke("user-list-check");
  },
});
