import { readFile } from 'node:fs/promises'
import { downloadFile, fetchJson } from './download'
import type { GamePaths } from './paths'
import type { VersionJson, VersionListEntry } from './types'

const MANIFEST_URL = 'https://piston-meta.mojang.com/mc/game/version_manifest_v2.json'

interface Manifest {
  latest: { release: string; snapshot: string }
  versions: (VersionListEntry & { sha1: string })[]
}

export async function fetchVersionList() {
  return fetchJson<Manifest>(MANIFEST_URL)
}

/** Charge le JSON d'une version (local si présent, sinon téléchargé depuis Mojang). */
export async function ensureVersionJson(paths: GamePaths, id: string): Promise<VersionJson> {
  const local = paths.versionJson(id)
  try {
    return JSON.parse(await readFile(local, 'utf8')) as VersionJson
  } catch {
    // pas en local → on cherche dans le manifest Mojang
  }
  const entry = (await fetchVersionList()).versions.find((v) => v.id === id)
  if (!entry) throw new Error(`Version inconnue : ${id}`)
  await downloadFile({ url: entry.url, dest: local, sha1: entry.sha1 })
  return JSON.parse(await readFile(local, 'utf8')) as VersionJson
}

export interface ResolvedVersion {
  /** JSON fusionné (enfant + parents via inheritsFrom). */
  json: VersionJson
  /** Id de la version dont on utilise le client.jar (le parent vanilla pour Forge/Fabric). */
  jarVersionId: string
}

function merge(parent: VersionJson, child: VersionJson): VersionJson {
  return {
    ...parent,
    ...child,
    libraries: [...child.libraries, ...parent.libraries],
    arguments: {
      game: [...(parent.arguments?.game ?? []), ...(child.arguments?.game ?? [])],
      jvm: [...(parent.arguments?.jvm ?? []), ...(child.arguments?.jvm ?? [])]
    },
    minecraftArguments: child.minecraftArguments ?? parent.minecraftArguments
  }
}

/** Résout la chaîne inheritsFrom — indispensable pour Forge/NeoForge/Fabric qui héritent du vanilla. */
export async function resolveVersion(paths: GamePaths, id: string): Promise<ResolvedVersion> {
  const json = await ensureVersionJson(paths, id)
  if (!json.inheritsFrom) return { json, jarVersionId: json.jar ?? id }
  const parent = await resolveVersion(paths, json.inheritsFrom)
  return {
    json: merge(parent.json, json),
    jarVersionId: json.jar ?? parent.jarVersionId
  }
}
