// Bouton Jouer, progression des téléchargements (barre d'état) et logs du jeu.
import { $ } from './dom'
import { getSelectedInstance, setBusy, showTab } from './instances'
import { appendLog, clearLog, errorText, setProgress, setStatus } from './status'

const playBtn = $<HTMLButtonElement>('play')
const playLabel = $('play-label')
const playIcon = playBtn.querySelector('path')!
const usernameIn = $<HTMLInputElement>('username')
const crashBox = $('crash')
const crashCause = $('crash-cause')
const crashOpen = $<HTMLButtonElement>('crash-open')
let state: 'ready' | 'preparing' | 'running' = 'ready'

/** Le bouton porte l'état de la partie : prêt, en préparation (téléchargements), en jeu (il sert alors à l'arrêter). */
function setPlayState(s: typeof state) {
  state = s
  playBtn.disabled = s === 'preparing'
  playBtn.classList.toggle('stop', s === 'running')
  playLabel.textContent = { ready: 'Jouer', preparing: 'Préparation…', running: 'Arrêter' }[s]
  playIcon.setAttribute('d', s === 'running' ? 'M6 6h12v12H6z' : 'M8 5v14l11-7z')
  setBusy(s !== 'ready')
}

export function initPlay() {
  window.launcher.onProgress((p) => {
    setStatus(`${p.stage} — ${p.done}/${p.total}`)
    setProgress(p.total ? p.done / p.total : 0)
  })
  window.launcher.onLog(appendLog)
  window.launcher.onExit(({ code, crash }) => {
    // code null : process tué (bouton Arrêter), il n'a pas de code de sortie.
    setStatus(code === 0 ? 'Jeu fermé' : code === null ? 'Jeu arrêté' : `Jeu fermé (code ${code})`)
    setPlayState('ready')
    if (!crash) return
    crashCause.textContent = crash.cause
    crashOpen.hidden = !crash.report
    crashBox.hidden = false
    showTab('console')
  })
  crashOpen.addEventListener('click', () =>
    window.launcher.openCrashReport().catch((e) => setStatus(`Erreur : ${errorText(e)}`))
  )

  playBtn.addEventListener('click', async () => {
    if (state === 'running') return void window.launcher.stop()
    const instance = getSelectedInstance()
    if (!instance) return
    setPlayState('preparing')
    showTab('console')
    clearLog()
    crashBox.hidden = true
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
