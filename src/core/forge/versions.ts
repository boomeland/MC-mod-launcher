import { fetchJson } from '../download'

export const MAVEN = 'https://maven.minecraftforge.net/net/minecraftforge/forge'
const PROMOS = 'https://files.minecraftforge.net/net/minecraftforge/forge/promotions_slim.json'

export interface ForgeVersions {
  /** Versions Forge pour ce Minecraft, de la plus récente à la plus ancienne (forme complète Maven : "1.20.1-47.3.0"). */
  versions: string[]
  recommended?: string
  latest?: string
}

export async function listForgeVersions(mcVersion: string): Promise<ForgeVersions> {
  const [xml, promos] = await Promise.all([
    fetch(`${MAVEN}/maven-metadata.xml`).then((r) => {
      if (!r.ok) throw new Error(`HTTP ${r.status} sur maven-metadata.xml`)
      return r.text()
    }),
    fetchJson<{ promos: Record<string, string> }>(PROMOS)
  ])

  const versions = [...xml.matchAll(/<version>([^<]+)<\/version>/g)]
    .map((m) => m[1])
    .filter((v) => v.startsWith(`${mcVersion}-`))
    .reverse() // le metadata est du plus ancien au plus récent

  // Les promos donnent "47.3.0" ; on retrouve la forme complète (les très vieilles versions ont un suffixe).
  const resolve = (short?: string) => (short ? versions.find((v) => v.startsWith(`${mcVersion}-${short}`)) : undefined)
  return {
    versions,
    recommended: resolve(promos.promos[`${mcVersion}-recommended`]),
    latest: resolve(promos.promos[`${mcVersion}-latest`])
  }
}
