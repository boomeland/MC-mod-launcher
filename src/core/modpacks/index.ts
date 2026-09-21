// Une source de modpacks sait chercher des packs, décrire leurs versions et préparer l'installation de l'une d'elles.
// L'IPC ne connaît que cette interface : ajouter une source (CurseForge…) = un fichier + une entrée dans PACK_SOURCES.
import type { InstanceArt, LoaderChoice } from '../instances'
import type { ProgressFn } from '../types'
import { ftb } from './ftb'
import { modrinth } from './modrinth'

export type PackSourceId = 'ftb' | 'modrinth'

/** Carte d'un pack dans une liste de résultats. */
export interface PackSummary {
  source: PackSourceId
  id: string
  name: string
  summary: string
  icon?: string
  /** Minecraft et loader de la version la plus récente (pour l'affichage et les filtres). */
  mcVersion: string
  loader: string
  /** Faux si aucune version n'est jouable par le launcher (loader inconnu, Minecraft trop ancien). */
  supported: boolean
}

export interface PackVersion {
  id: string
  name: string
  /** release, beta, alpha (ou archived chez FTB). */
  type: string
  mcVersion: string
  loader: string
  /** Connue d'avance chez FTB ; chez Modrinth, seulement en ouvrant le .mrpack (voir prepare). */
  loaderVersion?: string
  recommendedMemoryMb: number
  supported: boolean
}

export interface PackDetail {
  source: PackSourceId
  id: string
  name: string
  summary: string
  art: InstanceArt
  /** De la plus récente à la plus ancienne. */
  versions: PackVersion[]
}

/** Résultat de prepare : de quoi créer l'instance, puis y poser les fichiers du pack. */
export interface PreparedPack {
  mcVersion: string
  loader: LoaderChoice
  install(gameDir: string, onProgress?: ProgressFn): Promise<void>
}

export interface ModpackSource {
  search(query: string, loader: string, offset: number): Promise<{ hits: PackSummary[]; total: number }>
  /** L'id vient de l'IPC : chaque source le valide avant de s'en servir dans une URL. */
  getPack(id: string): Promise<PackDetail>
  /** `cacheDir` : dossier partagé où une source peut garder ses archives (ex. .mrpack). */
  prepare(pack: PackDetail, version: PackVersion, cacheDir: string): Promise<PreparedPack>
}

export const PACK_SOURCES: Record<PackSourceId, ModpackSource> = { ftb, modrinth }

export const isPackSource = (x: unknown): x is PackSourceId => x === 'ftb' || x === 'modrinth'
