import AdmZip from 'adm-zip'
import { copyFile, mkdir, readFile, stat } from 'node:fs/promises'
import { join } from 'node:path'
import { downloadAll, downloadFile, type DownloadItem } from './download'
import { ensureJava } from './java'
import { libraryFile, resolveLibraries } from './libraries'
import type { GamePaths } from './paths'
import { resolveVersion, type ResolvedVersion } from './version'
import type { ProgressFn } from './types'

const ASSET_HOST = 'https://resources.download.minecraft.net'

interface AssetIndex {
  objects: Record<string, { hash: string; size: number }>
}

export interface Installed {
  resolved: ResolvedVersion
  javaPath: string
}

/** Extrait les .dll/.so/.dylib d'une archive de natives (ancien format, avant LWJGL 3.3). */
function extractNatives(jar: string, destDir: string, exclude: string[]) {
  const zip = new AdmZip(jar)
  for (const e of zip.getEntries()) {
    if (e.isDirectory || exclude.some((x) => e.entryName.startsWith(x))) continue
    if (/\.(dll|so|dylib|jnilib)$/i.test(e.entryName)) zip.extractEntryTo(e, destDir, false, true)
  }
}

/**
 * Installe tout ce qu'il faut pour lancer une version : client.jar, librairies, natives, assets, Java.
 * Fonctionne aussi pour une version modée (Forge/Fabric) dont le JSON existe déjà dans versions/<id>/.
 */
export async function installVersion(paths: GamePaths, id: string, onProgress?: ProgressFn): Promise<Installed> {
  const resolved = await resolveVersion(paths, id)
  const { json, jarVersionId } = resolved

  // client.jar (celui du parent vanilla pour une version modée)
  const client = json.downloads?.client
  if (!client) throw new Error(`Pas de client.jar pour ${id}`)
  await downloadFile({ url: client.url, dest: paths.versionJar(jarVersionId), sha1: client.sha1, size: client.size })

  // Une version héritée (Forge…) se lance avec versions/<id>/<id>.jar : Forge ignore ce jar sur le classpath
  // via -DignoreList=...,${version_name}.jar, sinon le jar vanilla entre en conflit avec le client patché.
  if (id !== jarVersionId) {
    const same = await stat(paths.versionJar(id)).then((s) => s.size === client.size, () => false)
    if (!same) await copyFile(paths.versionJar(jarVersionId), paths.versionJar(id))
  }

  // librairies
  const libs = resolveLibraries(json.libraries)
  await downloadAll(
    libs
      .filter((l) => l.artifact.url) // url vide = fichier généré par l'installer Forge, pas téléchargeable
      .map((l) => ({ url: l.artifact.url, dest: libraryFile(paths.libraries, l), sha1: l.artifact.sha1, size: l.artifact.size })),
    'Librairies',
    onProgress
  )

  // natives (ancien format uniquement ; depuis 1.19 elles sont sur le classpath)
  const nativesDir = paths.nativesDir(id)
  await mkdir(nativesDir, { recursive: true })
  for (const l of libs.filter((x) => x.extract)) {
    extractNatives(libraryFile(paths.libraries, l), nativesDir, l.extract!.exclude)
  }

  // assets
  if (json.assetIndex) {
    const indexPath = join(paths.assets, 'indexes', `${json.assetIndex.id}.json`)
    await downloadFile({ url: json.assetIndex.url, dest: indexPath, sha1: json.assetIndex.sha1 })
    const index = JSON.parse(await readFile(indexPath, 'utf8')) as AssetIndex
    const items: DownloadItem[] = Object.values(index.objects).map(({ hash, size }) => ({
      url: `${ASSET_HOST}/${hash.slice(0, 2)}/${hash}`,
      dest: join(paths.assets, 'objects', hash.slice(0, 2), hash),
      size
    }))
    await downloadAll(items, 'Assets', onProgress, 32)
  }

  // config de logs log4j
  const log = json.logging?.client?.file
  if (log) await downloadFile({ url: log.url, dest: join(paths.assets, 'log_configs', log.id), sha1: log.sha1 })

  // Java (Mojang ne renseigne javaVersion qu'à partir de 1.17 ; avant c'est Java 8)
  const javaPath = await ensureJava(paths, json.javaVersion?.component ?? 'jre-legacy', onProgress)

  return { resolved, javaPath }
}
