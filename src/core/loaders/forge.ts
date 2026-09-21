// Forge : versions Maven de la forme "1.20.1-47.3.0" (préfixées par le Minecraft visé).
import { fetchJson } from '../download'
import type { Loader } from '.'
import { installWithInstaller } from './installer'
import { mavenVersions } from './maven'

export const FORGE_MAVEN = 'https://maven.minecraftforge.net/net/minecraftforge/forge'
const PROMOS = 'https://files.minecraftforge.net/net/minecraftforge/forge/promotions_slim.json'

export const forge: Loader = {
  async listVersions(mcVersion) {
    const [all, promos] = await Promise.all([
      mavenVersions(FORGE_MAVEN),
      fetchJson<{ promos: Record<string, string> }>(PROMOS)
    ])
    const versions = all.filter((v) => v.startsWith(`${mcVersion}-`)).reverse() // le metadata Forge va du plus ancien au plus récent

    // Les promos donnent "47.3.0" ; on retrouve la forme complète (les très vieilles versions ont un suffixe).
    const resolve = (short?: string) => (short ? versions.find((v) => v.startsWith(`${mcVersion}-${short}`)) : undefined)
    return {
      versions,
      recommended: resolve(promos.promos[`${mcVersion}-recommended`]),
      latest: resolve(promos.promos[`${mcVersion}-latest`])
    }
  },

  install: (paths, mcVersion, v, onProgress, onLog) =>
    installWithInstaller(paths, mcVersion, `${FORGE_MAVEN}/${v}/forge-${v}-installer.jar`, `Forge ${v}`, onProgress, onLog)
}
