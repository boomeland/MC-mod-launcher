// Fabric : pas d'installer à lancer. Son API sert directement un JSON de version qui hérite du vanilla
// (librairies au format « nom Maven + URL de base », déjà géré par resolveLibraries).
import { downloadFile, fetchJson } from '../download'
import type { Loader } from '.'

const META = 'https://meta.fabricmc.net/v2/versions/loader'

export const fabric: Loader = {
  async listVersions(mcVersion) {
    // Déjà du plus récent au plus ancien ; liste vide si Fabric ne gère pas ce Minecraft.
    const list = await fetchJson<{ loader: { version: string; stable: boolean } }[]>(`${META}/${mcVersion}`)
    const versions = list.map((x) => x.loader.version)
    return { versions, recommended: list.find((x) => x.loader.stable)?.loader.version, latest: versions[0] }
  },

  async install(paths, mcVersion, v) {
    const id = `fabric-loader-${v}-${mcVersion}`
    await downloadFile({ url: `${META}/${mcVersion}/${v}/profile/json`, dest: paths.versionJson(id) })
    return id
  }
}
