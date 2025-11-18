// CommonJS entry for Electron main process
const {
  app,
  BrowserWindow,
  shell,
  ipcMain,
  dialog,
} = require("electron");
const path = require("node:path");
const fs = require("node:fs");

const isDev = !app.isPackaged;

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, "preload.cjs"),
    },
  });

  if (isDev) {
    // dev server started by `vite` (desktop:dev)
    win.loadURL("http://localhost:5173/");
    win.webContents.openDevTools({ mode: "detach" });
  } else {
    // load your Vite build
    win.loadFile(path.join(__dirname, "..", "dist", "index.html"));
  }

  win.removeMenu();

  // open external links in the OS default browser
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });
}

function registerIpcHandlers() {
  ipcMain.handle("export-history-pdf", async (event, options = {}) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    const suggestedName =
      options.suggestedName || "historia_clinica.pdf";

    const { canceled, filePath } = await dialog.showSaveDialog(win, {
      title: "Guardar historia clínica como PDF",
      defaultPath: suggestedName,
      filters: [{ name: "PDF", extensions: ["pdf"] }],
    });

    if (canceled || !filePath) {
      return { ok: false, reason: "cancelled" };
    }

    const pdfBuffer = await win.webContents.printToPDF({
      printBackground: true,
      pageSize: "Letter",
      marginsType: 1, // márgenes mínimos, layout controlado por CSS
    });

    await fs.promises.writeFile(filePath, pdfBuffer);

    return { ok: true, filePath };
  });
}

app.whenReady().then(() => {
  registerIpcHandlers();
  createWindow();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
