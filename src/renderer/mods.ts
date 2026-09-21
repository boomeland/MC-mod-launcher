// Onglet Mods : mods installés (activer, supprimer, mettre à jour), ajout de .jar locaux, recherche sur Modrinth.
import type { Instance } from '../core/instances'
import type { ModHit, ModIdentity, ModUpdate } from '../core/modrinth-mods'
import type { LocalMod } from '../core/mods'
import { $, el, tile } from './dom'
import { getSelectedInstance, isBusy, LOADER_NAMES, onInstanceChange, shortLoaderVersion } from './instances'
import { setStatus } from './status'

const panel = $('tab-mods')
const list = $<HTMLUListElement>('mods-list')
const filterIn = $<HTMLInputElement>('mods-filter')
const dialog = $<HTMLDialogElement>('mods-dialog')
const searchIn = $<HTMLInputElement>('mods-search')
const results = $<HTMLUListElement>('mods-results')

const TRASH = '<svg viewBox="0 0 24 24"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3" /></svg>'

let instanceId: string | null = null
let mods: LocalMod[] = []
let identities: Record<string, ModIdentity> = {}
let updates = new Map<string, ModUpdate>()

const modTitle = (m: LocalMod) => identities[m.file]?.title ?? m.file.replace(/\.jar(\.disabled)?$/i, '')
const downloads = (n: number) => `${new Intl.NumberFormat('fr-FR', { notation: 'compact' }).format(n)} téléchargements`

/** Les fichiers d'un jeu lancé sont verrouillés : on refuse toute modification tant qu'il tourne. */
function guard(): string | null {
  if (isBusy()) {
    setStatus('Ferme le jeu avant de modifier les mods.')
    return null
  }
  return instanceId
}

async function run(action: () => Promise<unknown>, done?: string) {
  try {
    await action()
    if (done) setStatus(done)
  } catch (e) {
    setStatus(`Erreur : ${(e as Error).message}`)
  }
  await load()
}

function row(m: LocalMod): HTMLElement {
  const id = identities[m.file]
  const update = updates.get(m.file)
  const toggle = el('input', { type: 'checkbox', checked: m.enabled, title: m.enabled ? 'Désactiver' : 'Activer' })
  toggle.addEventListener('change', () => {
    const iid = guard()
    if (!iid) return void (toggle.checked = m.enabled)
    void run(() => window.launcher.setModEnabled(iid, m.file, toggle.checked))
  })
  const actions = el('div', { className: 'mod-actions' })
  if (update) {
    actions.append(el('button', { className: 'btn btn-sm btn-soft', onclick: () => void applyUpdates([update]) }, `→ ${update.versionNumber}`))
  }
  actions.append(
    el('label', { className: 'switch' }, toggle, el('span')),
    el('button', {
      className: 'icon-btn',
      title: 'Supprimer',
      innerHTML: TRASH,
      onclick: () => {
        const iid = guard()
        if (iid) void run(() => window.launcher.deleteMod(iid, m.file), `${modTitle(m)} supprimé`)
      }
    })
  )
  return el(
    'li',
    { className: `mod-row${m.enabled ? '' : ' off'}` },
    tile(modTitle(m), 'mod', id?.icon),
    el('div', { className: 'mod-main' }, el('span', { className: 'mod-name' }, modTitle(m)), el('span', { className: 'mod-meta' }, id ? `${id.versionNumber} · ${m.file}` : m.file)),
    actions
  )
}

function render() {
  const q = filterIn.value.trim().toLowerCase()
  const shown = mods.filter((m) => modTitle(m).toLowerCase().includes(q) || m.file.toLowerCase().includes(q))
  const active = mods.filter((m) => m.enabled).length
  $('mods-count').textContent = mods.length ? `${mods.length} mods · ${active} actifs` : ''
  list.replaceChildren(
    ...(shown.length ? shown.map(row) : [el('li', { className: 'mods-empty' }, mods.length ? 'Aucun mod ne correspond.' : 'Aucun mod. Ajoute-en depuis Modrinth ou glisse des .jar ici.')])
  )
  $('mods-updates').hidden = updates.size === 0
  $('mods-updates-text').textContent = `${updates.size} mise${updates.size > 1 ? 's' : ''} à jour disponible${updates.size > 1 ? 's' : ''}`
}

/** Recharge la liste (immédiate), puis l'enrichit avec les noms et icônes Modrinth (réseau). */
async function load() {
  const id = instanceId
  if (!id) return
  mods = await window.launcher.listMods(id)
  render()
  // Hors ligne ou Modrinth indisponible : la liste reste utilisable avec les noms de fichiers.
  identities = await window.launcher.identifyMods(id, mods.map((m) => m.file)).catch(() => identities)
  if (id === instanceId) render()
}

async function applyUpdates(list: ModUpdate[]) {
  const iid = guard()
  if (!iid) return
  await run(async () => {
    for (const [n, u] of list.entries()) {
      setStatus(`Mise à jour ${n + 1}/${list.length} : ${u.file}`)
      await window.launcher.updateMod(iid, u.file, u.versionId)
      updates.delete(u.file)
    }
  }, `${list.length} mod${list.length > 1 ? 's' : ''} mis à jour`)
}

// ---------- Recherche Modrinth ----------
let searchTimer = 0
let searchRequest = 0
let hits: ModHit[] = []
let total = 0

function installedProjects() {
  return new Set(Object.values(identities).map((i) => i.projectId))
}

function resultRow(h: ModHit, installed: Set<string>): HTMLElement {
  const btn = el('button', { className: 'btn btn-sm btn-primary' }, 'Installer')
  if (installed.has(h.id)) Object.assign(btn, { disabled: true, textContent: 'Installé' })
  btn.addEventListener('click', async () => {
    const iid = guard()
    if (!iid) return
    Object.assign(btn, { disabled: true, textContent: 'Installation…' })
    try {
      const added = await window.launcher.installMod(iid, h.id)
      btn.textContent = 'Installé'
      const deps = added.length - 1
      setStatus(added.length ? `${h.title} installé${deps > 0 ? ` (+ ${deps} dépendance${deps > 1 ? 's' : ''})` : ''}` : `${h.title} était déjà installé`)
      await load()
      renderResults() // les résultats ont pu être redessinés pendant l'installation, avec l'ancien état « installé »
    } catch (e) {
      Object.assign(btn, { disabled: false, textContent: 'Installer' })
      setStatus(`Erreur : ${(e as Error).message}`)
    }
  })
  return el(
    'li',
    { className: 'mod-result' },
    tile(h.title, 'mod', h.icon, 'tile-md'),
    el('div', { className: 'mod-main' }, el('span', { className: 'mod-name' }, h.title), el('span', { className: 'mod-desc' }, h.description), el('span', { className: 'mod-meta' }, downloads(h.downloads))),
    btn
  )
}

function renderResults() {
  const installed = installedProjects()
  const more = hits.length < total ? [el('li', { className: 'more' }, el('button', { className: 'btn btn-soft', onclick: () => void search(true) }, 'Charger plus'))] : []
  results.replaceChildren(...(hits.length ? hits.map((h) => resultRow(h, installed)) : [el('li', { className: 'mods-empty' }, 'Aucun mod compatible trouvé.')]), ...more)
}

async function search(append = false) {
  const id = instanceId
  if (!id) return
  const req = ++searchRequest
  if (!append) results.replaceChildren(el('li', { className: 'mods-empty' }, 'Recherche…'))
  try {
    const r = await window.launcher.searchMods(id, searchIn.value, append ? hits.length : 0)
    if (req !== searchRequest) return
    hits = append ? [...hits, ...r.hits] : r.hits
    total = r.total
    renderResults()
  } catch (e) {
    if (req === searchRequest) results.replaceChildren(el('li', { className: 'mods-empty' }, `Erreur : ${(e as Error).message}`))
  }
}

function openBrowser(i: Extract<Instance, { loaderVersion: string }>) {
  $('mods-dialog-target').textContent = `Compatibles avec ${LOADER_NAMES[i.loader]} ${shortLoaderVersion(i.mcVersion, i.loaderVersion)} · Minecraft ${i.mcVersion}`
  searchIn.value = ''
  dialog.showModal()
  searchIn.focus()
  void search()
}

export function initMods() {
  onInstanceChange((i) => {
    if (!i || i.loader === 'vanilla' || i.id === instanceId) return
    instanceId = i.id
    identities = {}
    updates = new Map()
    filterIn.value = ''
    void load()
  })

  $('tab-btn-mods').addEventListener('click', () => void load()) // le dossier a pu changer (pack installé, ajout à la main)
  filterIn.addEventListener('input', render)
  $('mods-add').addEventListener('click', () => {
    const iid = guard()
    if (iid) void run(() => window.launcher.addMods(iid).then((a) => a.length && setStatus(`${a.length} mod${a.length > 1 ? 's' : ''} ajouté${a.length > 1 ? 's' : ''}`)))
  })
  $('mods-check').addEventListener('click', async () => {
    const id = instanceId
    if (!id) return
    setStatus('Recherche de mises à jour…')
    try {
      const found = await window.launcher.checkModUpdates(id)
      updates = new Map(found.map((u) => [u.file, u]))
      render()
      setStatus(found.length ? `${found.length} mise(s) à jour disponible(s)` : 'Tous les mods sont à jour')
    } catch (e) {
      setStatus(`Erreur : ${(e as Error).message}`)
    }
  })
  $('mods-update-all').addEventListener('click', () => void applyUpdates([...updates.values()]))

  // Glisser-déposer de .jar : le chemin n'est lisible que via le preload (page sandboxée).
  panel.addEventListener('dragover', (e) => {
    e.preventDefault()
    panel.classList.add('dragging')
  })
  panel.addEventListener('dragleave', () => panel.classList.remove('dragging'))
  panel.addEventListener('drop', (e) => {
    e.preventDefault()
    panel.classList.remove('dragging')
    const iid = guard()
    const paths = [...(e.dataTransfer?.files ?? [])].filter((f) => /\.jar$/i.test(f.name)).map((f) => window.launcher.pathForFile(f))
    if (!iid || !paths.length) return
    void run(() => window.launcher.addMods(iid, paths), `${paths.length} mod${paths.length > 1 ? 's' : ''} ajouté${paths.length > 1 ? 's' : ''}`)
  })

  $('mods-browse').addEventListener('click', () => {
    const i = getSelectedInstance()
    if (i && i.loader !== 'vanilla') openBrowser(i)
  })
  $('mods-dialog-close').addEventListener('click', () => dialog.close())
  searchIn.addEventListener('input', () => {
    clearTimeout(searchTimer)
    searchTimer = window.setTimeout(() => void search(), 350)
  })
}
