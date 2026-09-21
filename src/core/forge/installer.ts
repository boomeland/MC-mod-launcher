import AdmZip from 'adm-zip'
import { spawn } from 'node:child_process'

/** Lit l'id de la version que l'installer va créer (dans versions/<id>/). */
export function versionIdFromInstaller(jarPath: string): string {
  const zip = new AdmZip(jarPath)
  const entry = zip.getEntry('install_profile.json')
  if (!entry) throw new Error("install_profile.json introuvable dans l'installer Forge")
  const profile = JSON.parse(zip.readAsText(entry)) as { version?: string; versionInfo?: { id: string } }
  const id = profile.version ?? profile.versionInfo?.id // nouveau format / format ≤ 1.12
  if (!id) throw new Error("Impossible de déterminer l'id de la version Forge")
  return id
}

/** Lance l'installer officiel en headless ; les dernières lignes de sortie sont jointes à l'erreur en cas d'échec. */
export function runInstaller(java: string, jar: string, gameRoot: string, onLog?: (line: string) => void): Promise<void> {
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
      code === 0 ? resolve() : reject(new Error(`L'installer Forge a échoué (code ${code}) :\n${tail.join('\n')}`))
    )
  })
}
