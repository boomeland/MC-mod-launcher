import { contextBridge, ipcRenderer } from 'electron'
import type { LauncherApi } from '../shared/api'

const api: LauncherApi = {
  listVersions: () => ipcRenderer.invoke('versions:list'),
  play: (versionId, username) => ipcRenderer.invoke('game:play', versionId, username),
  onProgress: (cb) => void ipcRenderer.on('game:progress', (_e, p) => cb(p)),
  onLog: (cb) => void ipcRenderer.on('game:log', (_e, line) => cb(line)),
  onExit: (cb) => void ipcRenderer.on('game:exit', (_e, code) => cb(code))
}

contextBridge.exposeInMainWorld('launcher', api)
