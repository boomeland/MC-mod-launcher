// Barre de progression, ligne de statut et console de logs.
import { $ } from './dom'

const fill = $('fill')
const status = $('status')
const log = $('log')

export function setStatus(text: string) {
  status.textContent = text
}

/** Message d'une erreur, sans l'enveloppe qu'Electron ajoute aux rejets d'IPC (« Error invoking remote method 'x': Error: »). */
export const errorText = (e: unknown) => (e as Error).message.replace(/^Error invoking remote method '[^']*': (\w*Error: )?/, '')

/** `ratio` entre 0 et 1. */
export function setProgress(ratio: number) {
  fill.style.width = `${ratio * 100}%`
}

// Un modpack écrit des dizaines de milliers de lignes. Ajouter chaque ligne au DOM puis défiler forçait un recalcul
// de mise en page par ligne, sur un texte qui ne faisait que grossir : renderer à 5 Go, interface figée (vécu).
// On regroupe donc l'affichage par image, et on ne garde que la fin du log (le fichier complet est dans logs/).
const MAX_LOG_CHARS = 200_000
let pending: string[] = []

function flushLog() {
  if (pending.length === 0) return // clearLog() est passé entre la programmation et l'exécution
  const text = `${log.textContent}${pending.join('\n')}\n`
  pending = []
  log.textContent = text.length > MAX_LOG_CHARS ? text.slice(-MAX_LOG_CHARS) : text
  log.scrollTop = log.scrollHeight
}

export function appendLog(line: string) {
  if (pending.length === 0) requestAnimationFrame(flushLog)
  pending.push(line)
}

export function clearLog() {
  pending = []
  log.textContent = ''
}
