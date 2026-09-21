import type { LauncherApi, VersionInfo } from '../shared/api'

declare global {
  interface Window {
    launcher: LauncherApi
  }
}

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T
const versionSel = $<HTMLSelectElement>('version')
const usernameIn = $<HTMLInputElement>('username')
const snapshots = $<HTMLInputElement>('snapshots')
const playBtn = $<HTMLButtonElement>('play')
const fill = $('fill')
const status = $('status')
const log = $('log')

let all: VersionInfo[] = []
let latest = ''

const loaderSel = $<HTMLSelectElement>('loader')
const forgeSel = $<HTMLSelectElement>('forge')
const forgeWrap = $('forge-wrap')

function renderVersions() {
  const shown = all.filter((v) => v.type === 'release' || (snapshots.checked && v.type === 'snapshot'))
  const prev = versionSel.value || latest
  versionSel.replaceChildren(...shown.map((v) => new Option(v.id, v.id)))
  if (shown.some((v) => v.id === prev)) versionSel.value = prev
  void renderForge()
}

let forgeRequest = 0 // ignore les réponses périmées si l'utilisateur change vite de version

async function renderForge() {
  const useForge = loaderSel.value === 'forge'
  forgeWrap.hidden = !useForge
  playBtn.disabled = false
  if (!useForge) return

  const mc = versionSel.value
  const req = ++forgeRequest
  forgeSel.replaceChildren(new Option('Chargement…', ''))
  playBtn.disabled = true
  try {
    const list = await window.launcher.listForgeVersions(mc)
    if (req !== forgeRequest) return
    const label = (full: string) => {
      const tag = full === list.recommended ? ' (recommandée)' : full === list.latest ? ' (dernière)' : ''
      return new Option(full.slice(mc.length + 1) + tag, full)
    }
    if (list.versions.length === 0) {
      forgeSel.replaceChildren(new Option(`Aucun Forge pour ${mc}`, ''))
      return
    }
    forgeSel.replaceChildren(...list.versions.map(label))
    forgeSel.value = list.recommended ?? list.latest ?? list.versions[0]
    playBtn.disabled = false
  } catch (e) {
    if (req !== forgeRequest) return
    forgeSel.replaceChildren(new Option('Erreur de chargement', ''))
    status.textContent = `Erreur : ${(e as Error).message}`
  }
}

loaderSel.addEventListener('change', () => void renderForge())
versionSel.addEventListener('change', () => void renderForge())

function appendLog(line: string) {
  log.append(line + '\n')
  log.scrollTop = log.scrollHeight
}

window.launcher.onProgress((p) => {
  status.textContent = `${p.stage} — ${p.done}/${p.total}`
  fill.style.width = `${p.total ? (p.done / p.total) * 100 : 0}%`
})
window.launcher.onLog(appendLog)
window.launcher.onExit((code) => {
  status.textContent = `Jeu fermé (code ${code})`
  playBtn.disabled = false
})

// --- Compte ---

const accountOut = $('account-out')
const accountPending = $('account-pending')
const accountIn = $('account-in')

function showAccount(name: string | null, pending = false) {
  accountOut.hidden = pending || name !== null
  accountPending.hidden = !pending
  accountIn.hidden = name === null
  if (name) $('account-name').textContent = name
}

window.launcher.onLoginCode((c) => {
  $('code').textContent = c.userCode
  $('uri').textContent = c.verificationUri
  showAccount(null, true)
})

$('login').addEventListener('click', async () => {
  try {
    showAccount(await window.launcher.login())
    status.textContent = 'Connecté'
  } catch (e) {
    showAccount(null)
    status.textContent = `Erreur : ${(e as Error).message}`
  }
})
$('cancel').addEventListener('click', () => window.launcher.cancelLogin())
$('logout').addEventListener('click', async () => {
  await window.launcher.logout()
  showAccount(null)
})

window.launcher.getAccount().then((name) => showAccount(name))

playBtn.addEventListener('click', async () => {
  const forgeVersion = loaderSel.value === 'forge' ? forgeSel.value : undefined
  if (loaderSel.value === 'forge' && !forgeVersion) {
    status.textContent = 'Aucune version Forge sélectionnée'
    return
  }
  playBtn.disabled = true
  log.textContent = ''
  try {
    await window.launcher.play({
      mcVersion: versionSel.value,
      forgeVersion,
      offlineName: usernameIn.value.trim() || 'Player'
    })
    status.textContent = 'Jeu lancé'
    fill.style.width = '100%'
  } catch (e) {
    status.textContent = `Erreur : ${(e as Error).message}`
    playBtn.disabled = false
  }
})

snapshots.addEventListener('change', renderVersions)

window.launcher.listVersions().then((r) => {
  all = r.versions
  latest = r.latestRelease
  renderVersions()
})
