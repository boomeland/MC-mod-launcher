// Zone compte : hors-ligne, connexion Microsoft en cours (code à saisir), connecté.
import { $ } from './dom'
import { setStatus } from './status'

const accountOut = $('account-out')
const accountPending = $('account-pending')
const accountIn = $('account-in')

function showAccount(name: string | null, pending = false) {
  accountOut.hidden = pending || name !== null
  accountPending.hidden = !pending
  accountIn.hidden = name === null
  if (name) $('account-name').textContent = name
}

export function initAccount() {
  window.launcher.onLoginCode((c) => {
    $('code').textContent = c.userCode
    $('uri').textContent = c.verificationUri
    showAccount(null, true)
  })

  $('login').addEventListener('click', async () => {
    try {
      showAccount(await window.launcher.login())
      setStatus('Connecté')
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
}
