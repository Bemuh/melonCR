// Keep minimal. You can expose safe APIs if needed.
const { contextBridge } = require('electron');

contextBridge.exposeInMainWorld('appInfo', {
  electron: process.versions.electron,
  chrome: process.versions.chrome,
});
