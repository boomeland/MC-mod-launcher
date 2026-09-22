// Boîte de dialogue « Nouvelle instance » : nom, version de Minecraft et loader (sélecteur partagé), RAM.
import { $ } from './dom'
import { LOADER_NAMES, refreshInstances } from './instances'
import { errorText, setStatus } from './status'
import { createVersionPicker } from './version-picker'

const dialog = $<HTMLDialogElement>('create-dialog')
const form = $<HTMLFormElement>('create-form')
const nameIn = $<HTMLInputElement>('new-name')
const memoryIn = $<HTMLInputElement>('new-memory')
const submitBtn = $<HTMLButtonElement>('create-submit')

let memoryTouched = false
const picker = createVersionPicker('', 'loader', () => (submitBtn.disabled = !picker.isReady()))

/** Le jeu modé a besoin de plus de mémoire, tant que l'utilisateur n'a pas choisi lui-même. */
function suggestMemory() {
  if (!memoryTouched) memoryIn.value = picker.value().loader === 'vanilla' ? '2048' : '4096'
}

export function initCreateForm() {
  $('new-instance').addEventListener('click', () => {
    form.reset()
    memoryTouched = false
    void picker.set()
    dialog.showModal()
    nameIn.focus()
  })
  $('create-cancel').addEventListener('click', () => dialog.close())
  $('loader-group').addEventListener('change', suggestMemory)
  memoryIn.addEventListener('input', () => (memoryTouched = true))

  form.addEventListener('submit', async (e) => {
    e.preventDefault()
    if (!picker.isReady()) return
    const { mcVersion, loader, loaderVersion } = picker.value()
    const base = { name: nameIn.value.trim() || `${mcVersion} ${LOADER_NAMES[loader]}`, mcVersion, memoryMb: Number(memoryIn.value) }
    submitBtn.disabled = true
    try {
      const instance = await window.launcher.createInstance(loader === 'vanilla' ? { ...base, loader } : { ...base, loader, loaderVersion })
      dialog.close()
      await refreshInstances(instance.id)
      setStatus(`Instance « ${instance.name} » créée`)
    } catch (err) {
      setStatus(`Erreur : ${errorText(err)}`)
    } finally {
      submitBtn.disabled = false
    }
  })
}
