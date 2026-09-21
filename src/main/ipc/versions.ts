import { ipcMain } from 'electron'
import { listForgeVersions } from '../../core/forge'
import { fetchVersionList } from '../../core/version'

export function registerVersionsIpc() {
  ipcMain.handle('versions:list', async () => {
    const m = await fetchVersionList()
    return {
      latestRelease: m.latest.release,
      versions: m.versions.map((v) => ({ id: v.id, type: v.type }))
    }
  })

  ipcMain.handle('forge:versions', (_e, mcVersion: string) => listForgeVersions(mcVersion))
}
