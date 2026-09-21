import { join } from 'node:path'
import { currentOs, rulesAllow } from './rules'
import type { Artifact, Library } from './types'

export interface ResolvedLibrary {
  /** group:artifact[:classifier] — sert à dédupliquer (l'enfant l'emporte sur le parent). */
  key: string
  artifact: Artifact & { path: string }
  /** Défini = archive de natives à extraire (ancien format) au lieu d'aller sur le classpath. */
  extract?: { exclude: string[] }
}

/** "g.r.o:name:1.0:cls" → chemin Maven "g/r/o/name/1.0/name-1.0-cls.jar" */
export function mavenPath(coords: string): string {
  const [group, name, version, classifier] = coords.split('@')[0].split(':')
  const file = `${name}-${version}${classifier ? `-${classifier}` : ''}.jar`
  return `${group.replaceAll('.', '/')}/${name}/${version}/${file}`
}

function keyOf(coords: string): string {
  const [g, a, , c] = coords.split(':')
  return c ? `${g}:${a}:${c}` : `${g}:${a}`
}

export function resolveLibraries(libs: Library[]): ResolvedLibrary[] {
  const out: ResolvedLibrary[] = []
  const seen = new Set<string>()

  for (const lib of libs) {
    if (!rulesAllow(lib.rules)) continue

    let resolved: ResolvedLibrary | null = null
    const classifier = lib.natives?.[currentOs()]?.replace('${arch}', process.arch === 'ia32' ? '32' : '64')

    if (classifier) {
      // ancien format : natives dans un classifier séparé, à extraire
      const art = lib.downloads?.classifiers?.[classifier]
      if (art?.path) {
        resolved = {
          key: `${keyOf(lib.name)}:${classifier}`,
          artifact: { ...art, path: art.path },
          extract: { exclude: lib.extract?.exclude ?? [] }
        }
      }
    } else if (lib.downloads?.artifact) {
      const art = lib.downloads.artifact
      resolved = { key: keyOf(lib.name), artifact: { ...art, path: art.path ?? mavenPath(lib.name) } }
    } else if (lib.downloads === undefined) {
      // format Forge/Fabric : juste un nom Maven et une URL de base
      const path = mavenPath(lib.name)
      const base = (lib.url ?? 'https://libraries.minecraft.net/').replace(/\/?$/, '/')
      resolved = { key: keyOf(lib.name), artifact: { url: base + path, path } }
    }

    if (!resolved || seen.has(resolved.key)) continue
    seen.add(resolved.key)
    out.push(resolved)
  }
  return out
}

export function libraryFile(librariesDir: string, lib: ResolvedLibrary): string {
  return join(librariesDir, ...lib.artifact.path.split('/'))
}
