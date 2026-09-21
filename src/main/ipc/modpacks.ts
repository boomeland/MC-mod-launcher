import { ipcMain } from 'electron'
import { createInstance, deleteInstance, instanceGameDir } from '../../core/instances'
import { getFtbPack, installFtbFiles, listFtbPacks, resolveFtbLoader } from '../../core/modpacks/ftb'
import { INSTANCES_DIR } from '../config'

export function registerModpacksIpc() {
  ipcMain.handle('ftb:list', () => listFtbPacks())

  // Le renderer ne transmet que des ids : version de MC et loader sont relus depuis l'API, jamais pris de l'UI.
  ipcMain.handle('ftb:install', async (e, packId: unknown, versionId: unknown, memoryMb: unknown) => {
    const pack = await getFtbPack(packId)
    const version = pack.versions.find((v) => v.id === versionId)
    if (!version) throw new Error(`Version introuvable pour ${pack.name}`)

    const instance = await createInstance(INSTANCES_DIR, {
      name: `${pack.name} ${version.name}`,
      mcVersion: version.mcVersion,
      memoryMb: Number(memoryMb),
      art: pack.art,
      ...(await resolveFtbLoader(version))
    })
    try {
      await installFtbFiles(instanceGameDir(INSTANCES_DIR, instance.id), pack.id, version.id, (p) =>
        e.sender.send('game:progress', p)
      )
    } catch (err) {
      // Une instance à moitié remplie aurait l'air jouable et planterait au lancement : on la retire.
      await deleteInstance(INSTANCES_DIR, instance.id)
      throw err
    }
    return instance
  })
}
