// Un loader de mods sait lister ses versions pour un Minecraft donné et s'installer par-dessus le vanilla.
// Les appelants (IPC, CLI) ne connaissent que cette interface : ajouter un loader = une entrée dans LOADERS.
import type { GamePaths } from '../paths'
import type { ModLoader, ProgressFn } from '../types'
import { fabric } from './fabric'
import { forge } from './forge'
import { neoforge } from './neoforge'

export interface LoaderVersions {
  /** Versions du loader pour ce Minecraft, de la plus récente à la plus ancienne, sous leur forme Maven. */
  versions: string[]
  recommended?: string
  latest?: string
}

export interface Loader {
  listVersions(mcVersion: string): Promise<LoaderVersions>
  /** Installe le loader ; renvoie l'id de la version à lancer (dossier versions/<id>/, qui hérite du vanilla). */
  install(
    paths: GamePaths,
    mcVersion: string,
    loaderVersion: string,
    onProgress?: ProgressFn,
    onLog?: (line: string) => void
  ): Promise<string>
}

export const LOADERS: Record<ModLoader, Loader> = { forge, neoforge, fabric }
