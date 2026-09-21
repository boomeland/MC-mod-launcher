// Liste des instances (barre latérale) et vue de l'instance sélectionnée : bannière et onglets.
// Les onglets Mods et Réglages vivent dans leurs propres modules, abonnés via onInstanceChange.
import type { Instance } from '../core/instances'
import { $, el, tile } from './dom'
import { setStatus } from './status'
import { currentView, showView } from './views'

type Tab = 'console' | 'mods' | 'settings'

const list = $<HTMLUListElement>('instance-list')

let instances: Instance[] = []
let selectedId: string | null = null
let busy = false
const listeners: ((i: Instance | null, busy: boolean) => void)[] = []

export const getSelectedInstance = (): Instance | null => instances.find((i) => i.id === selectedId) ?? null
/** Vrai pendant qu'un jeu tourne : on ne modifie alors ni les instances ni leurs mods (fichiers verrouillés). */
export const isBusy = () => busy
/** Appelé à chaque rendu : changement de sélection, rechargement de la liste, début ou fin de partie. */
export const onInstanceChange = (cb: (i: Instance | null, busy: boolean) => void) => listeners.push(cb)

export const LOADER_NAMES: Record<Instance['loader'], string> = { vanilla: 'Vanilla', forge: 'Forge', neoforge: 'NeoForge', fabric: 'Fabric' }

/** Version du loader sans le Minecraft en préfixe (Forge "1.20.1-47.3.0" → "47.3.0" ; NeoForge n'en a pas). */
export const shortLoaderVersion = (mcVersion: string, v: string) => (v.startsWith(`${mcVersion}-`) ? v.slice(mcVersion.length + 1) : v)

const loaderLabel = (i: Instance) =>
  i.loader === 'vanilla' ? 'Vanilla' : `${LOADER_NAMES[i.loader]} ${shortLoaderVersion(i.mcVersion, i.loaderVersion)}`

export const gigabytes = (mb: number) => `${(mb / 1024).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} Go`

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

  // Pas de mods sans loader : l'onglet disparaît, et on n'y reste pas.
  $('tab-btn-mods').hidden = sel.loader === 'vanilla'
  if (sel.loader === 'vanilla' && !$('tab-mods').hidden) showTab('console')
}

function render() {
  if (!getSelectedInstance()) selectedId = instances[0]?.id ?? null
  renderList()
  const sel = getSelectedInstance()
  if (sel) renderInstance(sel)
  if (currentView() !== 'discover') showView(sel ? 'instance' : 'empty')
  for (const cb of listeners) cb(sel, busy)
}

function select(id: string) {
  selectedId = id
  render()
  showView('instance')
}

export function showTab(name: Tab) {
  for (const t of document.querySelectorAll<HTMLButtonElement>('.tab')) t.classList.toggle('active', t.dataset.tab === name)
  for (const tab of ['console', 'mods', 'settings'] as Tab[]) $(`tab-${tab}`).hidden = tab !== name
}

/** Recharge la liste depuis le disque ; `selectId` sélectionne une instance (ex. celle qu'on vient de créer). */
export async function refreshInstances(selectId?: string | null) {
  instances = await window.launcher.listInstances()
  if (selectId !== undefined) selectedId = selectId
  render()
  if (selectId) showView('instance')
}

export function setBusy(b: boolean) {
  busy = b
  document.body.classList.toggle('game-running', b)
  render()
}

export function initInstances() {
  for (const t of document.querySelectorAll<HTMLButtonElement>('.tab')) {
    t.addEventListener('click', () => showTab(t.dataset.tab as Tab))
  }
  $('nav-library').addEventListener('click', () => showView(getSelectedInstance() ? 'instance' : 'empty'))

  $('open-folder').addEventListener('click', async () => {
    const sel = getSelectedInstance()
    if (!sel) return
    try {
      await window.launcher.openInstanceFolder(sel.id)
    } catch (e) {
      setStatus(`Erreur : ${(e as Error).message}`)
    }
  })

  void refreshInstances()
}
