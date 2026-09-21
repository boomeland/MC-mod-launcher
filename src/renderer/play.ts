// Bouton Jouer, progression des téléchargements et logs du jeu.
import { $ } from './dom'
import { appendLog, clearLog, setProgress, setStatus } from './status'
import { getSelection } from './versions'

const playBtn = $<HTMLButtonElement>('play')
const usernameIn = $<HTMLInputElement>('username')

export function initPlay() {
  window.launcher.onProgress((p) => {
    setStatus(`${p.stage} — ${p.done}/${p.total}`)
    setProgress(p.total ? p.done / p.total : 0)
  })
  window.launcher.onLog(appendLog)
  window.launcher.onExit((code) => {
    setStatus(`Jeu fermé (code ${code})`)
    playBtn.disabled = false
  })

  playBtn.addEventListener('click', async () => {
    const selection = getSelection()
    if (!selection) {
      setStatus('Aucune version Forge sélectionnée')
      return
    }
    playBtn.disabled = true
    clearLog()
    try {
      await window.launcher.play({ ...selection, offlineName: usernameIn.value.trim() || 'Player' })
      setStatus('Jeu lancé')
      setProgress(1)
    } catch (e) {
      setStatus(`Erreur : ${(e as Error).message}`)
      playBtn.disabled = false
    }
  })
}
