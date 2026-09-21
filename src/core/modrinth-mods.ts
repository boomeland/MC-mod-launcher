// Mods venus de Modrinth : recherche compatible avec l'instance, installation avec dépendances, mises à jour.
// Rien n'est mémorisé à part : un mod est reconnu par le SHA1 de son fichier, qu'il vienne du launcher ou d'ailleurs.
import { downloadFile } from './download'
import type { Instance } from './instances'
import {
  getProjects,
  getProjectVersions,
  getVersion,
  latestByHash,
  primaryFile,
  searchProjects,
  versionsByHash,
  type MrVersion
} from './modrinth'
import { deleteMod, hashMods, listMods, modPath } from './mods'
import { PAGE_SIZE, safeImage } from './modpacks/common'
import type { ProgressFn } from './types'

export interface ModHit {
  id: string
  title: string
  description: string
  icon?: string
  downloads: number
}

export interface ModIdentity {
  projectId: string
  title: string
  icon?: string
  versionNumber: string
}

export interface ModUpdate {
  file: string
  versionId: string
  versionNumber: string
}

type ModdedInstance = Extract<Instance, { loaderVersion: string }>

/** Loaders acceptés : NeoForge 1.20.1 (juste après le fork) fait encore tourner les mods Forge. */
const modLoaders = (i: ModdedInstance) => (i.loader === 'neoforge' && i.mcVersion === '1.20.1' ? ['neoforge', 'forge'] : [i.loader])

export async function searchMods(i: ModdedInstance, query: string, offset: number) {
  const facets = [['project_type:mod'], modLoaders(i).map((l) => `categories:${l}`), [`versions:${i.mcVersion}`]]
  const r = await searchProjects(query, facets, offset, PAGE_SIZE)
  return {
    total: r.total_hits,
    hits: r.hits.map((h): ModHit => ({ id: h.project_id, title: h.title, description: h.description, icon: safeImage(h.icon_url), downloads: h.downloads }))
  }
}

/** Reconnaît les mods de l'instance présents sur Modrinth (par SHA1) : nom lisible, icône, version. */
export async function identifyMods(gameDir: string, files: string[]): Promise<Record<string, ModIdentity>> {
  const hashes = await hashMods(gameDir, files)
  const byHash = await versionsByHash(Object.values(hashes))
  const projects = await getProjects([...new Set(Object.values(byHash).map((v) => v.project_id))])
  const byId = new Map(projects.map((p) => [p.id, p]))
  const out: Record<string, ModIdentity> = {}
  for (const [file, hash] of Object.entries(hashes)) {
    const v = byHash[hash]
    const p = v && byId.get(v.project_id)
    if (v && p) out[file] = { projectId: p.id, title: p.title, icon: safeImage(p.icon_url), versionNumber: v.version_number }
  }
  return out
}

/** Version à installer : la plus récente stable compatible, sinon la plus récente compatible. */
async function bestModVersion(i: ModdedInstance, projectId: string): Promise<MrVersion | undefined> {
  const versions = await getProjectVersions(projectId, modLoaders(i), [i.mcVersion])
  return versions.find((v) => v.version_type === 'release') ?? versions[0]
}

/**
 * Installe un mod et ses dépendances obligatoires (récursivement), en sautant les projets déjà présents.
 * Renvoie les fichiers ajoutés.
 */
export async function installMod(gameDir: string, i: ModdedInstance, projectId: string, onProgress?: ProgressFn): Promise<string[]> {
  const present = new Set(Object.values(await identifyMods(gameDir, (await listMods(gameDir)).map((m) => m.file))).map((m) => m.projectId))
  const queue = [projectId]
  const added: string[] = []
  while (queue.length) {
    const id = queue.shift()!
    if (present.has(id)) continue
    present.add(id)
    const version = await bestModVersion(i, id)
    if (!version) throw new Error(`Aucune version compatible avec Minecraft ${i.mcVersion} (${i.loader}) pour ${id === projectId ? 'ce mod' : `la dépendance ${id}`}`)
    const file = primaryFile(version)
    onProgress?.({ stage: `Installation de ${file.filename}`, done: added.length, total: added.length + queue.length + 1 })
    await downloadFile({ url: file.url, dest: modPath(gameDir, file.filename), sha1: file.hashes.sha1, size: file.size })
    added.push(file.filename)
    for (const dep of version.dependencies.filter((d) => d.dependency_type === 'required')) {
      const depId = dep.project_id ?? (dep.version_id ? (await getVersion(dep.version_id)).project_id : undefined)
      if (depId && !present.has(depId)) queue.push(depId)
    }
  }
  return added
}

/** Mods pour lesquels Modrinth propose une version plus récente compatible avec l'instance. */
export async function checkUpdates(gameDir: string, i: ModdedInstance): Promise<ModUpdate[]> {
  const mods = await listMods(gameDir)
  const hashes = await hashMods(gameDir, mods.map((m) => m.file))
  const [latest, current] = await Promise.all([
    latestByHash(Object.values(hashes), modLoaders(i), [i.mcVersion]),
    versionsByHash(Object.values(hashes))
  ])
  return mods.flatMap((m) => {
    const hash = hashes[m.file]
    const next = latest[hash]
    if (!next || primaryFile(next).hashes.sha1 === hash) return []
    // Modrinth renvoie la plus récente, bêtas comprises : on ne fait pas passer un mod stable en bêta sans qu'on le demande.
    if (next.version_type !== 'release' && current[hash]?.version_type === 'release') return []
    return [{ file: m.file, versionId: next.id, versionNumber: next.version_number }]
  })
}

/** Remplace un mod par une autre version, en gardant son état activé/désactivé ; renvoie le nouveau nom de fichier. */
export async function updateMod(gameDir: string, file: string, versionId: string): Promise<string> {
  const f = primaryFile(await getVersion(versionId))
  const disabled = /\.disabled$/i.test(file)
  const target = disabled ? `${f.filename}.disabled` : f.filename
  await downloadFile({ url: f.url, dest: modPath(gameDir, target), sha1: f.hashes.sha1, size: f.size })
  if (target !== file) await deleteMod(gameDir, file)
  return target
}
