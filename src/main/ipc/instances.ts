import { BrowserWindow, dialog, ipcMain, shell } from 'electron'
import { mkdir } from 'node:fs/promises'
import {
  createInstance,
  deleteInstance,
  getInstance,
  instanceGameDir,
  listInstances,
  updateInstance,
  type NewInstance
} from '../../core/instances'
import { INSTANCES_DIR } from '../config'

export function registerInstancesIpc() {
  ipcMain.handle('instances:list', () => listInstances(INSTANCES_DIR))
  // Les visuels ne sont fixés que par le main (depuis l'API FTB), jamais par le renderer.
  ipcMain.handle('instances:create', (_e, input: NewInstance) => createInstance(INSTANCES_DIR, { ...input, art: undefined }))
  ipcMain.handle('instances:update', (_e, id: string, patch: { name?: string; memoryMb?: number }) =>
    updateInstance(INSTANCES_DIR, id, patch)
  )
  // La confirmation vit ici et pas dans le renderer, pour deux raisons :
  // - un confirm() natif du renderer coupe ensuite le clavier dans les champs texte (bug Electron sous Windows, reproduit) ;
  // - le main exige lui-même l'accord de l'utilisateur avant d'effacer des mondes, quoi que demande le renderer.
  ipcMain.handle('instances:delete', async (e, id: string) => {
    const instance = await getInstance(INSTANCES_DIR, id) // valide l'id
    const { response } = await dialog.showMessageBox(BrowserWindow.fromWebContents(e.sender)!, {
      type: 'warning',
      buttons: ['Annuler', 'Supprimer'],
      defaultId: 0,
      cancelId: 0,
      noLink: true,
      message: `Supprimer « ${instance.name} » ?`,
      detail: 'Ses mondes, mods et réglages seront supprimés définitivement.'
    })
    if (response !== 1) return false
    await deleteInstance(INSTANCES_DIR, id)
    return true
  })

  ipcMain.handle('instances:open-folder', async (_e, id: string) => {
    const dir = instanceGameDir(INSTANCES_DIR, id) // valide l'id
    await mkdir(dir, { recursive: true })
    const error = await shell.openPath(dir)
    if (error) throw new Error(error)
  })
}
