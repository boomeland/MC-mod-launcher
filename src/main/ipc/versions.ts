import { ipcMain } from 'electron'
import { LOADERS } from '../../core/loaders'
import { isModLoader } from '../../core/types'
import { fetchVersionList } from '../../core/version'

export function registerVersionsIpc() {
  ipcMain.handle('versions:list', async () => {
    const m = await fetchVersionList()
    return {
      latestRelease: m.latest.release,
      versions: m.versions.map((v) => ({ id: v.id, type: v.type }))
    }
  })

  ipcMain.handle('loader:versions', (_e, loader: unknown, mcVersion: string) => {
    if (!isModLoader(loader)) throw new Error(`Loader inconnu : ${String(loader)}`)
    return LOADERS[loader].listVersions(mcVersion)
  })
}
