// Mods d'une instance : les .jar de minecraft/mods/. Désactiver un mod = le renommer en .jar.disabled
// (convention partagée par les launchers : le loader ignore ce fichier, et on peut le réactiver sans le retélécharger).
import { copyFile, mkdir, readdir, rename, rm } from 'node:fs/promises'
import { basename, join } from 'node:path'
import { sha1File } from './download'
import { insideDir } from './paths'

export interface LocalMod {
  /** Nom du fichier dans mods/ (avec .disabled s'il est désactivé). */
  file: string
  enabled: boolean
}

// Un simple nom de fichier .jar (éventuellement .disabled) : pas de dossier, pas de caractère interdit sous Windows.
const MOD_FILE = /^[^\\/:*?"<>|]+\.jar(\.disabled)?$/i

const modsDir = (gameDir: string) => join(gameDir, 'mods')

/** Chemin d'un mod. Le nom vient souvent de l'IPC ou d'une API : on refuse tout ce qui n'est pas un .jar de mods/. */
export function modPath(gameDir: string, file: string): string {
  if (!MOD_FILE.test(file)) throw new Error(`Nom de mod invalide : ${file}`)
  return insideDir(modsDir(gameDir), file)
}

export async function listMods(gameDir: string): Promise<LocalMod[]> {
  const entries = await readdir(modsDir(gameDir), { withFileTypes: true }).catch(() => [])
  const mods = entries
    .filter((e) => e.isFile() && MOD_FILE.test(e.name))
    .map((e) => ({ file: e.name, enabled: !e.name.toLowerCase().endsWith('.disabled') }))
  return mods.sort((a, b) => a.file.localeCompare(b.file, 'fr', { sensitivity: 'base' }))
}

/** Active ou désactive un mod ; renvoie son nouveau nom de fichier. */
export async function setModEnabled(gameDir: string, file: string, enabled: boolean): Promise<string> {
  const base = file.replace(/\.disabled$/i, '')
  const target = enabled ? base : `${base}.disabled`
  if (target !== file) await rename(modPath(gameDir, file), modPath(gameDir, target))
  return target
}

export async function deleteMod(gameDir: string, file: string): Promise<void> {
  await rm(modPath(gameDir, file))
}

/** Copie des .jar choisis par l'utilisateur dans mods/ ; renvoie les noms ajoutés. */
export async function addModFiles(gameDir: string, sources: string[]): Promise<string[]> {
  await mkdir(modsDir(gameDir), { recursive: true })
  const added: string[] = []
  for (const src of sources) {
    const name = basename(src)
    if (!/\.jar$/i.test(name)) throw new Error(`Ce n'est pas un fichier .jar : ${name}`)
    await copyFile(src, modPath(gameDir, name))
    added.push(name)
  }
  return added
}

/** SHA1 de chaque mod (sert à les reconnaître sur Modrinth, même ajoutés à la main). */
export async function hashMods(gameDir: string, files: string[]): Promise<Record<string, string>> {
  const pairs = await Promise.all(files.map(async (f) => [f, await sha1File(modPath(gameDir, f))] as const))
  return Object.fromEntries(pairs)
}
