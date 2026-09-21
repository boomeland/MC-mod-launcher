import { contextBridge, ipcRenderer } from 'electron'
import type { LauncherApi } from '../shared/api'

const api: LauncherApi = {
  listVersions: () => ipcRenderer.invoke('versions:list'),
  listLoaderVersions: (loader, mcVersion) => ipcRenderer.invoke('loader:versions', loader, mcVersion),
  listInstances: () => ipcRenderer.invoke('instances:list'),
  createInstance: (input) => ipcRenderer.invoke('instances:create', input),
  updateInstance: (id, patch) => ipcRenderer.invoke('instances:update', id, patch),
  deleteInstance: (id) => ipcRenderer.invoke('instances:delete', id),
  openInstanceFolder: (id) => ipcRenderer.invoke('instances:open-folder', id),
  listFtbPacks: () => ipcRenderer.invoke('ftb:list'),
  installFtbPack: (packId, versionId, memoryMb) => ipcRenderer.invoke('ftb:install', packId, versionId, memoryMb),
  play: (opts) => ipcRenderer.invoke('game:play', opts),
  onProgress: (cb) => void ipcRenderer.on('game:progress', (_e, p) => cb(p)),
  onLog: (cb) => void ipcRenderer.on('game:log', (_e, line) => cb(line)),
  onExit: (cb) => void ipcRenderer.on('game:exit', (_e, code) => cb(code)),

  getAccount: () => ipcRenderer.invoke('auth:account'),
  login: () => ipcRenderer.invoke('auth:login'),
  cancelLogin: () => ipcRenderer.send('auth:cancel'),
  logout: () => ipcRenderer.invoke('auth:logout'),
  onLoginCode: (cb) => void ipcRenderer.on('auth:code', (_e, c) => cb(c))
}

contextBridge.exposeInMainWorld('launcher', api)
