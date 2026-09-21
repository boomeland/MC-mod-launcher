import { ipcMain } from 'electron'
import { join } from 'node:path'
import { createInstance, deleteInstance, instanceGameDir } from '../../core/instances'
import { isPackSource, PACK_SOURCES } from '../../core/modpacks'
import { INSTANCES_DIR, paths } from '../config'

function source(id: unknown) {
  if (!isPackSource(id)) throw new Error(`Source de modpacks inconnue : ${String(id)}`)
  return PACK_SOURCES[id]
}

export function registerModpacksIpc() {
  ipcMain.handle('packs:search', (_e, src: unknown, query: string, loader: string, offset: number) =>
    source(src).search(String(query ?? ''), String(loader ?? ''), Math.max(0, Number(offset) || 0))
  )
  ipcMain.handle('packs:get', (_e, src: unknown, id: string) => source(src).getPack(String(id)))

  // Le renderer ne transmet que des ids : versions de Minecraft et du loader sont relues depuis la source, jamais prises de l'UI.
  ipcMain.handle('packs:install', async (e, src: unknown, packId: string, versionId: string, memoryMb: unknown) => {
    const s = source(src)
    const pack = await s.getPack(String(packId))
    const version = pack.versions.find((v) => v.id === versionId)
    if (!version) throw new Error(`Version introuvable pour ${pack.name}`)
    const onProgress = (p: unknown) => e.sender.send('game:progress', p)

    const prepared = await s.prepare(pack, version, join(paths.root, 'modpacks'))
    const instance = await createInstance(INSTANCES_DIR, {
      name: `${pack.name} ${version.name}`,
      mcVersion: prepared.mcVersion,
      memoryMb: Number(memoryMb),
      art: pack.art,
      ...prepared.loader
    })
    try {
      await prepared.install(instanceGameDir(INSTANCES_DIR, instance.id), onProgress)
    } catch (err) {
      // Une instance à moitié remplie aurait l'air jouable et planterait au lancement : on la retire.
      await deleteInstance(INSTANCES_DIR, instance.id)
      throw err
    }
    return instance
  })
}
