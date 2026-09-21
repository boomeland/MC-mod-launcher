import type { LauncherApi } from '../shared/api'
import { initAccount } from './account'
import { initPlay } from './play'
import { initVersions } from './versions'

declare global {
  interface Window {
    launcher: LauncherApi
  }
}

initVersions()
initAccount()
initPlay()
