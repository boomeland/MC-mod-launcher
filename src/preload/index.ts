import { contextBridge, ipcRenderer, webUtils } from 'electron'
import type { LauncherApi } from '../shared/api'

const api: LauncherApi = {
  listVersions: () => ipcRenderer.invoke('versions:list'),
  listLoaderVersions: (loader, mcVersion) => ipcRenderer.invoke('loader:versions', loader, mcVersion),
  listInstances: () => ipcRenderer.invoke('instances:list'),
  createInstance: (input) => ipcRenderer.invoke('instances:create', input),
  updateInstance: (id, patch) => ipcRenderer.invoke('instances:update', id, patch),
  deleteInstance: (id) => ipcRenderer.invoke('instances:delete', id),
  openInstanceFolder: (id) => ipcRenderer.invoke('instances:open-folder', id),
  searchPacks: (source, query, loader, offset) => ipcRenderer.invoke('packs:search', source, query, loader, offset),
  getPack: (source, id) => ipcRenderer.invoke('packs:get', source, id),
  installPack: (source, packId, versionId, memoryMb) => ipcRenderer.invoke('packs:install', source, packId, versionId, memoryMb),
  listMods: (id) => ipcRenderer.invoke('mods:list', id),
  identifyMods: (id, files) => ipcRenderer.invoke('mods:identify', id, files),
  setModEnabled: (id, file, enabled) => ipcRenderer.invoke('mods:set-enabled', id, file, enabled),
  deleteMod: (id, file) => ipcRenderer.invoke('mods:delete', id, file),
  addMods: (id, files) => ipcRenderer.invoke('mods:add', id, files),
  pathForFile: (file) => webUtils.getPathForFile(file),
  searchMods: (id, query, offset) => ipcRenderer.invoke('mods:search', id, query, offset),
  installMod: (id, projectId) => ipcRenderer.invoke('mods:install', id, projectId),
  checkModUpdates: (id) => ipcRenderer.invoke('mods:check-updates', id),
  updateMod: (id, file, versionId) => ipcRenderer.invoke('mods:update', id, file, versionId),
  onUpdate: (cb) => void ipcRenderer.on('update:state', (_e, u) => cb(u)),
  installUpdate: () => ipcRenderer.invoke('update:install'),
  openReleasePage: () => ipcRenderer.invoke('update:open-page'),
  play: (opts) => ipcRenderer.invoke('game:play', opts),
  stop: () => ipcRenderer.invoke('game:stop'),
  onProgress: (cb) => void ipcRenderer.on('game:progress', (_e, p) => cb(p)),
  onLog: (cb) => void ipcRenderer.on('game:log', (_e, line) => cb(line)),
  onExit: (cb) => void ipcRenderer.on('game:exit', (_e, code) => cb(code)),

  getAccount: () => ipcRenderer.invoke('auth:account'),
  offlineAllowed: () => ipcRenderer.invoke('auth:offline-allowed'),
  login: () => ipcRenderer.invoke('auth:login'),
  cancelLogin: () => ipcRenderer.send('auth:cancel'),
  logout: () => ipcRenderer.invoke('auth:logout'),
  onLoginCode: (cb) => void ipcRenderer.on('auth:code', (_e, c) => cb(c))
}

contextBridge.exposeInMainWorld('launcher', api)
