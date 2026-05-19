import {
  app,
  BrowserWindow,
  clipboard,
  dialog,
  ipcMain,
  Menu,
  nativeImage,
  shell,
  Tray
} from "electron";
import Store from "electron-store";
import { execFile, spawn } from "node:child_process";
import fs from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const APP_ROOT = path.resolve(__dirname, "..");
const HOST = "0.0.0.0";
const DEFAULT_WINDOW_BOUNDS = {
  width: 1180,
  height: 820
};
const MIN_WINDOW_BOUNDS = {
  width: 380,
  height: 640
};

// Change this if you want to point the launcher at another backend.
const DEV_SERVER_ENTRY = path.resolve(__dirname, "../../server/src/index.js");

function defaultServerEntry() {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, "server", "src", "index.js");
  }

  return DEV_SERVER_ENTRY;
}

const store = new Store({
  name: "settings",
  defaults: {
    lastSelectedFolder: "",
    lastUsedPort: 3000,
    autoStart: false,
    minimizeToTray: true,
    windowBounds: {
      ...DEFAULT_WINDOW_BOUNDS
    }
  }
});

let mainWindow;
let tray;
let isQuitting = false;
let serverProcess = null;
let runningTimer = null;
let savingBoundsTimer = null;
const expectedStops = new Set();
const logBuffer = [];
let currentLinks = {
  links: [],
  tailscaleDetected: false
};
let serverState = {
  status: "stopped",
  error: "",
  pid: null,
  folder: store.get("lastSelectedFolder"),
  port: store.get("lastUsedPort"),
  startedAt: null
};

app.setAppUserModelId("com.pocketlan.app");

const gotSingleInstanceLock = app.requestSingleInstanceLock();
if (!gotSingleInstanceLock) {
  app.quit();
}

function getServerEntry() {
  return process.env.LOCALSHARE_SERVER_ENTRY || defaultServerEntry();
}

function getNodeBinary() {
  return process.env.LOCALSHARE_NODE_BINARY || (app.isPackaged ? process.execPath : "node");
}

function createServerEnv(folder, port) {
  const env = {
    ...process.env,
    SHARED_ROOT: folder,
    PORT: String(port),
    HOST
  };

  if (app.isPackaged && !process.env.LOCALSHARE_NODE_BINARY) {
    env.ELECTRON_RUN_AS_NODE = "1";
  }

  return env;
}

function getLogoPath() {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, "logo.png");
  }

  return path.join(APP_ROOT, "public", "logo.png");
}

function getPublicSettings() {
  return {
    lastSelectedFolder: store.get("lastSelectedFolder"),
    lastUsedPort: store.get("lastUsedPort"),
    autoStart: store.get("autoStart"),
    minimizeToTray: store.get("minimizeToTray"),
    windowBounds: store.get("windowBounds")
  };
}

function send(channel, payload) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(channel, payload);
  }
}

function setServerState(patch) {
  serverState = {
    ...serverState,
    ...patch
  };
  send("server:state", serverState);
  updateTrayMenu();
}

function appendLog(stream, text) {
  const chunk = String(text || "").replace(/\r/g, "");
  const lines = chunk.split("\n").filter((line) => line.trim().length > 0);

  for (const line of lines) {
    const entry = {
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      stream,
      text: line,
      timestamp: new Date().toISOString()
    };
    logBuffer.push(entry);
    if (logBuffer.length > 1200) {
      logBuffer.shift();
    }
    send("server:log", entry);
  }
}

function normalizePort(value) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < 1 || number > 65535) {
    return null;
  }

  return number;
}

function normalizeBounds(bounds) {
  const safe = bounds && typeof bounds === "object" ? bounds : {};
  return {
    width: Math.max(Number(safe.width) || DEFAULT_WINDOW_BOUNDS.width, MIN_WINDOW_BOUNDS.width),
    height: Math.max(Number(safe.height) || DEFAULT_WINDOW_BOUNDS.height, MIN_WINDOW_BOUNDS.height)
  };
}

function saveWindowBounds() {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return;
  }

  if (mainWindow.isMinimized() || mainWindow.isMaximized()) {
    return;
  }

  store.set("windowBounds", mainWindow.getBounds());
}

function queueWindowBoundsSave() {
  clearTimeout(savingBoundsTimer);
  savingBoundsTimer = setTimeout(saveWindowBounds, 400);
}

function showMainWindow() {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return;
  }

  mainWindow.show();
  if (mainWindow.isMinimized()) {
    mainWindow.restore();
  }
  mainWindow.focus();
}

function createWindow() {
  const bounds = normalizeBounds(store.get("windowBounds"));
  const logoPath = getLogoPath();

  mainWindow = new BrowserWindow({
    width: bounds.width,
    height: bounds.height,
    minWidth: MIN_WINDOW_BOUNDS.width,
    minHeight: MIN_WINDOW_BOUNDS.height,
    show: false,
    title: "PocketLAN",
    icon: logoPath,
    backgroundColor: "#09090b",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  mainWindow.once("ready-to-show", () => {
    showMainWindow();
  });

  mainWindow.on("resize", queueWindowBoundsSave);
  mainWindow.on("move", queueWindowBoundsSave);

  mainWindow.on("close", (event) => {
    saveWindowBounds();
    if (!isQuitting && store.get("minimizeToTray")) {
      event.preventDefault();
      mainWindow.hide();
    }
  });

  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(path.join(APP_ROOT, "dist", "index.html"));
  }
}

function createTray() {
  const image = nativeImage.createFromPath(getLogoPath());
  const trayImage = image.isEmpty()
    ? nativeImage.createEmpty()
    : image.resize({ width: 16, height: 16, quality: "best" });

  tray = new Tray(trayImage);
  tray.setToolTip("PocketLAN");
  tray.on("click", showMainWindow);
  updateTrayMenu();
}

function updateTrayMenu() {
  if (!tray) {
    return;
  }

  const port = normalizePort(store.get("lastUsedPort")) || 3000;
  const localhostUrl = `http://localhost:${port}`;
  const tailscaleLink = currentLinks.links.find((link) => link.type === "tailscale");
  const isActive = Boolean(serverProcess);

  tray.setContextMenu(
    Menu.buildFromTemplate([
      {
        label: "Open App",
        click: showMainWindow
      },
      { type: "separator" },
      {
        label: "Start Server",
        enabled: !isActive,
        click: () => startServer()
      },
      {
        label: "Stop Server",
        enabled: isActive,
        click: () => stopServer()
      },
      { type: "separator" },
      {
        label: "Copy Localhost Link",
        click: () => clipboard.writeText(localhostUrl)
      },
      {
        label: "Copy Tailscale Link",
        enabled: Boolean(tailscaleLink),
        click: () => clipboard.writeText(tailscaleLink.url)
      },
      { type: "separator" },
      {
        label: "Quit",
        click: () => {
          isQuitting = true;
          killServerProcessNow();
          app.quit();
        }
      }
    ])
  );
}

function isIPv4(address) {
  return typeof address === "string" && /^\d{1,3}(\.\d{1,3}){3}$/.test(address);
}

function isLanIPv4(address) {
  if (!isIPv4(address)) {
    return false;
  }

  const parts = address.split(".").map(Number);
  return (
    parts[0] === 10 ||
    (parts[0] === 192 && parts[1] === 168) ||
    (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31)
  );
}

function isTailscaleIPv4(address) {
  return isIPv4(address) && address.startsWith("100.");
}

function interfaceAddresses() {
  return Object.values(os.networkInterfaces())
    .flat()
    .filter((entry) => entry && (entry.family === "IPv4" || entry.family === 4))
    .filter((entry) => !entry.internal)
    .map((entry) => entry.address);
}

function readTailscaleIp() {
  return new Promise((resolve) => {
    execFile(
      "tailscale",
      ["ip", "-4"],
      {
        timeout: 2000,
        windowsHide: true
      },
      (error, stdout) => {
        if (error) {
          resolve([]);
          return;
        }

        const addresses = String(stdout)
          .split(/\s+/)
          .map((line) => line.trim())
          .filter(isTailscaleIPv4);

        resolve(addresses);
      }
    );
  });
}

async function collectLinks(portValue = store.get("lastUsedPort")) {
  const port = normalizePort(portValue) || 3000;
  const addresses = interfaceAddresses();
  const lanAddresses = [...new Set(addresses.filter(isLanIPv4))];
  const tailscaleAddresses = new Set(addresses.filter(isTailscaleIPv4));

  for (const ip of await readTailscaleIp()) {
    tailscaleAddresses.add(ip);
  }

  const links = [
    {
      type: "local",
      label: "Localhost",
      url: `http://localhost:${port}`
    },
    {
      type: "loopback",
      label: "127.0.0.1",
      url: `http://127.0.0.1:${port}`
    },
    ...lanAddresses.map((ip) => ({
      type: "lan",
      label: `LAN ${ip}`,
      url: `http://${ip}:${port}`
    })),
    ...[...tailscaleAddresses].map((ip) => ({
      type: "tailscale",
      label: `Tailscale ${ip}`,
      url: `http://${ip}:${port}`
    }))
  ];

  return {
    links,
    tailscaleDetected: tailscaleAddresses.size > 0
  };
}

async function updateLinks(port) {
  currentLinks = await collectLinks(port);
  send("links:updated", currentLinks);
  updateTrayMenu();
  return currentLinks;
}

function checkPortAvailable(port) {
  return new Promise((resolve) => {
    const tester = net.createServer();

    tester.once("error", (error) => {
      if (error.code === "EADDRINUSE") {
        resolve({
          ok: false,
          error: `Port ${port} is already in use.`
        });
        return;
      }

      resolve({
        ok: false,
        error: `Port ${port} cannot be used: ${error.message}`
      });
    });

    tester.once("listening", () => {
      tester.close(() => {
        resolve({
          ok: true
        });
      });
    });

    tester.listen(port, HOST);
  });
}

function validateFolder(folder) {
  if (!folder || typeof folder !== "string") {
    return "Select a folder before starting the server.";
  }

  if (!fs.existsSync(folder)) {
    return `Selected folder does not exist: ${folder}`;
  }

  if (!fs.statSync(folder).isDirectory()) {
    return `Selected path is not a folder: ${folder}`;
  }

  return "";
}

function setLaunchError(message) {
  appendLog("error", message);
  setServerState({
    status: "error",
    error: message,
    pid: null,
    startedAt: null
  });
  return {
    ok: false,
    error: message,
    state: serverState
  };
}

async function startServer(payload = {}) {
  if (serverProcess) {
    return {
      ok: false,
      error: "The server is already running.",
      state: serverState
    };
  }

  const folder = String(
    payload.folder ?? store.get("lastSelectedFolder") ?? ""
  ).trim();
  const port = normalizePort(payload.port ?? store.get("lastUsedPort"));
  const folderError = validateFolder(folder);

  if (folderError) {
    return setLaunchError(folderError);
  }

  if (!port) {
    return setLaunchError("Port must be a number between 1 and 65535.");
  }

  const portCheck = await checkPortAvailable(port);
  if (!portCheck.ok) {
    return setLaunchError(portCheck.error);
  }

  const serverEntry = getServerEntry();
  if (!fs.existsSync(serverEntry)) {
    return setLaunchError(`Server entry file was not found: ${serverEntry}`);
  }

  store.set("lastSelectedFolder", folder);
  store.set("lastUsedPort", port);
  send("settings:changed", getPublicSettings());

  setServerState({
    status: "starting",
    error: "",
    pid: null,
    folder,
    port,
    startedAt: new Date().toISOString()
  });
  appendLog("system", `Starting server on ${HOST}:${port}`);
  appendLog("system", `Sharing folder: ${folder}`);

  const child = spawn(
    getNodeBinary(),
    [serverEntry, "--folder", folder, "--port", String(port), "--host", HOST],
    {
      cwd: path.dirname(serverEntry),
      env: createServerEnv(folder, port),
      windowsHide: true
    }
  );

  serverProcess = child;
  updateTrayMenu();

  child.stdout.on("data", (data) => appendLog("stdout", data));
  child.stderr.on("data", (data) => appendLog("stderr", data));

  child.once("error", (error) => {
    serverProcess = null;
    clearTimeout(runningTimer);
    const message =
      error.code === "ENOENT"
        ? "Node.js was not found. Install Node.js or set LOCALSHARE_NODE_BINARY."
        : error.message;
    setLaunchError(message);
  });

  child.once("close", (code, signal) => {
    const expected = expectedStops.has(child.pid);
    expectedStops.delete(child.pid);
    if (serverProcess === child) {
      serverProcess = null;
    }
    clearTimeout(runningTimer);

    if (expected) {
      appendLog("system", "Server stopped.");
      setServerState({
        status: "stopped",
        error: "",
        pid: null,
        startedAt: null
      });
      return;
    }

    const message = `Server exited with code ${code ?? "unknown"}${signal ? ` and signal ${signal}` : ""}.`;
    appendLog("error", message);
    setServerState({
      status: "error",
      error: message,
      pid: null,
      startedAt: null
    });
  });

  runningTimer = setTimeout(async () => {
    if (serverProcess === child) {
      setServerState({
        status: "running",
        error: "",
        pid: child.pid,
        folder,
        port
      });
      appendLog("system", `Server is running at http://localhost:${port}`);
      await updateLinks(port);
    }
  }, 900);

  return {
    ok: true,
    state: serverState
  };
}

function stopServer() {
  if (!serverProcess) {
    setServerState({
      status: "stopped",
      error: "",
      pid: null,
      startedAt: null
    });
    return Promise.resolve({
      ok: true,
      state: serverState
    });
  }

  const child = serverProcess;
  expectedStops.add(child.pid);
  appendLog("system", "Stopping server...");

  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      if (process.platform === "win32" && child.pid) {
        execFile(
          "taskkill",
          ["/PID", String(child.pid), "/T", "/F"],
          { windowsHide: true },
          () => {}
        );
      } else {
        child.kill("SIGKILL");
      }
    }, 2500);

    child.once("close", () => {
      clearTimeout(timeout);
      resolve({
        ok: true,
        state: serverState
      });
    });

    try {
      child.kill("SIGTERM");
    } catch {
      clearTimeout(timeout);
      resolve({
        ok: true,
        state: serverState
      });
    }
  });
}

function killServerProcessNow() {
  if (!serverProcess) {
    return;
  }

  const child = serverProcess;
  expectedStops.add(child.pid);

  try {
    child.kill("SIGTERM");
  } catch {
    return;
  }

  if (process.platform === "win32" && child.pid) {
    execFile(
      "taskkill",
      ["/PID", String(child.pid), "/T", "/F"],
      { windowsHide: true },
      () => {}
    );
  }
}

async function restartServer(payload = {}) {
  if (!serverProcess) {
    return {
      ok: false,
      error: "Server is stopped. Start it first.",
      state: serverState
    };
  }

  await stopServer();
  return startServer(payload);
}

ipcMain.handle("app:get-initial-state", async () => {
  return {
    settings: getPublicSettings(),
    server: serverState,
    logs: logBuffer,
    links: await updateLinks(store.get("lastUsedPort"))
  };
});

ipcMain.handle("dialog:select-folder", async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: "Select a folder to share",
    properties: ["openDirectory"]
  });

  if (result.canceled || !result.filePaths[0]) {
    return {
      canceled: true,
      settings: getPublicSettings()
    };
  }

  store.set("lastSelectedFolder", result.filePaths[0]);
  const settings = getPublicSettings();
  send("settings:changed", settings);
  return {
    canceled: false,
    folder: result.filePaths[0],
    settings
  };
});

ipcMain.handle("settings:save", async (_event, settings = {}) => {
  if (Object.hasOwn(settings, "lastSelectedFolder")) {
    store.set("lastSelectedFolder", String(settings.lastSelectedFolder || ""));
  }

  if (Object.hasOwn(settings, "lastUsedPort")) {
    const port = normalizePort(settings.lastUsedPort);
    if (port) {
      store.set("lastUsedPort", port);
      await updateLinks(port);
    }
  }

  if (Object.hasOwn(settings, "autoStart")) {
    store.set("autoStart", Boolean(settings.autoStart));
  }

  if (Object.hasOwn(settings, "minimizeToTray")) {
    store.set("minimizeToTray", Boolean(settings.minimizeToTray));
    updateTrayMenu();
  }

  const publicSettings = getPublicSettings();
  send("settings:changed", publicSettings);
  return {
    ok: true,
    settings: publicSettings
  };
});

ipcMain.handle("server:start", (_event, payload) => startServer(payload));
ipcMain.handle("server:stop", () => stopServer());
ipcMain.handle("server:restart", (_event, payload) => restartServer(payload));

ipcMain.handle("logs:clear", () => {
  logBuffer.splice(0, logBuffer.length);
  send("logs:cleared", []);
  return {
    ok: true
  };
});

ipcMain.handle("network:links", (_event, payload = {}) =>
  updateLinks(payload.port ?? store.get("lastUsedPort"))
);

ipcMain.handle("clipboard:copy", (_event, payload = {}) => {
  clipboard.writeText(String(payload.text || ""));
  return {
    ok: true
  };
});

ipcMain.handle("shell:open-external", async (_event, payload = {}) => {
  const url = String(payload.url || "");
  const parsed = new URL(url);

  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new Error("Only http and https links can be opened.");
  }

  await shell.openExternal(url);
  return {
    ok: true
  };
});

app.on("second-instance", showMainWindow);

app.whenReady().then(async () => {
  Menu.setApplicationMenu(null);
  createWindow();
  createTray();
  await updateLinks(store.get("lastUsedPort"));

  if (store.get("autoStart")) {
    setTimeout(() => startServer(), 800);
  }
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  } else {
    showMainWindow();
  }
});

app.on("before-quit", () => {
  isQuitting = true;
  saveWindowBounds();
  killServerProcessNow();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin" && !store.get("minimizeToTray")) {
    app.quit();
  }
});
