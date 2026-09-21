import { chmod, mkdir, symlink } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { currentOs } from './rules'
import { downloadAll, fetchJson, type DownloadItem } from './download'
import type { GamePaths } from './paths'
import type { ProgressFn } from './types'

const RUNTIME_INDEX =
  'https://launchermeta.mojang.com/v1/products/java-runtime/2ec0cc96c44e5a76b9c8b7c39df7210883d12871/all.json'

interface RuntimeIndex {
  [platform: string]: Record<string, { manifest: { url: string; sha1: string; size: number } }[]>
}

interface RuntimeManifest {
  files: Record<
    string,
    {
      type: 'file' | 'directory' | 'link'
      executable?: boolean
      target?: string
      downloads?: { raw: { url: string; sha1: string; size: number } }
    }
  >
}

function runtimePlatform(): string {
  const arch = process.arch
  switch (currentOs()) {
    case 'windows': return arch === 'arm64' ? 'windows-arm64' : arch === 'ia32' ? 'windows-x86' : 'windows-x64'
    case 'osx': return arch === 'arm64' ? 'mac-os-arm64' : 'mac-os'
    default: return arch === 'ia32' ? 'linux-i386' : 'linux'
  }
}

function javaExecutable(dir: string): string {
  switch (currentOs()) {
    case 'windows': return join(dir, 'bin', 'java.exe')
    case 'osx': return join(dir, 'jre.bundle', 'Contents', 'Home', 'bin', 'java')
    default: return join(dir, 'bin', 'java')
  }
}

/**
 * Télécharge (si besoin) le JRE officiel Mojang requis par la version et renvoie le chemin de l'exécutable.
 * Retombe sur le `java` du PATH si Mojang ne fournit pas de runtime pour cette plateforme.
 */
export async function ensureJava(paths: GamePaths, component: string, onProgress?: ProgressFn): Promise<string> {
  const index = await fetchJson<RuntimeIndex>(RUNTIME_INDEX)
  const entry = index[runtimePlatform()]?.[component]?.[0]
  if (!entry) return 'java'

  const dir = join(paths.runtimes, component)
  const manifest = await fetchJson<RuntimeManifest>(entry.manifest.url)

  const items: DownloadItem[] = []
  const links: [string, string][] = []
  const executables: string[] = []
  for (const [rel, f] of Object.entries(manifest.files)) {
    const dest = join(dir, ...rel.split('/'))
    if (f.type === 'directory') await mkdir(dest, { recursive: true })
    else if (f.type === 'link' && f.target) links.push([dest, f.target])
    else if (f.downloads) {
      const { url, sha1, size } = f.downloads.raw
      items.push({ url, dest, sha1, size })
      if (f.executable) executables.push(dest)
    }
  }

  await downloadAll(items, `Java (${component})`, onProgress)

  if (currentOs() !== 'windows') {
    for (const exe of executables) await chmod(exe, 0o755)
    for (const [dest, target] of links) {
      await mkdir(dirname(dest), { recursive: true })
      await symlink(target, dest).catch(() => {}) // existe déjà
    }
  }
  return javaExecutable(dir)
}
