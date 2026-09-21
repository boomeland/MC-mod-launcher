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
  /** Arguments JVM ajoutés à la commande de lancement, tels que tapés par l'utilisateur. */
  jvmArgs?: string
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

/** Choix du loader reconstruit champ par champ plutôt que recopié : l'entrée vient souvent de l'IPC. */
function parseLoaderChoice(input: { loader: string; loaderVersion?: string }): LoaderChoice {
  if (input.loader === 'vanilla') return { loader: 'vanilla' }
  if (!isModLoader(input.loader)) throw new Error(`Loader inconnu : ${input.loader}`)
  if (!input.loaderVersion) throw new Error(`Version de ${input.loader} manquante`)
  return { loader: input.loader, loaderVersion: input.loaderVersion }
}

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
  const choice = parseLoaderChoice(input)

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

export interface InstancePatch {
  name?: string
  memoryMb?: number
  /** Arguments JVM en plus, tels que tapés ("" pour les retirer). */
  jvmArgs?: string
  /** Nouvelle version de Minecraft et du loader (les mods déjà présents peuvent devenir incompatibles). */
  version?: { mcVersion: string; loader: string; loaderVersion?: string }
}

const MAX_JVM_ARGS = 1000

/** Modifie les réglages d'une instance (le nom de dossier ne change jamais). Le patch vient de l'IPC : tout est revalidé. */
export async function updateInstance(baseDir: string, id: string, patch: InstancePatch): Promise<Instance> {
  const old = await getInstance(baseDir, id)
  const target = patch.version ?? old
  if (!target.mcVersion) throw new Error('Version de Minecraft manquante')
  const jvmArgs = (patch.jvmArgs ?? old.jvmArgs ?? '').trim()
  if (jvmArgs.length > MAX_JVM_ARGS) throw new Error(`Arguments JVM trop longs (${MAX_JVM_ARGS} caractères maximum)`)

  // Reconstruit champ par champ : pas de loaderVersion périmé après un passage en vanilla, ni de clé inattendue.
  const next: Instance = {
    id: old.id,
    name: patch.name?.trim() ? patch.name.trim().slice(0, 60) : old.name,
    mcVersion: target.mcVersion,
    ...parseLoaderChoice(target),
    memoryMb: patch.memoryMb === undefined ? old.memoryMb : clampMemory(patch.memoryMb),
    createdAt: old.createdAt,
    ...(old.art && { art: old.art }),
    ...(jvmArgs && { jvmArgs })
  }
  await writeFile(metaFile(baseDir, id), JSON.stringify(next, null, 2))
  return next
}

/** Découpe les arguments JVM d'une instance, en respectant les guillemets ("-Dchemin=C:\Mes Jeux"). */
export function splitJvmArgs(args: string | undefined): string[] {
  return [...(args ?? '').matchAll(/"([^"]*)"|(\S+)/g)].map((m) => m[1] ?? m[2])
}

/** Supprime l'instance ET son dossier de jeu (mondes et mods compris). */
export async function deleteInstance(baseDir: string, id: string): Promise<void> {
  await rm(instanceDir(baseDir, id), { recursive: true, force: true })
}
