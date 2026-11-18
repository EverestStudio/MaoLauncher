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
  getNews: () => ipcRenderer.invoke('news:get'),
  getLauncherVersion: () => ipcRenderer.invoke('launcher:version'),
  installLauncherUpdate: () => ipcRenderer.invoke('launcher:update-install'),
  serverStatus: () => ipcRenderer.invoke('server:status'),
  getTwitchStreams: () => ipcRenderer.invoke('twitch:status'),
  windowAction: (action) => ipcRenderer.invoke('window:action', action),
  setSidebarExpanded: (expanded) => ipcRenderer.invoke('window:sidebar-expanded', Boolean(expanded)),
  onProgress: (callback) => ipcRenderer.on('install:progress', (_event, data) => callback(data)),
  onLauncherUpdateProgress: (callback) => ipcRenderer.on('launcher-update:progress', (_event, data) => callback(data)),
  onGameStarted: (callback) => ipcRenderer.on('game:started', (_event, data) => callback(data)),
  onGameClosed: (callback) => ipcRenderer.on('game:closed', (_event, data) => callback(data)),
  onGameLog: (callback) => ipcRenderer.on('game:log', (_event, data) => callback(data))
}));
