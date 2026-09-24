// Diagnostic d'une partie qui s'est mal terminée : quel rapport ouvrir, et quelle cause expliquer au joueur.
// Les règles viennent de crashs réels provoqués au labo (voir tests/crash.test.mts) : on n'ajoute une cause que
// lorsqu'un vrai cas la montre.
import { readdir, readFile, stat } from 'node:fs/promises'
import { join } from 'node:path'

export interface CrashDiagnosis {
  /** Explication pour le joueur. */
  cause: string
  /** Rapport écrit pendant la partie (crash-reports/ ou hs_err de Java), à ouvrir pour les détails. */
  report?: string
}

/**
 * Rapport écrit depuis `since` : le plus récent de crash-reports/ (Minecraft, Forge, NeoForge), sinon un
 * hs_err_pid*.log à la racine du dossier de jeu (Java lui-même a planté, il écrit dans son dossier courant).
 */
export async function findCrashReport(gameDir: string, since: number): Promise<string | undefined> {
  const recent = async (dir: string, match: (name: string) => boolean) => {
    const names = (await readdir(dir).catch(() => [])).filter(match)
    const files = await Promise.all(names.map(async (n) => ({ path: join(dir, n), mtime: (await stat(join(dir, n))).mtimeMs })))
    return files.filter((f) => f.mtime >= since).sort((a, b) => b.mtime - a.mtime)[0]?.path
  }
  return (
    (await recent(join(gameDir, 'crash-reports'), (n) => n.endsWith('.txt'))) ??
    (await recent(gameDir, (n) => /^hs_err_pid\d+\.log$/.test(n)))
  )
}

/** Cause reconnue dans le rapport ou la fin de la console ; undefined si rien de connu. */
export function explainCrash(text: string): string | undefined {
  // Fabric calcule lui-même la solution (« Install sodium, version … or later. ») : on la reprend telle quelle.
  const fabric = text.match(/A potential solution has been determined[^\n]*\n((?:\s*- [^\n]+\n?)+)/)
  if (fabric) {
    const steps = fabric[1].split('\n').map((l) => l.replace(/^\s*- /, '').trim()).filter(Boolean)
    return `Mods incompatibles. Solution proposée par Fabric : ${steps.join(' ; ')}`
  }

  // Forge / NeoForge : une ligne « Failure message » par problème (souvent une dépendance manquante), parfois en double.
  const failures = [...new Set([...text.matchAll(/Failure message: ([^\n]+)/g)].map((m) => m[1].trim()))]
  if (failures.length) return `Les mods n'ont pas pu être chargés : ${failures.join(' ; ')}`

  // « java.lang.OutOfMemoryError » (Minecraft) ou « OutOfMemory encountered » (hs_err de Java).
  if (/OutOfMemory(Error| encountered)/.test(text))
    return "Minecraft a manqué de mémoire : augmente la RAM de l'instance dans l'onglet Réglages."

  return undefined
}

/**
 * Diagnostic à la fin d'une partie, quel que soit le code de sortie : avec un écran d'erreur (NeoForge, Fabric,
 * « Out of memory »), le jeu reste ouvert, et le joueur le ferme normalement ou par le bouton Arrêter.
 * null : aucun rapport et aucune cause reconnue, la partie s'est terminée normalement (ou rien à expliquer).
 */
export async function diagnoseCrash(gameDir: string, since: number, consoleTail: string[]): Promise<CrashDiagnosis | null> {
  const report = await findCrashReport(gameDir, since)
  const text = report ? await readFile(report, 'utf8') : ''
  const cause = explainCrash(`${text}\n${consoleTail.join('\n')}`)
  if (cause) return { cause, report }
  if (!report) return null
  const description = text.match(/^Description: (.+)$/m)?.[1].trim()
  return { cause: description ? `Le jeu a planté : ${description}` : 'Java a planté (erreur fatale de la machine virtuelle).', report }
}
