import { BrowserWindow, dialog, ipcMain } from 'electron'
import { getInstance, instanceGameDir, type Instance } from '../../core/instances'
import { checkUpdates, identifyMods, installMod, searchMods, updateMod } from '../../core/modrinth-mods'
import { addModFiles, deleteMod, listMods, setModEnabled } from '../../core/mods'
import { INSTANCES_DIR } from '../config'

/** Instance (id validé par getInstance) et son dossier de jeu ; les mods n'ont de sens qu'avec un loader. */
async function modded(id: string) {
  const instance = await getInstance(INSTANCES_DIR, id)
  if (instance.loader === 'vanilla') throw new Error('Une instance Vanilla ne charge pas de mods')
  return { instance: instance as Extract<Instance, { loaderVersion: string }>, gameDir: instanceGameDir(INSTANCES_DIR, id) }
}

export function registerModsIpc() {
  ipcMain.handle('mods:list', async (_e, id: string) => listMods((await modded(id)).gameDir))
  ipcMain.handle('mods:identify', async (_e, id: string, files: string[]) => identifyMods((await modded(id)).gameDir, files))
  ipcMain.handle('mods:set-enabled', async (_e, id: string, file: string, enabled: boolean) =>
    setModEnabled((await modded(id)).gameDir, file, Boolean(enabled))
  )
  ipcMain.handle('mods:delete', async (_e, id: string, file: string) => deleteMod((await modded(id)).gameDir, file))

  // Sans chemins (bouton « Ajouter »), le main ouvre lui-même le sélecteur de fichiers ; avec (glisser-déposer),
  // addModFiles n'accepte que des .jar et les copie sous un nom validé.
  ipcMain.handle('mods:add', async (e, id: string, sources?: string[]) => {
    const { gameDir } = await modded(id)
    let files = sources
    if (!files) {
      const r = await dialog.showOpenDialog(BrowserWindow.fromWebContents(e.sender)!, {
        title: 'Ajouter des mods',
        filters: [{ name: 'Mods Minecraft', extensions: ['jar'] }],
        properties: ['openFile', 'multiSelections']
      })
      files = r.canceled ? [] : r.filePaths
    }
    return addModFiles(gameDir, files.map(String))
  })

  ipcMain.handle('mods:search', async (_e, id: string, query: string, offset: number) =>
    searchMods((await modded(id)).instance, String(query ?? ''), Math.max(0, Number(offset) || 0))
  )
  ipcMain.handle('mods:install', async (e, id: string, projectId: string) => {
    const { instance, gameDir } = await modded(id)
    return installMod(gameDir, instance, String(projectId), (p) => e.sender.send('game:progress', p))
  })
  ipcMain.handle('mods:check-updates', async (_e, id: string) => {
    const { instance, gameDir } = await modded(id)
    return checkUpdates(gameDir, instance)
  })
  ipcMain.handle('mods:update', async (_e, id: string, file: string, versionId: string) =>
    updateMod((await modded(id)).gameDir, file, String(versionId))
  )
}
