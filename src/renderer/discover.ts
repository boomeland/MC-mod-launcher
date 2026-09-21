// Page « Modpacks » : sources Modrinth et FTB, recherche paginée, fiche du pack (version, RAM) et installation.
import type { PackDetail, PackSourceId, PackSummary, PackVersion } from '../core/modpacks'
import { $, el, tile } from './dom'
import { LOADER_NAMES, refreshInstances } from './instances'
import { setProgress, setStatus } from './status'
import { showView } from './views'

const grid = $('packs-grid')
const search = $<HTMLInputElement>('packs-search')
const showUnsupported = $<HTMLInputElement>('packs-unsupported')
const dialog = $<HTMLDialogElement>('pack-dialog')
const form = $<HTMLFormElement>('pack-form')
const versionSel = $<HTMLSelectElement>('pack-version')
const memoryIn = $<HTMLInputElement>('pack-memory')
const submitBtn = $<HTMLButtonElement>('pack-submit')

let source: PackSourceId = 'modrinth'
let loaderFilter = ''
let hits: PackSummary[] = []
let total = 0
let request = 0 // ignore les réponses périmées (frappe rapide, changement de source)
let searchTimer = 0
let current: PackDetail | null = null
let installing = false // une installation à la fois : la barre de progression est commune

const loaderName = (l: string) => LOADER_NAMES[l as keyof typeof LOADER_NAMES] ?? (l ? l[0].toUpperCase() + l.slice(1) : '—')
/** Version proposée par défaut : la plus récente jouable et stable, sinon la plus récente jouable. */
const bestVersion = (versions: PackVersion[]) => {
  const playable = versions.filter((v) => v.supported)
  return playable.find((v) => v.type === 'release') ?? playable[0]
}

function card(p: PackSummary): HTMLElement {
  const chips = el('div', { className: 'chips' }, el('span', { className: 'chip' }, p.mcVersion || '?'), el('span', { className: 'chip' }, loaderName(p.loader)))
  if (!p.supported) chips.append(el('span', { className: 'chip' }, 'Non pris en charge'))
  return el(
    'button',
    { className: 'pack-card', disabled: !p.supported, title: p.name, onclick: () => void openPack(p) },
    tile(p.name, p.loader, p.icon, 'tile-lg'),
    el('div', {}, el('h3', {}, p.name), el('p', {}, p.summary), chips)
  )
}

function renderGrid() {
  const shown = hits.filter((p) => p.supported || showUnsupported.checked)
  const more = hits.length < total ? [el('div', { className: 'grid-more' }, el('button', { className: 'btn btn-soft', onclick: () => void load(true) }, 'Charger plus'))] : []
  $('packs-count').textContent = `${total.toLocaleString('fr-FR')} modpack${total > 1 ? 's' : ''} sur ${source === 'ftb' ? 'FTB' : 'Modrinth'}`
  grid.replaceChildren(...(shown.length ? shown.map(card) : [el('p', { className: 'grid-message' }, 'Aucun modpack ne correspond.')]), ...more)
}

async function load(append = false) {
  const req = ++request
  if (!append) grid.replaceChildren(el('p', { className: 'grid-message' }, source === 'ftb' ? 'Chargement du catalogue FTB…' : 'Recherche…'))
  try {
    const r = await window.launcher.searchPacks(source, search.value, loaderFilter, append ? hits.length : 0)
    if (req !== request) return
    hits = append ? [...hits, ...r.hits] : r.hits
    total = r.total
    renderGrid()
  } catch (e) {
    if (req === request) grid.replaceChildren(el('p', { className: 'grid-message' }, `Impossible de charger les modpacks : ${(e as Error).message}`))
  }
}

export function openDiscover() {
  showView('discover')
  if (!hits.length) void load()
}

function renderMemory() {
  const v = current?.versions.find((x) => x.id === versionSel.value)
  if (!v) return
  memoryIn.value = String(v.recommendedMemoryMb)
  $('pack-ram-hint').textContent =
    current?.source === 'ftb' ? `Mémoire recommandée par le pack : ${v.recommendedMemoryMb / 1024} Go.` : 'Modrinth ne précise pas la mémoire requise : 4 Go est un bon point de départ.'
  submitBtn.disabled = installing || !v.supported
}

/** Ouvre la fiche tout de suite avec ce qu'on sait, puis charge les versions. */
async function openPack(p: PackSummary) {
  current = null
  $('pack-banner').style.backgroundImage = ''
  $('pack-icon').replaceChildren(tile(p.name, p.loader, p.icon, 'tile-lg'))
  $('pack-name').textContent = p.name
  $('pack-summary').textContent = p.summary
  versionSel.replaceChildren(new Option('Chargement des versions…', ''))
  submitBtn.disabled = true
  dialog.showModal()
  try {
    const detail = await window.launcher.getPack(p.source, p.id)
    current = detail
    if (detail.art.splash) $('pack-banner').style.backgroundImage = `url("${detail.art.splash}")`
    versionSel.replaceChildren(
      ...detail.versions.map((v) => {
        const o = new Option(`${v.name} (${v.type}) — MC ${v.mcVersion} · ${loaderName(v.loader)}${v.loaderVersion ? ` ${v.loaderVersion}` : ''}`, v.id)
        o.disabled = !v.supported
        return o
      })
    )
    versionSel.value = bestVersion(detail.versions)?.id ?? ''
    renderMemory()
  } catch (e) {
    versionSel.replaceChildren(new Option('Erreur de chargement', ''))
    setStatus(`Erreur : ${(e as Error).message}`)
  }
}

export function initDiscover() {
  $('nav-discover').addEventListener('click', openDiscover)
  search.addEventListener('input', () => {
    clearTimeout(searchTimer)
    searchTimer = window.setTimeout(() => void load(), 350)
  })
  showUnsupported.addEventListener('change', renderGrid)
  for (const b of $('packs-sources').querySelectorAll<HTMLButtonElement>('.source-tab')) {
    b.addEventListener('click', () => {
      source = b.dataset.source as PackSourceId
      for (const other of $('packs-sources').querySelectorAll('.source-tab')) other.classList.toggle('active', other === b)
      void load()
    })
  }
  for (const b of $('packs-filters').querySelectorAll<HTMLButtonElement>('.chip-btn')) {
    b.addEventListener('click', () => {
      loaderFilter = b.dataset.loader ?? ''
      for (const other of $('packs-filters').querySelectorAll('.chip-btn')) other.classList.toggle('active', other === b)
      void load()
    })
  }
  versionSel.addEventListener('change', renderMemory)
  $('pack-cancel').addEventListener('click', () => dialog.close())

  form.addEventListener('submit', async (e) => {
    e.preventDefault()
    const pack = current
    const version = pack?.versions.find((v) => v.id === versionSel.value)
    if (!pack || !version) return
    dialog.close()
    installing = true
    setStatus(`Installation de ${pack.name} ${version.name}…`)
    try {
      const instance = await window.launcher.installPack(pack.source, pack.id, version.id, Number(memoryIn.value))
      await refreshInstances(instance.id)
      setProgress(1)
      setStatus(`Modpack « ${instance.name} » installé`)
    } catch (err) {
      setStatus(`Erreur : ${(err as Error).message}`)
    } finally {
      installing = false
    }
  })
}
