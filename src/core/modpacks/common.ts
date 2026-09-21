// Outils partagés par les sources de modpacks (FTB, Modrinth). Séparés de index.ts pour éviter un import circulaire
// entre la table des sources et chaque source.
import type { LoaderChoice } from '../instances'
import { LOADERS } from '../loaders'
import { isModLoader } from '../types'

/** Taille d'une page de résultats de recherche. */
export const PAGE_SIZE = 30

/**
 * Seuls hôtes d'images acceptés pour les icônes et bannières de packs.
 * Doit rester aligné avec img-src dans la CSP du renderer (index.html).
 */
export const IMAGE_HOSTS = ['https://cdn.feed-the-beast.com/', 'https://cdn.modrinth.com/']
export const safeImage = (url: string | null | undefined) => (url && IMAGE_HOSTS.some((h) => url.startsWith(h)) ? url : undefined)

/** Minecraft ≤ 1.9 n'est pas géré pour les modpacks (assets « legacy », et avant 1.6 Forge n'a pas d'installer). */
export function isSupportedMc(mc: string): boolean {
  const [major, minor] = mc.split('.').map(Number)
  return major > 1 || minor >= 10
}

/**
 * Traduit une version de loader « courte » d'un modpack (Forge "47.4.20", Fabric "0.15.7") en version du launcher,
 * en la retrouvant dans la liste du loader : Forge et NeoForge 1.20.1 préfixent par le Minecraft
 * (les très vieux Forge ajoutent aussi un suffixe), NeoForge récent et Fabric non.
 */
export async function resolveLoaderVersion(loader: string, mcVersion: string, short: string): Promise<LoaderChoice> {
  if (!isModLoader(loader)) throw new Error(`Loader non pris en charge : ${loader}`)
  const prefixed = `${mcVersion}-${short}`
  const full = (await LOADERS[loader].listVersions(mcVersion)).versions.find(
    (x) => x === short || x === prefixed || x.startsWith(`${prefixed}-`)
  )
  if (!full) throw new Error(`${loader} ${short} introuvable pour Minecraft ${mcVersion}`)
  return { loader, loaderVersion: full }
}
