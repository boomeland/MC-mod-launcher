import { contextBridge, ipcRenderer } from 'electron'
import type { LauncherApi } from '../shared/api'

const api: LauncherApi = {
  listVersions: () => ipcRenderer.invoke('versions:list'),
  listForgeVersions: (mcVersion) => ipcRenderer.invoke('forge:versions', mcVersion),
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
