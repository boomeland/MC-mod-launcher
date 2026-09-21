// Barre de progression, ligne de statut et console de logs.
import { $ } from './dom'

const fill = $('fill')
const status = $('status')
const log = $('log')

export function setStatus(text: string) {
  status.textContent = text
}

/** `ratio` entre 0 et 1. */
export function setProgress(ratio: number) {
  fill.style.width = `${ratio * 100}%`
}

export function appendLog(line: string) {
  log.append(line + '\n')
  log.scrollTop = log.scrollHeight
}

export function clearLog() {
  log.textContent = ''
}
