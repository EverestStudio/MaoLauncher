const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('launcher', Object.freeze({
  readSettings: () => ipcRenderer.invoke('settings:read'),
  saveSettings: (settings) => ipcRenderer.invoke('settings:save', settings),
  addProfile: (name) => ipcRenderer.invoke('profiles:add', name),
  selectProfile: (name) => ipcRenderer.invoke('profiles:select', name),
  deleteProfile: (name) => ipcRenderer.invoke('profiles:delete', name),
  gameState: () => ipcRenderer.invoke('game:state'),
  installGame: () => ipcRenderer.invoke('game:install'),
  openGameFolder: () => ipcRenderer.invoke('game:open-folder'),
  checkUpdates: () => ipcRenderer.invoke('update:check'),
  checkLauncherUpdate: () => ipcRenderer.invoke('update:launcher-check'),
  installLauncherUpdate: () => ipcRenderer.invoke('update:launcher-install'),
  serverStatus: () => ipcRenderer.invoke('server:status'),
  windowAction: (action) => ipcRenderer.invoke('window:action', action),
  onProgress: (callback) => ipcRenderer.on('install:progress', (_event, data) => callback(data)),
  onUpdateProgress: (callback) => ipcRenderer.on('update:progress', (_event, data) => callback(data)),
  onGameStarted: (callback) => ipcRenderer.on('game:started', (_event, data) => callback(data)),
  onGameClosed: (callback) => ipcRenderer.on('game:closed', (_event, data) => callback(data)),
  onGameLog: (callback) => ipcRenderer.on('game:log', (_event, data) => callback(data))
}));
