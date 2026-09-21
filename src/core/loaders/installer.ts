// Installation via l'installer officiel du loader, lancé en headless. Forge et NeoForge partagent le même installer
// (NeoForge est un fork) : il patche le jeu (« processors ») et crée versions/<id>/, ce qu'on ne réimplémente pas.
import AdmZip from 'adm-zip'
import { spawn } from 'node:child_process'
import { mkdir, stat, writeFile } from 'node:fs/promises'
import { basename, join } from 'node:path'
import { downloadFile } from '../download'
import { installVersion } from '../install'
import type { GamePaths } from '../paths'
import type { ProgressFn } from '../types'

const exists = (p: string) => stat(p).then(() => true, () => false)

/** Lit l'id de la version que l'installer va créer (dans versions/<id>/). */
function versionIdFromInstaller(jarPath: string): string {
  const zip = new AdmZip(jarPath)
  const entry = zip.getEntry('install_profile.json')
  if (!entry) throw new Error("install_profile.json introuvable dans l'installer")
  const profile = JSON.parse(zip.readAsText(entry)) as { version?: string; versionInfo?: { id: string } }
  const id = profile.version ?? profile.versionInfo?.id // nouveau format / format Forge ≤ 1.12
  if (!id) throw new Error("Impossible de déterminer l'id de la version à installer")
  return id
}

/** Lance l'installer en headless ; les dernières lignes de sortie sont jointes à l'erreur en cas d'échec. */
function runInstaller(java: string, jar: string, gameRoot: string, onLog?: (line: string) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn(java, ['-Djava.awt.headless=true', '-jar', jar, '--installClient', gameRoot], {
      cwd: gameRoot,
      windowsHide: true
    })
    const tail: string[] = []
    const onData = (d: Buffer) =>
      d.toString().split(/\r?\n/).filter(Boolean).forEach((l) => {
        tail.push(l)
        if (tail.length > 30) tail.shift()
        onLog?.(l)
      })
    proc.stdout.on('data', onData)
    proc.stderr.on('data', onData)
    proc.on('error', reject)
    proc.on('exit', (code) =>
      code === 0 ? resolve() : reject(new Error(`L'installer a échoué (code ${code}) :\n${tail.join('\n')}`))
    )
  })
}

/**
 * Installe un loader via son installer et renvoie l'id de la version à lancer.
 * Étapes : vanilla (+ Java Mojang) → installer en headless → marqueur de réussite.
 */
export async function installWithInstaller(
  paths: GamePaths,
  mcVersion: string,
  installerUrl: string,
  label: string,
  onProgress?: ProgressFn,
  onLog?: (line: string) => void
): Promise<string> {
  // Le vanilla d'abord : l'installer en a besoin, et on réutilise son JRE (adapté à cette version de MC).
  const { javaPath } = await installVersion(paths, mcVersion, onProgress)

  const installer = join(paths.root, 'installers', basename(installerUrl))
  await downloadFile({ url: installerUrl, dest: installer })

  // Le marqueur évite de rejouer un installer de plusieurs minutes : il n'est écrit qu'après une installation complète.
  const id = versionIdFromInstaller(installer)
  const marker = join(paths.versionDir(id), '.installed-by-launcher')
  if (await exists(marker)) return id

  // L'installer exige un launcher_profiles.json dans le dossier cible (il l'édite pour ajouter un profil).
  const profiles = join(paths.root, 'launcher_profiles.json')
  if (!(await exists(profiles))) {
    await mkdir(paths.root, { recursive: true })
    await writeFile(profiles, JSON.stringify({ profiles: {}, settings: {}, version: 3 }))
  }

  const stage = `Installation de ${label}`
  onProgress?.({ stage, done: 0, total: 1 })
  await runInstaller(javaPath, installer, paths.root, onLog)
  if (!(await exists(paths.versionJson(id)))) throw new Error(`${label} installé mais versions/${id} est introuvable`)

  await writeFile(marker, new Date().toISOString())
  onProgress?.({ stage, done: 1, total: 1 })
  return id
}
