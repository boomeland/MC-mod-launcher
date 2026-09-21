// Modpacks FTB (Feed The Beast) via leur API publique : liste des packs et de leurs versions, puis pose des fichiers
// d'une version dans le dossier de jeu d'une instance. L'API donne une URL directe et un SHA1 pour chaque fichier
// (mods hébergés chez CurseForge compris) : pas de clé API, et le téléchargeur commun suffit.
// Pas d'interface « source de modpacks » tant que FTB est la seule : elle naîtra avec Modrinth (boucle anti-suringénierie).
import { resolve, sep } from 'node:path'
import { downloadAll, fetchJson, type DownloadItem } from '../download'
import type { InstanceArt, LoaderChoice } from '../instances'
import { LOADERS } from '../loaders'
import { isModLoader, type ProgressFn } from '../types'

const API = 'https://api.feed-the-beast.com/v1/modpacks/public/modpack'
/** Seul hôte d'images accepté (c'est aussi le seul autorisé par la CSP du renderer, img-src). */
const CDN = 'https://cdn.feed-the-beast.com/'

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

export interface FtbVersion {
  id: number
  name: string
  /** release, beta, alpha ou archived. */
  type: string
  mcVersion: string
  /** Loader tel que FTB le nomme ("forge", "neoforge", "fabric") et sa version courte ("47.4.20"). */
  loader: string
  loaderVersion: string
  recommendedMemoryMb: number
  /** Faux si le launcher ne sait pas encore lancer cette version (voir toFtbVersion). */
  supported: boolean
}

export interface FtbPack {
  id: number
  name: string
  synopsis: string
  /** Icône carrée et image de fond (URL du CDN FTB). */
  art: InstanceArt
  /** De la plus récente à la plus ancienne. */
  versions: FtbVersion[]
}

/**
 * Traduit une version de l'API. Non prises en charge : les loaders inconnus du launcher, et Minecraft ≤ 1.9
 * (assets « legacy » non gérés, et avant 1.6 Forge n'a même pas d'installer : il faudrait patcher le jar).
 */
export function toFtbVersion(v: ApiVersion): FtbVersion {
  const target = (type: string) => v.targets.find((t) => t.type === type)
  const mcVersion = target('game')?.version ?? ''
  const loader = target('modloader')
  const [major, minor] = mcVersion.split('.').map(Number)
  return {
    id: v.id,
    name: v.name,
    type: v.type,
    mcVersion,
    loader: loader?.name ?? '',
    loaderVersion: loader?.version ?? '',
    recommendedMemoryMb: v.specs?.recommended ?? 4096,
    supported: isModLoader(loader?.name) && (major > 1 || minor >= 10)
  }
}

/** Un pack et ses versions publiques. L'id peut venir de l'IPC : il finit dans une URL, on le valide. */
export async function getFtbPack(id: unknown): Promise<FtbPack> {
  if (!Number.isInteger(id) || (id as number) <= 0) throw new Error(`Identifiant de modpack invalide : ${String(id)}`)
  const p = await fetchJson<{
    status: string
    id: number
    name: string
    synopsis: string
    art?: { type: string; url: string }[]
    versions?: ApiVersion[]
  }>(`${API}/${id}`)
  if (p.status !== 'success' || !p.versions) throw new Error(`Modpack FTB introuvable : ${id}`)
  const versions = p.versions.filter((v) => !v.private).map(toFtbVersion).reverse() // l'API va de la plus ancienne à la plus récente
  const art = (type: string) => p.art?.find((a) => a.type === type && a.url.startsWith(CDN))?.url
  return { id: p.id, name: p.name, synopsis: p.synopsis, art: { icon: art('square'), splash: art('splash') }, versions }
}

/** Tous les packs FTB publics (une requête par pack, en parallèle : ~100 packs). */
export async function listFtbPacks(): Promise<FtbPack[]> {
  const { packs } = await fetchJson<{ packs: number[] }>(`${API}/all`)
  // Un pack en erreur côté API (retiré, en maintenance) ne doit pas masquer tout le catalogue : on l'omet.
  const all = await Promise.all(packs.map((id) => getFtbPack(id).catch(() => null)))
  return all.filter((p): p is FtbPack => p !== null && p.versions.length > 0)
}

/** Traduit le loader FTB ("forge" + "47.4.20") en version Maven du launcher ("1.20.1-47.4.20"). */
export async function resolveFtbLoader(v: FtbVersion): Promise<LoaderChoice> {
  const loader = v.loader
  if (!v.supported || !isModLoader(loader)) throw new Error(`Version non prise en charge : MC ${v.mcVersion}, ${loader}`)
  const short = v.loaderVersion
  const prefixed = `${v.mcVersion}-${short}`
  // Forge et NeoForge 1.20.1 préfixent par le Minecraft (les très vieux Forge ajoutent aussi un suffixe) ; NeoForge récent et Fabric non.
  const full = (await LOADERS[loader].listVersions(v.mcVersion)).versions.find(
    (x) => x === short || x === prefixed || x.startsWith(`${prefixed}-`)
  )
  if (!full) throw new Error(`${loader} ${short} introuvable pour Minecraft ${v.mcVersion}`)
  return { loader, loaderVersion: full }
}

/**
 * Fichiers à télécharger dans le dossier de jeu. Les chemins viennent d'un serveur distant : tout chemin qui
 * sortirait du dossier de l'instance ("../", chemin absolu) fait échouer l'installation entière.
 */
export function ftbDownloads(gameDir: string, files: ApiFile[]): DownloadItem[] {
  const root = resolve(gameDir)
  return files
    .filter((f) => !f.serveronly)
    .map((f) => {
      const dest = resolve(root, f.path, f.name)
      if (!dest.startsWith(root + sep)) throw new Error(`Chemin de fichier refusé dans le modpack : ${f.path}/${f.name}`)
      return { url: f.url, dest, sha1: f.sha1, size: f.size }
    })
}

export async function installFtbFiles(gameDir: string, packId: number, versionId: number, onProgress?: ProgressFn) {
  const { files } = await fetchJson<{ files: ApiFile[] }>(`${API}/${packId}/${versionId}`)
  await downloadAll(ftbDownloads(gameDir, files), 'Fichiers du modpack', onProgress)
}
