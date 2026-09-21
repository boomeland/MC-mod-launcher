// Source Modrinth. Un modpack est un .mrpack : un zip avec modrinth.index.json (fichiers à télécharger, versions de
// Minecraft et du loader) et des dossiers overrides/ et client-overrides/ copiés tels quels dans le dossier de jeu.
// Format : https://support.modrinth.com/en/articles/8802351-modrinth-modpack-format-mrpack
import AdmZip from 'adm-zip'
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import { downloadAll, downloadFile, type DownloadItem } from '../download'
import { getProject, getProjectVersions, getVersion, primaryFile, searchProjects, type MrVersion } from '../modrinth'
import { insideDir } from '../paths'
import { isModLoader } from '../types'
import { isSupportedMc, PAGE_SIZE, resolveLoaderVersion, safeImage } from './common'
import type { ModpackSource, PackVersion } from '.'

export interface MrpackFile {
  path: string
  hashes: { sha1: string; sha512?: string }
  env?: { client?: 'required' | 'optional' | 'unsupported'; server?: string }
  downloads: string[]
  fileSize: number
}

export interface MrpackIndex {
  name: string
  files: MrpackFile[]
  dependencies: Record<string, string>
}

/** Hôtes de téléchargement autorisés par la spécification .mrpack : un pack ne doit pas pouvoir faire télécharger n'importe où. */
const DOWNLOAD_HOSTS = ['https://cdn.modrinth.com/', 'https://github.com/', 'https://raw.githubusercontent.com/', 'https://gitlab.com/']

/** Clés de loader dans les dépendances d'un .mrpack → nom du loader côté launcher (quilt n'est pas géré). */
const PACK_LOADERS: Record<string, string> = { neoforge: 'neoforge', forge: 'forge', 'fabric-loader': 'fabric', 'quilt-loader': 'quilt' }

/** Minecraft et loader d'un pack, lus dans les dépendances de son index. */
export function packTargets(deps: Record<string, string>): { mcVersion: string; loader?: { name: string; version: string } } {
  const mcVersion = deps.minecraft
  if (!mcVersion) throw new Error('Le modpack ne précise pas sa version de Minecraft')
  const key = Object.keys(PACK_LOADERS).find((k) => deps[k])
  return { mcVersion, loader: key ? { name: PACK_LOADERS[key], version: deps[key] } : undefined }
}

/** Fichiers à télécharger : ceux utiles au client, depuis un hôte autorisé, sous le dossier de jeu. */
export function mrpackDownloads(gameDir: string, files: MrpackFile[]): DownloadItem[] {
  return files
    .filter((f) => f.env?.client !== 'unsupported')
    .map((f) => {
      const url = f.downloads.find((u) => DOWNLOAD_HOSTS.some((h) => u.startsWith(h)))
      if (!url) throw new Error(`Hôte de téléchargement non autorisé pour ${f.path}`)
      return { url, dest: insideDir(gameDir, f.path), sha1: f.hashes.sha1, size: f.fileSize }
    })
}

/** Copie overrides/ puis client-overrides/ (qui l'emporte). Chaque entrée de l'archive passe par insideDir (zip slip). */
export async function extractOverrides(zip: AdmZip, gameDir: string): Promise<void> {
  for (const prefix of ['overrides/', 'client-overrides/']) {
    for (const entry of zip.getEntries()) {
      if (entry.isDirectory || !entry.entryName.startsWith(prefix)) continue
      const dest = insideDir(gameDir, entry.entryName.slice(prefix.length))
      await mkdir(dirname(dest), { recursive: true })
      await writeFile(dest, entry.getData())
    }
  }
}

function toPackVersion(v: MrVersion): PackVersion {
  const loader = v.loaders.find((l) => isModLoader(l)) ?? v.loaders[0] ?? ''
  const mcVersion = v.game_versions[0] ?? ''
  return {
    id: v.id,
    name: v.version_number,
    type: v.version_type,
    mcVersion,
    loader,
    recommendedMemoryMb: 4096, // Modrinth ne publie pas de recommandation de mémoire
    supported: isModLoader(loader) && isSupportedMc(mcVersion)
  }
}

export const modrinth: ModpackSource = {
  async search(query, loader, offset) {
    const facets = [['project_type:modpack'], ...(loader ? [[`categories:${loader}`]] : [])]
    const r = await searchProjects(query, facets, offset, PAGE_SIZE)
    return {
      total: r.total_hits,
      hits: r.hits.map((h) => {
        const hitLoader = h.categories.find((c) => isModLoader(c) || c === 'quilt') ?? ''
        const mcVersion = h.versions.at(-1) ?? ''
        const supported = isModLoader(hitLoader) && isSupportedMc(mcVersion)
        return { source: 'modrinth', id: h.project_id, name: h.title, summary: h.description, icon: safeImage(h.icon_url), mcVersion, loader: hitLoader, supported }
      })
    }
  },

  async getPack(id) {
    const [p, versions] = await Promise.all([getProject(id), getProjectVersions(id)])
    const splash = p.gallery?.find((g) => g.featured)?.url ?? p.gallery?.[0]?.url
    return {
      source: 'modrinth',
      id,
      name: p.title,
      summary: p.description,
      art: { icon: safeImage(p.icon_url), splash: safeImage(splash) },
      versions: versions.map(toPackVersion)
    }
  },

  async prepare(_pack, version, cacheDir) {
    // Le .mrpack est gardé en cache (vérifié par SHA1) : une réinstallation ne le retélécharge pas.
    const file = primaryFile(await getVersion(version.id))
    const archive = insideDir(cacheDir, `${version.id}.mrpack`)
    await downloadFile({ url: file.url, dest: archive, sha1: file.hashes.sha1, size: file.size })
    const zip = new AdmZip(archive)
    const entry = zip.getEntry('modrinth.index.json')
    if (!entry) throw new Error('modrinth.index.json introuvable dans le modpack')
    const index = JSON.parse(zip.readAsText(entry)) as MrpackIndex

    const { mcVersion, loader } = packTargets(index.dependencies)
    return {
      mcVersion,
      loader: loader ? await resolveLoaderVersion(loader.name, mcVersion, loader.version) : { loader: 'vanilla' },
      async install(gameDir, onProgress) {
        await downloadAll(mrpackDownloads(gameDir, index.files), 'Fichiers du modpack', onProgress)
        await extractOverrides(zip, gameDir)
      }
    }
  }
}
