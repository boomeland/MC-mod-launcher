// Carte « mise à jour » de la barre latérale : téléchargement en cours, prête à installer, ou (version portable) disponible.
import { $ } from './dom'
import { isBusy } from './instances'
import { setStatus } from './status'

export function initUpdate() {
  const btn = $<HTMLButtonElement>('update-btn')
  let state: 'downloading' | 'ready' | 'available' = 'downloading'

  window.launcher.onUpdate((u) => {
    state = u.state
    $('update-card').hidden = false
    $('update-title').textContent = `Version ${u.version}`
    $('update-text').textContent = {
      downloading: 'Téléchargement en arrière-plan…',
      ready: 'Prête. Installée au prochain redémarrage.',
      available: 'Disponible sur GitHub.'
    }[u.state]
    btn.hidden = u.state === 'downloading'
    btn.textContent = u.state === 'ready' ? 'Redémarrer' : 'Télécharger'
  })

  btn.addEventListener('click', () => {
    if (state === 'available') return void window.launcher.openReleasePage()
    // Redémarrer le launcher sous un jeu en cours couperait sa console et son suivi : on attend la fin de la partie.
    if (isBusy()) return setStatus('Ferme le jeu avant d\'installer la mise à jour.')
    void window.launcher.installUpdate()
  })
}
