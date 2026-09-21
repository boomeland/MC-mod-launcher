import type { LauncherApi } from '../shared/api'
import { initAccount } from './account'
import { initCreateForm } from './create'
import { $ } from './dom'
import { initFtb, openDiscover } from './ftb'
import { initInstances } from './instances'
import { initPlay } from './play'

declare global {
  interface Window {
    launcher: LauncherApi
  }
}

initInstances()
initCreateForm()
initFtb()
initAccount()
initPlay()

// Vue vide : les deux façons de commencer.
$('empty-create').addEventListener('click', () => $('new-instance').click())
$('empty-discover').addEventListener('click', () => void openDiscover())
