// Choix de la version de Minecraft, du loader (Vanilla / Forge) et de la version Forge.
import { $ } from './dom'
import { setStatus } from './status'
import type { VersionInfo } from '../shared/api'

const versionSel = $<HTMLSelectElement>('version')
const snapshots = $<HTMLInputElement>('snapshots')
const loaderSel = $<HTMLSelectElement>('loader')
const forgeSel = $<HTMLSelectElement>('forge')
const forgeWrap = $('forge-wrap')
const playBtn = $<HTMLButtonElement>('play')

let all: VersionInfo[] = []
let latest = ''
let forgeRequest = 0 // ignore les réponses périmées si l'utilisateur change vite de version

function renderVersions() {
  const shown = all.filter((v) => v.type === 'release' || (snapshots.checked && v.type === 'snapshot'))
  const prev = versionSel.value || latest
  versionSel.replaceChildren(...shown.map((v) => new Option(v.id, v.id)))
  if (shown.some((v) => v.id === prev)) versionSel.value = prev
  void renderForge()
}

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
    setStatus(`Erreur : ${(e as Error).message}`)
  }
}

export interface Selection {
  mcVersion: string
  /** Absent = vanilla. */
  forgeVersion?: string
}

/** Sélection courante, ou null si Forge est choisi sans version Forge valide. */
export function getSelection(): Selection | null {
  if (loaderSel.value !== 'forge') return { mcVersion: versionSel.value }
  return forgeSel.value ? { mcVersion: versionSel.value, forgeVersion: forgeSel.value } : null
}

export function initVersions() {
  loaderSel.addEventListener('change', () => void renderForge())
  versionSel.addEventListener('change', () => void renderForge())
  snapshots.addEventListener('change', renderVersions)

  window.launcher.listVersions().then((r) => {
    all = r.versions
    latest = r.latestRelease
    renderVersions()
  })
}
