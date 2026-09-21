/** Versions publiées d'un artefact Maven, dans l'ordre du fichier (qui n'est pas garanti trié). */
export async function mavenVersions(artifactUrl: string): Promise<string[]> {
  const res = await fetch(`${artifactUrl}/maven-metadata.xml`)
  if (!res.ok) throw new Error(`HTTP ${res.status} sur ${artifactUrl}/maven-metadata.xml`)
  return [...(await res.text()).matchAll(/<version>([^<]+)<\/version>/g)].map((m) => m[1])
}
