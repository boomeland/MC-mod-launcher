// Une seule vue visible à la fois dans la zone principale ; la navigation de gauche suit.
import { $ } from './dom'

export type View = 'empty' | 'instance' | 'discover'
const VIEWS: View[] = ['empty', 'instance', 'discover']
let current: View = 'empty'

export const currentView = () => current

export function showView(view: View) {
  current = view
  for (const v of VIEWS) $(`view-${v}`).hidden = v !== view
  $('nav-library').classList.toggle('active', view !== 'discover')
  $('nav-discover').classList.toggle('active', view === 'discover')
}
