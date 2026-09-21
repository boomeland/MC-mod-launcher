import type { Instance, NewInstance } from '../core/instances'
import type { LoaderVersions } from '../core/loaders'
import type { FtbPack } from '../core/modpacks/ftb'
import type { ModLoader, Progress } from '../core/types'

export interface VersionInfo {
  id: string
  type: string
}

export interface LoginCode {
  userCode: string
  verificationUri: string
}

export interface PlayOptions {
  instanceId: string
  /** N'est utilisé que si aucun compte Microsoft n'est connecté. */
  offlineName: string
}

/** API exposée au renderer via le preload (window.launcher). */
export interface LauncherApi {
  listVersions(): Promise<{ latestRelease: string; versions: VersionInfo[] }>
  listLoaderVersions(loader: ModLoader, mcVersion: string): Promise<LoaderVersions>
  listInstances(): Promise<Instance[]>
  createInstance(input: NewInstance): Promise<Instance>
  updateInstance(id: string, patch: { name?: string; memoryMb?: number }): Promise<Instance>
  /** Demande confirmation (boîte native) puis supprime l'instance et son dossier de jeu ; false si annulé. */
  deleteInstance(id: string): Promise<boolean>
  openInstanceFolder(id: string): Promise<void>
  listFtbPacks(): Promise<FtbPack[]>
  /** Crée l'instance et y télécharge les fichiers du pack (progression via onProgress). */
  installFtbPack(packId: number, versionId: number, memoryMb: number): Promise<Instance>
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
