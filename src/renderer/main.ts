import type { LauncherApi } from '../shared/api'
import { initAccount } from './account'
import { initCreateForm } from './create'
import { initDiscover, openDiscover } from './discover'
import { $ } from './dom'
import { initInstances } from './instances'
import { initMods } from './mods'
import { initPlay } from './play'
import { initSettings } from './settings'

declare global {
  interface Window {
    launcher: LauncherApi
  }
}

// Mods et Réglages s'abonnent aux changements d'instance : à initialiser avant le premier rendu (initInstances).
initSettings()
initMods()
initInstances()
initCreateForm()
initDiscover()
initAccount()
initPlay()

// Vue vide : les deux façons de commencer.
$('empty-create').addEventListener('click', () => $('new-instance').click())
$('empty-discover').addEventListener('click', openDiscover)
