// Liste des instances (barre latérale) et vue de l'instance sélectionnée : bannière, onglets Console / Réglages.
import type { Instance } from '../core/instances'
import { $, el, tile } from './dom'
import { setStatus } from './status'
import { currentView, showView } from './views'

const list = $<HTMLUListElement>('instance-list')
const memoryIn = $<HTMLInputElement>('inst-memory')
const renameIn = $<HTMLInputElement>('inst-rename')
const deleteBtn = $<HTMLButtonElement>('delete')

let instances: Instance[] = []
let selectedId: string | null = null

export const getSelectedInstance = (): Instance | null => instances.find((i) => i.id === selectedId) ?? null

export const LOADER_NAMES: Record<Instance['loader'], string> = { vanilla: 'Vanilla', forge: 'Forge', neoforge: 'NeoForge', fabric: 'Fabric' }

/** Version du loader sans le Minecraft en préfixe (Forge "1.20.1-47.3.0" → "47.3.0" ; NeoForge n'en a pas). */
export const shortLoaderVersion = (mcVersion: string, v: string) => (v.startsWith(`${mcVersion}-`) ? v.slice(mcVersion.length + 1) : v)

const loaderLabel = (i: Instance) =>
  i.loader === 'vanilla' ? 'Vanilla' : `${LOADER_NAMES[i.loader]} ${shortLoaderVersion(i.mcVersion, i.loaderVersion)}`

const gigabytes = (mb: number) => `${(mb / 1024).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} Go`

/** Pastille de la bannière ; `color` ajoute un point à la couleur du loader. */
function chip(text: string, color?: string) {
  const c = el('span', { className: 'chip' }, text)
  if (color) {
    const dot = el('span', { className: 'dot' })
    dot.style.setProperty('--dot', `var(--${color})`)
    c.prepend(dot)
  }
  return c
}

function renderList() {
  if (instances.length === 0) {
    list.replaceChildren(el('li', { className: 'instance-empty' }, 'Aucune instance pour le moment.'))
    return
  }
  list.replaceChildren(
    ...instances.map((i) => {
      const btn = el(
        'button',
        { className: `instance-item${i.id === selectedId ? ' selected' : ''}`, title: i.name, onclick: () => select(i.id) },
        tile(i.name, i.loader, i.art?.icon),
        el('div', {}, el('span', { className: 'name' }, i.name), el('span', { className: 'meta' }, `${i.mcVersion} · ${LOADER_NAMES[i.loader]}`))
      )
      return el('li', {}, btn)
    })
  )
}

function renderInstance(sel: Instance) {
  $('hero-tile').replaceChildren(tile(sel.name, sel.loader, sel.art?.icon, 'tile-xl'))
  $('inst-name').textContent = sel.name
  $('inst-chips').replaceChildren(chip(`Minecraft ${sel.mcVersion}`), chip(loaderLabel(sel), sel.loader), chip(gigabytes(sel.memoryMb)))

  const bg = $('hero-bg')
  const splash = sel.art?.splash
  bg.className = splash ? 'hero-bg' : 'hero-bg generated'
  bg.style.backgroundImage = splash ? `url("${splash}")` : ''
  bg.style.setProperty('--hero-color', `color-mix(in srgb, var(--${sel.loader}) 45%, transparent)`)

  renameIn.value = sel.name
  memoryIn.value = String(sel.memoryMb)
  $('inst-memory-label').textContent = gigabytes(sel.memoryMb)
}

function render() {
  if (!getSelectedInstance()) selectedId = instances[0]?.id ?? null
  renderList()
  const sel = getSelectedInstance()
  if (sel) renderInstance(sel)
  if (currentView() !== 'discover') showView(sel ? 'instance' : 'empty')
}

function select(id: string) {
  selectedId = id
  render()
  showView('instance')
}

export function showTab(name: 'console' | 'settings') {
  for (const t of document.querySelectorAll<HTMLButtonElement>('.tab')) t.classList.toggle('active', t.dataset.tab === name)
  $('tab-console').hidden = name !== 'console'
  $('tab-settings').hidden = name !== 'settings'
}

/** Recharge la liste depuis le disque ; `selectId` sélectionne une instance (ex. celle qu'on vient de créer). */
export async function refreshInstances(selectId?: string) {
  instances = await window.launcher.listInstances()
  if (selectId) selectedId = selectId
  render()
  if (selectId) showView('instance')
}

/** Pendant qu'un jeu tourne, on ne modifie ni ne supprime les instances. */
export function setBusy(busy: boolean) {
  for (const input of [deleteBtn, memoryIn, renameIn]) input.disabled = busy
}

async function update(patch: { name?: string; memoryMb?: number }) {
  const sel = getSelectedInstance()
  if (!sel) return
  try {
    await window.launcher.updateInstance(sel.id, patch)
    await refreshInstances()
  } catch (e) {
    setStatus(`Erreur : ${(e as Error).message}`)
  }
}

export function initInstances() {
  for (const t of document.querySelectorAll<HTMLButtonElement>('.tab')) {
    t.addEventListener('click', () => showTab(t.dataset.tab as 'console' | 'settings'))
  }
  $('nav-library').addEventListener('click', () => showView(getSelectedInstance() ? 'instance' : 'empty'))

  memoryIn.addEventListener('input', () => ($('inst-memory-label').textContent = gigabytes(Number(memoryIn.value))))
  memoryIn.addEventListener('change', () => void update({ memoryMb: Number(memoryIn.value) }))
  renameIn.addEventListener('change', () => void update({ name: renameIn.value }))

  $('open-folder').addEventListener('click', async () => {
    const sel = getSelectedInstance()
    if (!sel) return
    try {
      await window.launcher.openInstanceFolder(sel.id)
    } catch (e) {
      setStatus(`Erreur : ${(e as Error).message}`)
    }
  })

  deleteBtn.addEventListener('click', async () => {
    const sel = getSelectedInstance()
    if (!sel) return
    try {
      if (!(await window.launcher.deleteInstance(sel.id))) return
      selectedId = null
      showTab('console')
      await refreshInstances()
      setStatus('Instance supprimée')
    } catch (e) {
      setStatus(`Erreur : ${(e as Error).message}`)
    }
  })

  void refreshInstances()
}
