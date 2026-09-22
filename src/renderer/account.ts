// Zone compte (bas de la barre latérale) : hors-ligne, connexion Microsoft en cours (code à saisir), connecté.
import { $ } from './dom'
import { setStatus } from './status'

const accountOut = $('account-out')
const accountPending = $('account-pending')
const accountIn = $('account-in')
const usernameIn = $<HTMLInputElement>('username')

const initial = (name: string) => name.trim().charAt(0).toUpperCase() || '?'

function showAccount(name: string | null, pending = false) {
  accountOut.hidden = pending || name !== null
  accountPending.hidden = !pending
  accountIn.hidden = name === null
  if (name) {
    $('account-name').textContent = name
    $('avatar-ms').textContent = initial(name)
  }
}

/** Sans connexion préalable, le pseudo hors-ligne est grisé (le main refuse de toute façon de lancer). */
async function syncOfflineLock() {
  const allowed = await window.launcher.offlineAllowed()
  usernameIn.disabled = !allowed
  $('offline-label').textContent = allowed ? 'Pseudo hors-ligne' : 'Connecte-toi pour jouer'
}

export function initAccount() {
  const syncAvatar = () => ($('avatar').textContent = initial(usernameIn.value))
  usernameIn.addEventListener('input', syncAvatar)
  syncAvatar()

  window.launcher.onLoginCode((c) => {
    $('code').textContent = c.userCode
    $('uri').textContent = c.verificationUri
    showAccount(null, true)
  })

  $('login').addEventListener('click', async () => {
    try {
      showAccount(await window.launcher.login())
      setStatus('Connecté')
      void syncOfflineLock()
    } catch (e) {
      showAccount(null)
      setStatus(`Erreur : ${(e as Error).message}`)
    }
  })
  $('cancel').addEventListener('click', () => window.launcher.cancelLogin())
  $('logout').addEventListener('click', async () => {
    await window.launcher.logout()
    showAccount(null)
  })

  window.launcher.getAccount().then((name) => showAccount(name))
  void syncOfflineLock()
}
