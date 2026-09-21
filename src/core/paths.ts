import { join } from 'node:path'

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
