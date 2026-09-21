// NeoForge : même installer que Forge, mais un versionnage propre, sans le Minecraft en préfixe.
// Exception : pour 1.20.1 (le fork venait d'avoir lieu), NeoForge publiait encore sous l'artefact « forge »,
// avec des versions à la Forge ("1.20.1-47.1.84"). Des modpacks FTB en dépendent.
import type { Loader, LoaderVersions } from '.'
import { FORGE_MAVEN } from './forge'
import { installWithInstaller } from './installer'
import { mavenVersions } from './maven'

const MAVEN = 'https://maven.neoforged.net/releases/net/neoforged/neoforge'
const MAVEN_1_20_1 = 'https://maven.neoforged.net/releases/net/neoforged/forge'

/** Tri décroissant composante par composante ("21.1.251" > "21.1.99" ; le suffixe "-beta" est ignoré). */
function newestFirst(a: string, b: string): number {
  const x = a.split('.').map((p) => parseInt(p, 10))
  const y = b.split('.').map((p) => parseInt(p, 10))
  for (let i = 0; i < Math.max(x.length, y.length); i++) {
    if ((x[i] ?? 0) !== (y[i] ?? 0)) return (y[i] ?? 0) - (x[i] ?? 0)
  }
  return 0
}

/**
 * Versions NeoForge compatibles avec un Minecraft, parmi toutes celles du Maven.
 * NeoForge reprend le Minecraft sans son "1." initial ("1.21.1" → "21.1.x", "1.21" → "21.0.x") ;
 * depuis le versionnage par année de Mojang, il garde trois composantes ("26.1" → "26.1.0.x").
 * NeoForge n'a pas de promotions : la "recommandée" est la plus récente hors bêta.
 */
export function neoforgeVersionsFor(mcVersion: string, all: string[]): LoaderVersions {
  const parts = mcVersion.split('.')
  const legacy = parts[0] === '1'
  const base = legacy ? parts.slice(1) : parts
  while (base.length < (legacy ? 2 : 3)) base.push('0')
  const prefix = `${base.join('.')}.`

  const versions = all.filter((v) => v.startsWith(prefix)).sort(newestFirst)
  return { versions, recommended: versions.find((v) => !v.includes('beta')), latest: versions[0] }
}

export const neoforge: Loader = {
  async listVersions(mcVersion) {
    if (mcVersion !== '1.20.1') return neoforgeVersionsFor(mcVersion, await mavenVersions(MAVEN))
    // 9 numéros existent aussi chez Forge : même nom d'installer ET même id de version (versions/1.20.1-forge-47.1.x/),
    // pour un contenu différent. On les écarte, sinon une instance Forge et une NeoForge se partageraient ce dossier.
    const [all, forgeAll] = await Promise.all([mavenVersions(MAVEN_1_20_1), mavenVersions(FORGE_MAVEN)])
    const forgeSet = new Set(forgeAll)
    const versions = all
      .filter((v) => v.startsWith('1.20.1-') && !forgeSet.has(v))
      .sort((a, b) => newestFirst(a.slice('1.20.1-'.length), b.slice('1.20.1-'.length)))
    return { versions, recommended: versions[0], latest: versions[0] }
  },

  install: (paths, mcVersion, v, onProgress, onLog) => {
    const url = v.startsWith('1.20.1-')
      ? `${MAVEN_1_20_1}/${v}/forge-${v}-installer.jar`
      : `${MAVEN}/${v}/neoforge-${v}-installer.jar`
    return installWithInstaller(paths, mcVersion, url, `NeoForge ${v}`, onProgress, onLog)
  }
}
