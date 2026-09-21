import { join, resolve, sep } from 'node:path'

/**
 * Chemin sous `root`, en refusant tout ce qui en sortirait ("../", chemin absolu, nom vide).
 * À utiliser pour tout chemin venu de l'extérieur : IPC, fichiers d'un modpack, contenu d'une archive.
 */
export function insideDir(root: string, ...parts: string[]): string {
  const base = resolve(root)
  const target = resolve(base, ...parts)
  if (!target.startsWith(base + sep)) throw new Error(`Chemin refusé (hors du dossier) : ${parts.join('/')}`)
  return target
}

/** Dossiers d'une instance/installation Minecraft. Tout est relatif à `root`. */
export function gamePaths(root: string) {
  return {
    root,
    versions: join(root, 'versions'),
    libraries: join(root, 'libraries'),
    assets: join(root, 'assets'),
    runtimes: join(root, 'runtime'),
    versionDir: (id: string) => join(root, 'versions', id),
    versionJson: (id: string) => join(root, 'versions', id, `${id}.json`),
    versionJar: (id: string) => join(root, 'versions', id, `${id}.jar`),
    nativesDir: (id: string) => join(root, 'versions', id, 'natives')
  }
}

export type GamePaths = ReturnType<typeof gamePaths>
