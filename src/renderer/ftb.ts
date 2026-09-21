// Page « Modpacks FTB » : grille de cartes filtrable, puis fiche du pack (version, RAM) et installation dans une nouvelle instance.
import type { FtbPack, FtbVersion } from '../core/modpacks/ftb'
import { $, el, tile } from './dom'
import { LOADER_NAMES, refreshInstances } from './instances'
import { setProgress, setStatus } from './status'
import { showView } from './views'

const grid = $('ftb-grid')
const search = $<HTMLInputElement>('ftb-search')
const showUnsupported = $<HTMLInputElement>('ftb-unsupported')
const dialog = $<HTMLDialogElement>('ftb-dialog')
const form = $<HTMLFormElement>('ftb-form')
const versionSel = $<HTMLSelectElement>('ftb-version')
const memoryIn = $<HTMLInputElement>('ftb-memory')
const submitBtn = $<HTMLButtonElement>('ftb-submit')

let packs: FtbPack[] | null = null // chargé à la première visite (~100 requêtes à l'API FTB)
let loading = false
let loaderFilter = ''
let current: FtbPack | null = null
let installing = false // une installation à la fois : la barre de progression est commune

const loaderName = (v: FtbVersion) => LOADER_NAMES[v.loader as keyof typeof LOADER_NAMES] ?? v.loader
/** Version proposée par défaut : la plus récente jouable, en évitant les archivées si possible. */
const bestVersion = (p: FtbPack) => {
  const playable = p.versions.filter((v) => v.supported)
  return playable.find((v) => v.type !== 'archived') ?? playable[0]
}

function card(p: FtbPack): HTMLElement {
  const v = bestVersion(p) ?? p.versions[0]
  const chips = el('div', { className: 'chips' }, el('span', { className: 'chip' }, v.mcVersion), el('span', { className: 'chip' }, loaderName(v)))
  if (!bestVersion(p)) chips.append(el('span', { className: 'chip' }, 'Non pris en charge'))
  return el(
    'button',
    { className: 'pack-card', disabled: !bestVersion(p), title: p.name, onclick: () => openPack(p) },
    tile(p.name, v.loader, p.art.icon, 'tile-lg'),
    el('div', {}, el('h3', {}, p.name), el('p', {}, p.synopsis), chips)
  )
}

function renderGrid() {
  if (!packs) return
  const q = search.value.trim().toLowerCase()
  const shown = packs.filter((p) => {
    const v = bestVersion(p)
    if (!v && !showUnsupported.checked) return false
    if (loaderFilter && (v ?? p.versions[0]).loader !== loaderFilter) return false
    return p.name.toLowerCase().includes(q)
  })
  const playable = packs.filter((p) => bestVersion(p)).length
  $('ftb-count').textContent = `${playable} modpacks jouables sur ${packs.length}`
  grid.replaceChildren(...(shown.length ? shown.map(card) : [el('p', { className: 'grid-message' }, 'Aucun modpack ne correspond.')]))
}

export async function openDiscover() {
  showView('discover')
  if (packs || loading) return
  loading = true
  grid.replaceChildren(el('p', { className: 'grid-message' }, 'Chargement du catalogue FTB…'))
  try {
    packs = await window.launcher.listFtbPacks()
    renderGrid()
  } catch (e) {
    grid.replaceChildren(el('p', { className: 'grid-message' }, `Impossible de charger le catalogue : ${(e as Error).message}`))
  } finally {
    loading = false
  }
}

function renderMemory() {
  const v = current?.versions.find((x) => x.id === Number(versionSel.value))
  if (!v) return
  memoryIn.value = String(v.recommendedMemoryMb)
  $('ftb-ram-hint').textContent = `Mémoire recommandée par le pack : ${v.recommendedMemoryMb / 1024} Go.`
}

function openPack(p: FtbPack) {
  current = p
  const banner = $('ftb-banner')
  banner.style.backgroundImage = p.art.splash ? `url("${p.art.splash}")` : ''
  $('ftb-icon').replaceChildren(tile(p.name, bestVersion(p)?.loader ?? '', p.art.icon, 'tile-lg'))
  $('ftb-name').textContent = p.name
  $('ftb-synopsis').textContent = p.synopsis
  versionSel.replaceChildren(
    ...p.versions.map((v) => {
      const o = new Option(`${v.name} (${v.type}) — MC ${v.mcVersion} · ${loaderName(v)} ${v.loaderVersion}`, String(v.id))
      o.disabled = !v.supported
      return o
    })
  )
  versionSel.value = String(bestVersion(p)?.id)
  renderMemory()
  submitBtn.disabled = installing
  dialog.showModal()
}

export function initFtb() {
  $('nav-discover').addEventListener('click', () => void openDiscover())
  search.addEventListener('input', renderGrid)
  showUnsupported.addEventListener('change', renderGrid)
  for (const b of $('ftb-filters').querySelectorAll<HTMLButtonElement>('.chip-btn')) {
    b.addEventListener('click', () => {
      loaderFilter = b.dataset.loader ?? ''
      for (const other of $('ftb-filters').querySelectorAll('.chip-btn')) other.classList.toggle('active', other === b)
      renderGrid()
    })
  }
  versionSel.addEventListener('change', renderMemory)
  $('ftb-cancel').addEventListener('click', () => dialog.close())

  form.addEventListener('submit', async (e) => {
    e.preventDefault()
    const pack = current
    const version = pack?.versions.find((v) => v.id === Number(versionSel.value))
    if (!pack || !version) return
    dialog.close()
    installing = true
    setStatus(`Installation de ${pack.name} ${version.name}…`)
    try {
      const instance = await window.launcher.installFtbPack(pack.id, version.id, Number(memoryIn.value))
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
