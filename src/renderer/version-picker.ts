// Sélecteur « version de Minecraft + loader + version du loader », partagé par la création d'instance et ses Réglages.
// Les éléments HTML suivent une convention d'ids : <préfixe>version, <préfixe>snapshots, <préfixe>loader-group…
import type { Instance } from '../core/instances'
import type { VersionInfo } from '../shared/api'
import { $ } from './dom'
import { LOADER_NAMES, shortLoaderVersion } from './instances'
import { setStatus } from './status'

type Loader = Instance['loader']

export interface PickedVersion {
  mcVersion: string
  loader: Loader
  /** Vide pour Vanilla. */
  loaderVersion: string
}

// Liste des versions Mojang : chargée une fois pour toute l'app.
let mojang: Promise<{ latestRelease: string; versions: VersionInfo[] }> | null = null
const loadVersions = () => (mojang ??= window.launcher.listVersions())

export function createVersionPicker(prefix: string, radioName: string, onChange: () => void) {
  const versionSel = $<HTMLSelectElement>(`${prefix}version`)
  const snapshots = $<HTMLInputElement>(`${prefix}snapshots`)
  const loaderVersionSel = $<HTMLSelectElement>(`${prefix}loader-version`)
  const loaderVersionWrap = $(`${prefix}loader-version-wrap`)
  let request = 0 // ignore les réponses périmées si l'utilisateur change vite de version ou de loader
  let loaded = true // faux tant que les versions du loader ne sont pas arrivées

  const loader = () => (document.querySelector<HTMLInputElement>(`input[name="${radioName}"]:checked`)?.value ?? 'vanilla') as Loader

  async function renderVersions(prefer?: string) {
    const r = await loadVersions()
    const shown = r.versions.filter((v) => v.type === 'release' || (snapshots.checked && v.type === 'snapshot'))
    const wanted = prefer ?? (versionSel.value || r.latestRelease)
    versionSel.replaceChildren(...shown.map((v) => new Option(v.id, v.id)))
    if (shown.some((v) => v.id === wanted)) versionSel.value = wanted
  }

  async function renderLoaderVersions(prefer?: string) {
    const l = loader()
    const req = ++request
    loaderVersionWrap.hidden = l === 'vanilla'
    loaded = l === 'vanilla'
    onChange()
    if (l === 'vanilla') return

    const mc = versionSel.value
    const name = LOADER_NAMES[l]
    $(`${prefix}loader-version-label`).textContent = `Version ${name}`
    loaderVersionSel.replaceChildren(new Option('Chargement…', ''))
    try {
      const list = await window.launcher.listLoaderVersions(l, mc)
      if (req !== request) return
      if (list.versions.length === 0) {
        loaderVersionSel.replaceChildren(new Option(`Aucun ${name} pour ${mc}`, ''))
        return
      }
      const tag = (v: string) => (v === list.recommended ? ' (recommandée)' : v === list.latest ? ' (dernière)' : '')
      loaderVersionSel.replaceChildren(...list.versions.map((v) => new Option(shortLoaderVersion(mc, v) + tag(v), v)))
      loaderVersionSel.value = prefer && list.versions.includes(prefer) ? prefer : (list.recommended ?? list.latest ?? list.versions[0])
      loaded = true
      onChange()
    } catch (e) {
      if (req !== request) return
      loaderVersionSel.replaceChildren(new Option('Erreur de chargement', ''))
      setStatus(`Erreur : ${(e as Error).message}`)
    }
  }

  versionSel.addEventListener('change', () => void renderLoaderVersions())
  snapshots.addEventListener('change', () => void renderVersions().then(() => renderLoaderVersions()))
  $(`${prefix}loader-group`).addEventListener('change', () => void renderLoaderVersions())
  loaderVersionSel.addEventListener('change', onChange)

  return {
    value: (): PickedVersion => ({ mcVersion: versionSel.value, loader: loader(), loaderVersion: loader() === 'vanilla' ? '' : loaderVersionSel.value }),
    /** Vrai quand la sélection est complète (version du loader chargée et choisie). */
    isReady: () => loaded && Boolean(versionSel.value) && (loader() === 'vanilla' || Boolean(loaderVersionSel.value)),
    /** Positionne le sélecteur : sur une instance existante, ou sur la dernière version sans loader. */
    async set(v?: Partial<PickedVersion>) {
      const r = await loadVersions()
      snapshots.checked = r.versions.find((x) => x.id === v?.mcVersion)?.type === 'snapshot'
      const radio = document.querySelector<HTMLInputElement>(`input[name="${radioName}"][value="${v?.loader ?? 'vanilla'}"]`)
      if (radio) radio.checked = true
      await renderVersions(v?.mcVersion ?? r.latestRelease)
      await renderLoaderVersions(v?.loaderVersion)
    }
  }
}
