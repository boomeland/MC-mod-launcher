// Bouton Jouer, progression des téléchargements (barre d'état) et logs du jeu.
import { $ } from './dom'
import { getSelectedInstance, setBusy, showTab } from './instances'
import { appendLog, clearLog, errorText, setProgress, setStatus } from './status'

const playBtn = $<HTMLButtonElement>('play')
const playLabel = $('play-label')
const usernameIn = $<HTMLInputElement>('username')

/** Le bouton porte l'état de la partie : prêt, en préparation (téléchargements), en jeu. */
function setPlayState(state: 'ready' | 'preparing' | 'running') {
  playBtn.disabled = state !== 'ready'
  playLabel.textContent = { ready: 'Jouer', preparing: 'Préparation…', running: 'En jeu' }[state]
  setBusy(state !== 'ready')
}

export function initPlay() {
  window.launcher.onProgress((p) => {
    setStatus(`${p.stage} — ${p.done}/${p.total}`)
    setProgress(p.total ? p.done / p.total : 0)
  })
  window.launcher.onLog(appendLog)
  window.launcher.onExit((code) => {
    setStatus(code === 0 ? 'Jeu fermé' : `Jeu fermé (code ${code})`)
    setPlayState('ready')
  })

  playBtn.addEventListener('click', async () => {
    const instance = getSelectedInstance()
    if (!instance) return
    setPlayState('preparing')
    showTab('console')
    clearLog()
    try {
      await window.launcher.play({ instanceId: instance.id, offlineName: usernameIn.value.trim() || 'Player' })
      setPlayState('running')
      setStatus(`${instance.name} est lancé`)
      setProgress(1)
    } catch (e) {
      setStatus(`Erreur : ${errorText(e)}`)
      setPlayState('ready')
    }
  })
}
