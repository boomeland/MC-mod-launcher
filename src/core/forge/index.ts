import { mkdir, stat, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { downloadFile } from '../download'
import { installVersion } from '../install'
import type { GamePaths } from '../paths'
import type { ProgressFn } from '../types'
import { runInstaller, versionIdFromInstaller } from './installer'
import { MAVEN } from './versions'

export { listForgeVersions } from './versions'
export type { ForgeVersions } from './versions'

const exists = (p: string) => stat(p).then(() => true, () => false)

/**
 * Installe Forge pour un Minecraft donné et renvoie l'id de la version à lancer.
 * `forgeVersion` est la forme complète Maven ("1.20.1-47.3.0").
 * Étapes : vanilla (+ Java Mojang) → installer officiel en headless → marqueur de réussite.
 */
export async function installForge(
  paths: GamePaths,
  mcVersion: string,
  forgeVersion: string,
  onProgress?: ProgressFn,
  onLog?: (line: string) => void
): Promise<string> {
  // Le vanilla d'abord : l'installer en a besoin, et on réutilise son JRE (adapté à cette version de MC).
  const { javaPath } = await installVersion(paths, mcVersion, onProgress)

  const installer = join(paths.root, 'forge-installers', `forge-${forgeVersion}-installer.jar`)
  await downloadFile({ url: `${MAVEN}/${forgeVersion}/forge-${forgeVersion}-installer.jar`, dest: installer })

  const id = versionIdFromInstaller(installer)
  const marker = join(paths.versionDir(id), '.installed-by-launcher')
  if (await exists(marker)) return id

  // L'installer exige un launcher_profiles.json dans le dossier cible (il l'édite pour ajouter un profil).
  const profiles = join(paths.root, 'launcher_profiles.json')
  if (!(await exists(profiles))) {
    await mkdir(paths.root, { recursive: true })
    await writeFile(profiles, JSON.stringify({ profiles: {}, settings: {}, version: 3 }))
  }

  const stage = `Installation de Forge ${forgeVersion}`
  onProgress?.({ stage, done: 0, total: 1 })
  await runInstaller(javaPath, installer, paths.root, onLog)
  if (!(await exists(paths.versionJson(id)))) throw new Error(`Forge installé mais versions/${id} est introuvable`)

  await writeFile(marker, new Date().toISOString())
  onProgress?.({ stage, done: 1, total: 1 })
  return id
}
