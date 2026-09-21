// Boîte de dialogue « Nouvelle instance » : nom, version de Minecraft, loader (Vanilla / Forge / NeoForge / Fabric), RAM.
import type { NewInstance } from '../core/instances'
import type { VersionInfo } from '../shared/api'
import { $ } from './dom'
import { LOADER_NAMES, refreshInstances, shortLoaderVersion } from './instances'
import { setStatus } from './status'

const dialog = $<HTMLDialogElement>('create-dialog')
const form = $<HTMLFormElement>('create-form')
const nameIn = $<HTMLInputElement>('new-name')
const versionSel = $<HTMLSelectElement>('version')
const snapshots = $<HTMLInputElement>('snapshots')
const loaderGroup = $<HTMLFieldSetElement>('loader-group')
const loaderVersionSel = $<HTMLSelectElement>('loader-version')
const loaderVersionWrap = $('loader-version-wrap')
const memoryIn = $<HTMLInputElement>('new-memory')
const submitBtn = $<HTMLButtonElement>('create-submit')

let all: VersionInfo[] = []
let latest = ''
let loaderRequest = 0 // ignore les réponses périmées si l'utilisateur change vite de version ou de loader
let memoryTouched = false

// Les valeurs viennent des boutons radio du HTML, qui correspondent aux loaders du cœur.
const selectedLoader = () => (form.elements.namedItem('loader') as RadioNodeList).value as NewInstance['loader']

function renderVersions() {
  const shown = all.filter((v) => v.type === 'release' || (snapshots.checked && v.type === 'snapshot'))
  const prev = versionSel.value || latest
  versionSel.replaceChildren(...shown.map((v) => new Option(v.id, v.id)))
  if (shown.some((v) => v.id === prev)) versionSel.value = prev
  void renderLoaderVersions()
}

async function renderLoaderVersions() {
  const loader = selectedLoader()
  const req = ++loaderRequest
  loaderVersionWrap.hidden = loader === 'vanilla'
  submitBtn.disabled = false
  if (loader === 'vanilla') return

  const mc = versionSel.value
  const name = LOADER_NAMES[loader]
  $('loader-version-label').textContent = `Version ${name}`
  loaderVersionSel.replaceChildren(new Option('Chargement…', ''))
  submitBtn.disabled = true
  try {
    const list = await window.launcher.listLoaderVersions(loader, mc)
    if (req !== loaderRequest) return
    const label = (full: string) => {
      const tag = full === list.recommended ? ' (recommandée)' : full === list.latest ? ' (dernière)' : ''
      return new Option(shortLoaderVersion(mc, full) + tag, full)
    }
    if (list.versions.length === 0) {
      loaderVersionSel.replaceChildren(new Option(`Aucun ${name} pour ${mc}`, ''))
      return
    }
    loaderVersionSel.replaceChildren(...list.versions.map(label))
    loaderVersionSel.value = list.recommended ?? list.latest ?? list.versions[0]
    submitBtn.disabled = false
  } catch (e) {
    if (req !== loaderRequest) return
    loaderVersionSel.replaceChildren(new Option('Erreur de chargement', ''))
    setStatus(`Erreur : ${(e as Error).message}`)
  }
}

/** Le jeu modé a besoin de plus de mémoire, tant que l'utilisateur n'a pas choisi lui-même. */
function suggestMemory() {
  if (!memoryTouched) memoryIn.value = selectedLoader() === 'vanilla' ? '2048' : '4096'
}

export function initCreateForm() {
  $('new-instance').addEventListener('click', () => {
    form.reset()
    memoryTouched = false
    renderVersions()
    dialog.showModal()
    nameIn.focus()
  })
  $('create-cancel').addEventListener('click', () => dialog.close())

  loaderGroup.addEventListener('change', () => {
    suggestMemory()
    void renderLoaderVersions()
  })
  versionSel.addEventListener('change', () => void renderLoaderVersions())
  snapshots.addEventListener('change', renderVersions)
  memoryIn.addEventListener('input', () => (memoryTouched = true))

  form.addEventListener('submit', async (e) => {
    e.preventDefault()
    const mcVersion = versionSel.value
    const loader = selectedLoader()
    const loaderVersion = loaderVersionSel.value
    if (loader !== 'vanilla' && !loaderVersion) return setStatus(`Aucune version ${LOADER_NAMES[loader]} sélectionnée`)

    const base = { name: nameIn.value.trim() || `${mcVersion} ${LOADER_NAMES[loader]}`, mcVersion, memoryMb: Number(memoryIn.value) }
    submitBtn.disabled = true
    try {
      const instance = await window.launcher.createInstance(
        loader === 'vanilla' ? { ...base, loader } : { ...base, loader, loaderVersion }
      )
      dialog.close()
      await refreshInstances(instance.id)
      setStatus(`Instance « ${instance.name} » créée`)
    } catch (err) {
      setStatus(`Erreur : ${(err as Error).message}`)
    } finally {
      submitBtn.disabled = false
    }
  })

  window.launcher.listVersions().then((r) => {
    all = r.versions
    latest = r.latestRelease
  })
}
