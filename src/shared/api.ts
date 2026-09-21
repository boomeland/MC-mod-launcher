import type { Progress } from '../core/types'

export interface VersionInfo {
  id: string
  type: string
}

export interface LoginCode {
  userCode: string
  verificationUri: string
}

/** API exposée au renderer via le preload (window.launcher). */
export interface LauncherApi {
  listVersions(): Promise<{ latestRelease: string; versions: VersionInfo[] }>
  /** `offlineName` n'est utilisé que si aucun compte Microsoft n'est connecté. */
  play(versionId: string, offlineName: string): Promise<void>
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
