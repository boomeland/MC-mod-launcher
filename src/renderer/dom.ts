import type { Instance } from '../core/instances'

export const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T

/** Crée un élément, lui applique des propriétés et ses enfants : évite les suites de createElement/append. */
export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: Partial<HTMLElementTagNameMap[K]> = {},
  ...children: (Node | string)[]
): HTMLElementTagNameMap[K] {
  const node = Object.assign(document.createElement(tag), props)
  node.append(...children)
  return node
}

/** "FTB StoneBlock 4" → "FS" ; sert de tuile quand il n'y a pas d'icône. */
const initials = (name: string) =>
  name
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('') || '?'

/** Tuile d'une instance ou d'un pack : son icône si elle existe, sinon un dégradé à la couleur du loader. */
export function tile(name: string, loader: Instance['loader'] | string, icon: string | undefined, size = ''): HTMLElement {
  const cls = `tile ${size}`
  return icon ? el('img', { className: cls, src: icon, alt: '', loading: 'lazy' }) : el('div', { className: `${cls} tile-${loader}` }, initials(name))
}
