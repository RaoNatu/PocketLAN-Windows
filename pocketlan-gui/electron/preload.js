import { contextBridge, ipcRenderer } from "electron";

const channels = {
  initialState: "app:get-initial-state",
  selectFolder: "dialog:select-folder",
  saveSettings: "settings:save",
  startServer: "server:start",
  stopServer: "server:stop",
  restartServer: "server:restart",
  clearLogs: "logs:clear",
  refreshLinks: "network:links",
  copyText: "clipboard:copy",
  openExternal: "shell:open-external"
};

function invoke(channel, payload) {
  return ipcRenderer.invoke(channel, payload);
}

function subscribe(channel, callback) {
  const listener = (_event, payload) => callback(payload);
  ipcRenderer.on(channel, listener);
  return () => ipcRenderer.removeListener(channel, listener);
}

contextBridge.exposeInMainWorld("pocketlan", {
  getInitialState: () => invoke(channels.initialState),
  selectFolder: () => invoke(channels.selectFolder),
  saveSettings: (settings) => invoke(channels.saveSettings, settings),
  startServer: (payload) => invoke(channels.startServer, payload),
  stopServer: () => invoke(channels.stopServer),
  restartServer: (payload) => invoke(channels.restartServer, payload),
  clearLogs: () => invoke(channels.clearLogs),
  refreshLinks: (port) => invoke(channels.refreshLinks, { port }),
  copyText: (text) => invoke(channels.copyText, { text }),
  openExternal: (url) => invoke(channels.openExternal, { url }),
  onServerState: (callback) => subscribe("server:state", callback),
  onLog: (callback) => subscribe("server:log", callback),
  onLogsCleared: (callback) => subscribe("logs:cleared", callback),
  onLinksUpdated: (callback) => subscribe("links:updated", callback),
  onSettingsChanged: (callback) => subscribe("settings:changed", callback)
});
