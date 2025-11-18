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
