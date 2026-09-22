// Onglet Réglages de l'instance : nom, version du jeu et du loader, mémoire, arguments JVM, suppression.
import type { Instance, InstancePatch } from '../core/instances'
import { $ } from './dom'
import { getSelectedInstance, gigabytes, isBusy, onInstanceChange, refreshInstances, showTab } from './instances'
import { errorText, setStatus } from './status'
import { createVersionPicker } from './version-picker'

const renameIn = $<HTMLInputElement>('inst-rename')
const memoryIn = $<HTMLInputElement>('inst-memory')
const jvmIn = $<HTMLInputElement>('inst-jvm')
const applyBtn = $<HTMLButtonElement>('set-version-apply')
const deleteBtn = $<HTMLButtonElement>('delete')

let shownId: string | null = null // instance dont les champs sont affichés (pour ne pas écraser une saisie en cours)

/** La version choisie diffère-t-elle de celle de l'instance ? */
function versionChanged(i: Instance) {
  const v = picker.value()
  return v.mcVersion !== i.mcVersion || v.loader !== i.loader || (v.loader !== 'vanilla' && 'loaderVersion' in i && v.loaderVersion !== i.loaderVersion)
}

function syncApply() {
  const i = getSelectedInstance()
  applyBtn.disabled = !i || isBusy() || !picker.isReady() || !versionChanged(i)
}

const picker = createVersionPicker('set-', 'set-loader', syncApply)

async function update(patch: InstancePatch, done?: string) {
  const i = getSelectedInstance()
  if (!i) return
  try {
    await window.launcher.updateInstance(i.id, patch)
    await refreshInstances()
    if (done) setStatus(done)
  } catch (e) {
    setStatus(`Erreur : ${errorText(e)}`)
  }
}

function render(i: Instance | null, busy: boolean) {
  for (const input of [deleteBtn, memoryIn, renameIn, jvmIn]) input.disabled = busy
  if (!i) return
  renameIn.value = i.name
  memoryIn.value = String(i.memoryMb)
  $('inst-memory-label').textContent = gigabytes(i.memoryMb)
  if (i.id !== shownId) {
    shownId = i.id
    jvmIn.value = i.jvmArgs ?? ''
    void picker.set({ mcVersion: i.mcVersion, loader: i.loader, loaderVersion: 'loaderVersion' in i ? i.loaderVersion : '' })
  }
  syncApply()
}

export function initSettings() {
  onInstanceChange(render)

  renameIn.addEventListener('change', () => void update({ name: renameIn.value }))
  memoryIn.addEventListener('input', () => ($('inst-memory-label').textContent = gigabytes(Number(memoryIn.value))))
  memoryIn.addEventListener('change', () => void update({ memoryMb: Number(memoryIn.value) }))
  jvmIn.addEventListener('change', () => void update({ jvmArgs: jvmIn.value }, 'Arguments JVM enregistrés'))

  applyBtn.addEventListener('click', () => {
    const { mcVersion, loader, loaderVersion } = picker.value()
    applyBtn.disabled = true
    void update({ version: { mcVersion, loader, loaderVersion } }, `Version changée : Minecraft ${mcVersion}`)
  })

  deleteBtn.addEventListener('click', async () => {
    const i = getSelectedInstance()
    if (!i) return
    try {
      if (!(await window.launcher.deleteInstance(i.id))) return
      showTab('console')
      await refreshInstances(null)
      setStatus('Instance supprimée')
    } catch (e) {
      setStatus(`Erreur : ${errorText(e)}`)
    }
  })
}
