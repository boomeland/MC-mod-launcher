// Instances : un profil = une version de MC + un loader + son propre dossier de jeu (mods, mondes, options).
// Les fichiers communs (versions, librairies, assets, Java) restent partagés dans GamePaths.
import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import { join, resolve, sep } from 'node:path'
import { isModLoader, type ModLoader } from './types'

/** Union discriminée : un loader de mods a toujours sa version, le vanilla n'en a pas. */
export type LoaderChoice =
  | { loader: 'vanilla' }
  | {
      loader: ModLoader
      /** Forme Maven du loader : Forge "1.20.1-47.3.0", NeoForge "21.1.251". */
      loaderVersion: string
    }

/** Visuels d'une instance issue d'un modpack (URL du CDN FTB) ; les autres instances ont une tuile générée. */
export interface InstanceArt {
  icon?: string
  splash?: string
}

export type Instance = LoaderChoice & {
  /** Slug utilisé comme nom de dossier. */
  id: string
  name: string
  mcVersion: string
  memoryMb: number
  createdAt: string
  art?: InstanceArt
}

export type NewInstance = LoaderChoice & {
  name: string
  mcVersion: string
  memoryMb?: number
  art?: InstanceArt
}

export const MIN_MEMORY_MB = 512
export const MAX_MEMORY_MB = 32768
export const DEFAULT_MEMORY_MB = 2048

const ID_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/

export const clampMemory = (mb: number | undefined): number =>
  Number.isFinite(mb) ? Math.min(MAX_MEMORY_MB, Math.max(MIN_MEMORY_MB, Math.round(mb!))) : DEFAULT_MEMORY_MB

function slugify(name: string): string {
  const slug = name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // accents
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
    .replace(/-+$/g, '')
  return slug || 'instance'
}

/** Dossier d'une instance. Refuse tout id qui ne soit pas un slug (protège contre "../" avant un rm récursif). */
function instanceDir(baseDir: string, id: string): string {
  if (!ID_RE.test(id)) throw new Error(`Identifiant d'instance invalide : ${id}`)
  const base = resolve(baseDir)
  const dir = resolve(base, id)
  if (!dir.startsWith(base + sep)) throw new Error(`Identifiant d'instance invalide : ${id}`)
  return dir
}

/** Dossier de jeu de l'instance (saves, mods, config, options.txt…). */
export const instanceGameDir = (baseDir: string, id: string) => join(instanceDir(baseDir, id), 'minecraft')

const metaFile = (baseDir: string, id: string) => join(instanceDir(baseDir, id), 'instance.json')

export async function getInstance(baseDir: string, id: string): Promise<Instance> {
  try {
    return JSON.parse(await readFile(metaFile(baseDir, id), 'utf8')) as Instance
  } catch {
    throw new Error(`Instance introuvable : ${id}`)
  }
}

export async function listInstances(baseDir: string): Promise<Instance[]> {
  const entries = await readdir(baseDir, { withFileTypes: true }).catch(() => [])
  const found = await Promise.all(
    entries.filter((e) => e.isDirectory() && ID_RE.test(e.name)).map((e) => getInstance(baseDir, e.name).catch(() => null))
  )
  return found.filter((i): i is Instance => i !== null).sort((a, b) => a.createdAt.localeCompare(b.createdAt))
}

export async function createInstance(baseDir: string, input: NewInstance): Promise<Instance> {
  const name = input.name.trim().slice(0, 60)
  if (!name) throw new Error("Le nom de l'instance est vide")
  if (!input.mcVersion) throw new Error('Version de Minecraft manquante')
  // L'entrée vient de l'IPC : on reconstruit le choix du loader champ par champ plutôt que de le recopier tel quel.
  let choice: LoaderChoice = { loader: 'vanilla' }
  if (input.loader !== 'vanilla') {
    if (!isModLoader(input.loader)) throw new Error(`Loader inconnu : ${input.loader}`)
    if (!input.loaderVersion) throw new Error(`Version de ${input.loader} manquante`)
    choice = { loader: input.loader, loaderVersion: input.loaderVersion }
  }

  // Slug unique ("mon-modpack", "mon-modpack-2", …) : mkdir non récursif = réservation atomique du dossier.
  const base = slugify(name)
  await mkdir(baseDir, { recursive: true })
  let id = base
  for (let n = 2; ; n++) {
    try {
      await mkdir(instanceDir(baseDir, id))
      break
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== 'EEXIST') throw e
      id = `${base}-${n}`
    }
  }

  const instance: Instance = {
    id,
    name,
    mcVersion: input.mcVersion,
    ...choice,
    memoryMb: clampMemory(input.memoryMb),
    createdAt: new Date().toISOString(),
    ...(input.art && { art: input.art }) // pas de clé « art: undefined » : l'objet renvoyé doit égaler celui relu du disque
  }
  await mkdir(join(instanceGameDir(baseDir, id), 'mods'), { recursive: true })
  await writeFile(metaFile(baseDir, id), JSON.stringify(instance, null, 2))
  return instance
}

/** Modifie les réglages d'une instance (le nom de dossier ne change jamais). */
export async function updateInstance(
  baseDir: string,
  id: string,
  patch: { name?: string; memoryMb?: number }
): Promise<Instance> {
  const current = await getInstance(baseDir, id)
  const next: Instance = {
    ...current,
    name: patch.name?.trim() ? patch.name.trim().slice(0, 60) : current.name,
    memoryMb: patch.memoryMb === undefined ? current.memoryMb : clampMemory(patch.memoryMb)
  }
  await writeFile(metaFile(baseDir, id), JSON.stringify(next, null, 2))
  return next
}

/** Supprime l'instance ET son dossier de jeu (mondes et mods compris). */
export async function deleteInstance(baseDir: string, id: string): Promise<void> {
  await rm(instanceDir(baseDir, id), { recursive: true, force: true })
}
