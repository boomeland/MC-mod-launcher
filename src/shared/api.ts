import type { ForgeVersions } from '../core/forge'
import type { Progress } from '../core/types'

export interface VersionInfo {
  id: string
  type: string
}

export interface LoginCode {
  userCode: string
  verificationUri: string
}

export interface PlayOptions {
  /** Version de Minecraft (ex. "1.20.1"). */
  mcVersion: string
  /** Version Forge complète ("1.20.1-47.3.0") ; absent = vanilla. */
  forgeVersion?: string
  /** N'est utilisé que si aucun compte Microsoft n'est connecté. */
  offlineName: string
}

/** API exposée au renderer via le preload (window.launcher). */
export interface LauncherApi {
  listVersions(): Promise<{ latestRelease: string; versions: VersionInfo[] }>
  listForgeVersions(mcVersion: string): Promise<ForgeVersions>
  play(opts: PlayOptions): Promise<void>
  onProgress(cb: (p: Progress) => void): void
  onLog(cb: (line: string) => void): void
  onExit(cb: (code: number | null) => void): void

  /** Pseudo du compte Microsoft connecté, ou null. */
  getAccount(): Promise<string | null>
  /** Lance la connexion ; résout avec le pseudo une fois validée dans le navigateur. */
  login(): Promise<string>
  cancelLogin(): void
  logout(): Promise<void>
  onLoginCode(cb: (c: LoginCode) => void): void
}
