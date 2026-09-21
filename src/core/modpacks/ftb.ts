// Source FTB (Feed The Beast) via leur API publique. L'API donne, pour chaque fichier d'une version, une URL directe
// et un SHA1 (mods hébergés chez CurseForge compris) : pas de clé API, et le téléchargeur commun suffit.
import { downloadAll, fetchJson, type DownloadItem } from '../download'
import { insideDir } from '../paths'
import { isModLoader } from '../types'
import { isSupportedMc, PAGE_SIZE, resolveLoaderVersion, safeImage } from './common'
import type { ModpackSource, PackDetail, PackSummary, PackVersion } from '.'

const API = 'https://api.feed-the-beast.com/v1/modpacks/public/modpack'

interface ApiVersion {
  id: number
  name: string
  type: string
  private: boolean
  specs?: { minimum: number; recommended: number }
  targets: { name: string; version: string; type: string }[]
}

export interface ApiFile {
  path: string
  name: string
  url: string
  sha1: string
  size: number
  serveronly: boolean
}

/** Traduit une version de l'API ; `loaderVersion` est la forme courte de FTB ("47.4.20"). */
export function toFtbVersion(v: ApiVersion): PackVersion {
  const target = (type: string) => v.targets.find((t) => t.type === type)
  const mcVersion = target('game')?.version ?? ''
  const loader = target('modloader')
  return {
    id: String(v.id),
    name: v.name,
    type: v.type,
    mcVersion,
    loader: loader?.name ?? '',
    loaderVersion: loader?.version ?? '',
    recommendedMemoryMb: v.specs?.recommended ?? 4096,
    supported: isModLoader(loader?.name) && isSupportedMc(mcVersion)
  }
}

async function getPack(id: string): Promise<PackDetail> {
  if (!/^[1-9]\d{0,6}$/.test(id)) throw new Error(`Identifiant de modpack FTB invalide : ${id}`)
  const p = await fetchJson<{
    status: string
    name: string
    synopsis: string
    art?: { type: string; url: string }[]
    versions?: ApiVersion[]
  }>(`${API}/${id}`)
  if (p.status !== 'success' || !p.versions) throw new Error(`Modpack FTB introuvable : ${id}`)
  const versions = p.versions.filter((v) => !v.private).map(toFtbVersion).reverse() // l'API va de la plus ancienne à la plus récente
  const art = (type: string) => safeImage(p.art?.find((a) => a.type === type)?.url)
  return { source: 'ftb', id, name: p.name, summary: p.synopsis, art: { icon: art('square'), splash: art('splash') }, versions }
}

/** Version proposée par défaut : la plus récente jouable, en évitant les archivées si possible. */
const bestVersion = (versions: PackVersion[]) => {
  const playable = versions.filter((v) => v.supported)
  return playable.find((v) => v.type !== 'archived') ?? playable[0]
}

// L'API FTB n'a pas de recherche : on charge une fois le catalogue (~100 packs, une requête par pack)
// et on filtre en mémoire. Gardé pour la session : le catalogue change rarement.
let catalog: Promise<PackDetail[]> | null = null
function loadCatalog(): Promise<PackDetail[]> {
  catalog ??= fetchJson<{ packs: number[] }>(`${API}/all`)
    .then(({ packs }) =>
      // Un pack en erreur côté API (retiré, en maintenance) ne doit pas masquer tout le catalogue : on l'omet.
      Promise.all(packs.map((id) => getPack(String(id)).catch(() => null)))
    )
    .then((all) => all.filter((p): p is PackDetail => p !== null && p.versions.length > 0))
  catalog.catch(() => (catalog = null)) // un échec réseau ne doit pas rester en cache
  return catalog
}

function summarize(p: PackDetail): PackSummary {
  const v = bestVersion(p.versions) ?? p.versions[0]
  return { source: 'ftb', id: p.id, name: p.name, summary: p.summary, icon: p.art.icon, mcVersion: v.mcVersion, loader: v.loader, supported: v.supported }
}

/**
 * Fichiers à télécharger dans le dossier de jeu. Les chemins viennent d'un serveur distant : tout chemin qui
 * sortirait du dossier de l'instance fait échouer l'installation entière.
 */
export function ftbDownloads(gameDir: string, files: ApiFile[]): DownloadItem[] {
  return files
    .filter((f) => !f.serveronly)
    .map((f) => ({ url: f.url, dest: insideDir(gameDir, f.path, f.name), sha1: f.sha1, size: f.size }))
}

export const ftb: ModpackSource = {
  async search(query, loader, offset) {
    const q = query.trim().toLowerCase()
    const hits = (await loadCatalog()).map(summarize).filter((s) => s.name.toLowerCase().includes(q) && (!loader || s.loader === loader))
    return { hits: hits.slice(offset, offset + PAGE_SIZE), total: hits.length }
  },

  getPack,

  async prepare(pack, version) {
    if (!version.supported || !version.loaderVersion) throw new Error(`Version non prise en charge : MC ${version.mcVersion}, ${version.loader}`)
    return {
      mcVersion: version.mcVersion,
      loader: await resolveLoaderVersion(version.loader, version.mcVersion, version.loaderVersion),
      async install(gameDir, onProgress) {
        const { files } = await fetchJson<{ files: ApiFile[] }>(`${API}/${pack.id}/${version.id}`)
        await downloadAll(ftbDownloads(gameDir, files), 'Fichiers du modpack', onProgress)
      }
    }
  }
}
