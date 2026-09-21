// Client minimal de l'API Modrinth v2 (publique, sans clé, 300 requêtes/min), partagé par les modpacks et les mods.
import { fetchJson, postJson } from './download'

const API = 'https://api.modrinth.com/v2'

export interface MrFile {
  url: string
  filename: string
  primary: boolean
  size: number
  hashes: { sha1: string; sha512: string }
}

export interface MrVersion {
  id: string
  project_id: string
  name: string
  version_number: string
  version_type: 'release' | 'beta' | 'alpha'
  game_versions: string[]
  loaders: string[]
  files: MrFile[]
  dependencies: { project_id?: string | null; version_id?: string | null; dependency_type: string }[]
}

export interface MrProject {
  id: string
  title: string
  description: string
  icon_url?: string | null
  gallery?: { url: string; featured: boolean }[]
}

export interface MrHit {
  project_id: string
  title: string
  description: string
  icon_url?: string | null
  categories: string[]
  /** Versions de Minecraft couvertes, de la plus ancienne à la plus récente. */
  versions: string[]
  downloads: number
}

/** Les ids et slugs finissent dans des URL : on refuse tout le reste (ils viennent souvent de l'IPC). */
export function assertMrId(id: string): string {
  if (!/^[A-Za-z0-9_.-]{1,64}$/.test(id)) throw new Error(`Identifiant Modrinth invalide : ${id}`)
  return id
}

const q = (v: unknown) => encodeURIComponent(JSON.stringify(v))

export const primaryFile = (v: MrVersion): MrFile => v.files.find((f) => f.primary) ?? v.files[0]

export function searchProjects(query: string, facets: string[][], offset: number, limit: number) {
  const index = query.trim() ? 'relevance' : 'downloads'
  return fetchJson<{ hits: MrHit[]; total_hits: number }>(
    `${API}/search?query=${encodeURIComponent(query.trim())}&facets=${q(facets)}&index=${index}&offset=${offset}&limit=${limit}`
  )
}

export const getProject = (id: string) => fetchJson<MrProject>(`${API}/project/${assertMrId(id)}`)
export const getVersion = (id: string) => fetchJson<MrVersion>(`${API}/version/${assertMrId(id)}`)

/** Versions d'un projet, de la plus récente à la plus ancienne, éventuellement filtrées par loader et Minecraft. */
export function getProjectVersions(id: string, loaders?: string[], gameVersions?: string[]) {
  const params = [loaders && `loaders=${q(loaders)}`, gameVersions && `game_versions=${q(gameVersions)}`].filter(Boolean).join('&')
  return fetchJson<MrVersion[]>(`${API}/project/${assertMrId(id)}/version${params ? `?${params}` : ''}`)
}

export const getProjects = (ids: string[]) =>
  ids.length ? fetchJson<MrProject[]>(`${API}/projects?ids=${q(ids.map(assertMrId))}`) : Promise.resolve([])

/** Versions Modrinth correspondant à des fichiers locaux (par SHA1) ; les fichiers inconnus sont absents du résultat. */
export const versionsByHash = (hashes: string[]) =>
  hashes.length ? postJson<Record<string, MrVersion>>(`${API}/version_files`, { hashes, algorithm: 'sha1' }) : Promise.resolve({} as Record<string, MrVersion>)

/** Dernière version compatible (loader, Minecraft) de chaque fichier local, par SHA1. */
export const latestByHash = (hashes: string[], loaders: string[], gameVersions: string[]) =>
  hashes.length
    ? postJson<Record<string, MrVersion>>(`${API}/version_files/update`, { hashes, algorithm: 'sha1', loaders, game_versions: gameVersions })
    : Promise.resolve({} as Record<string, MrVersion>)
