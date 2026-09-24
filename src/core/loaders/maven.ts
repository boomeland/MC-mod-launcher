import { withTimeout } from '../download'

/** Versions publiées d'un artefact Maven, dans l'ordre du fichier (qui n'est pas garanti trié). */
export function mavenVersions(artifactUrl: string): Promise<string[]> {
  const url = `${artifactUrl}/maven-metadata.xml`
  return withTimeout(url, async (signal) => {
    const res = await fetch(url, { signal })
    if (!res.ok) throw new Error(`HTTP ${res.status} sur ${url}`)
    return [...(await res.text()).matchAll(/<version>([^<]+)<\/version>/g)].map((m) => m[1])
  })
}
