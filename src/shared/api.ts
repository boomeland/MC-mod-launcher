import type { Progress } from '../core/types'

export interface VersionInfo {
  id: string
  type: string
}

/** API exposée au renderer via le preload (window.launcher). */
export interface LauncherApi {
  listVersions(): Promise<{ latestRelease: string; versions: VersionInfo[] }>
  play(versionId: string, username: string): Promise<void>
  onProgress(cb: (p: Progress) => void): void
  onLog(cb: (line: string) => void): void
  onExit(cb: (code: number | null) => void): void
}
