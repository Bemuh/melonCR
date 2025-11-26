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

// --- Paths ---
// In dev: project root. In prod: next to executable.
const BASE_PATH = isDev
  ? process.cwd()
  : path.dirname(process.execPath);

const CONFIG_FILE = path.join(app.getPath("userData"), "config.json");
let dbBasePath = null;

function loadConfig() {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const data = fs.readFileSync(CONFIG_FILE, "utf8");
      const config = JSON.parse(data);
      if (config.dbPath) {
        dbBasePath = config.dbPath;
        console.log("Loaded DB path:", dbBasePath);
      }
    }
  } catch (e) {
    console.error("Error loading config:", e);
  }
}

// Load config immediately
loadConfig();

function getUsersPath() {
  // If no path configured, we can't really read users, or we fallback to a default?
  // For now, if dbBasePath is set, use it. Else fallback to BASE_PATH (dev mode or default).
  return dbBasePath ? path.join(dbBasePath, "users.json") : path.join(BASE_PATH, "users.json");
}

function getDbPath(username) {
  // Sanitize username to be safe for filenames
  const safeName = username.replace(/[^a-z0-9_\-]/gi, "_");
  const base = dbBasePath || BASE_PATH;
  return path.join(base, `clinic_${safeName}.sqljs`);
}

// --- User Management Helpers ---
async function readUsers() {
  try {
    const usersPath = getUsersPath();
    if (!fs.existsSync(usersPath)) return {};
    const data = await fs.promises.readFile(usersPath, "utf8");
    return JSON.parse(data);
  } catch (e) {
    console.error("Error reading users.json:", e);
    return {};
  }
}

async function writeUsers(users) {
  const usersPath = getUsersPath();
  await fs.promises.writeFile(usersPath, JSON.stringify(users, null, 2));
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    title: "Melon Clinic Records",
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
  // --- PDF Export ---
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

  // --- DB File I/O ---
  ipcMain.handle("db-file-load", async (event, username) => {
    if (!username) return null;
    const dbPath = getDbPath(username);
    try {
      if (!fs.existsSync(dbPath)) return null;
      const data = await fs.promises.readFile(dbPath);
      return data; // Returns Buffer (Uint8Array compatible)
    } catch (e) {
      console.error("db-file-load error:", e);
      throw e;
    }
  });

  ipcMain.handle("db-file-save", async (event, { username, data }) => {
    if (!username || !data) throw new Error("Missing username or data");
    const dbPath = getDbPath(username);
    // Atomic write: write to temp then rename? For now, direct write is okay for single user app.
    // Ensure data is a Buffer or Uint8Array
    await fs.promises.writeFile(dbPath, data);
    return true;
  });

  // --- User Management ---
  ipcMain.handle("user-login", async (event, username) => {
    const users = await readUsers();
    return users[username] || null; // Returns user object (with encrypted keys) or null
  });

  ipcMain.handle("user-create", async (event, { username, userData }) => {
    const users = await readUsers();
    if (users[username]) {
      return { ok: false, error: "User already exists" };
    }
    users[username] = userData;
    await writeUsers(users);
    return { ok: true };
  });

  ipcMain.handle("user-update", async (event, { username, userData }) => {
    const users = await readUsers();
    if (!users[username]) {
      return { ok: false, error: "User not found" };
    }
    // Merge or overwrite? Let's overwrite specific fields provided
    users[username] = { ...users[username], ...userData };
    await writeUsers(users);
    return { ok: true };
  });

  ipcMain.handle("user-list-check", async () => {
    const users = await readUsers();
    return Object.keys(users).length > 0;
  });

  // --- Config & Setup ---
  ipcMain.handle("db-config-get", () => {
    return { dbPath: dbBasePath };
  });

  ipcMain.handle("db-config-set", async (event, newPath) => {
    try {
      // Validate path exists?
      if (!fs.existsSync(newPath)) {
        return { ok: false, error: "Path does not exist" };
      }
      dbBasePath = newPath;
      await fs.promises.writeFile(CONFIG_FILE, JSON.stringify({ dbPath: newPath }, null, 2));
      return { ok: true };
    } catch (e) {
      console.error("Error saving config:", e);
      return { ok: false, error: e.message };
    }
  });

  ipcMain.handle("select-folder", async (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    const { canceled, filePaths } = await dialog.showOpenDialog(win, {
      properties: ["openDirectory"],
      title: "Seleccionar carpeta de datos",
    });
    if (canceled || filePaths.length === 0) {
      return null;
    }
    return filePaths[0];
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
