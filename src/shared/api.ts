import type { Instance, InstancePatch, NewInstance } from '../core/instances'
import type { LoaderVersions } from '../core/loaders'
import type { PackDetail, PackSourceId, PackSummary } from '../core/modpacks'
import type { ModHit, ModIdentity, ModUpdate } from '../core/modrinth-mods'
import type { LocalMod } from '../core/mods'
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
  /** N'est utilisé que si aucun compte Microsoft n'est connecté, et refusé tant que offlineAllowed() est faux. */
  offlineName: string
}

/** API exposée au renderer via le preload (window.launcher). */
export interface LauncherApi {
  listVersions(): Promise<{ latestRelease: string; versions: VersionInfo[] }>
  listLoaderVersions(loader: ModLoader, mcVersion: string): Promise<LoaderVersions>
  listInstances(): Promise<Instance[]>
  createInstance(input: NewInstance): Promise<Instance>
  updateInstance(id: string, patch: InstancePatch): Promise<Instance>
  /** Demande confirmation (boîte native) puis supprime l'instance et son dossier de jeu ; false si annulé. */
  deleteInstance(id: string): Promise<boolean>
  openInstanceFolder(id: string): Promise<void>

  searchPacks(source: PackSourceId, query: string, loader: string, offset: number): Promise<{ hits: PackSummary[]; total: number }>
  getPack(source: PackSourceId, id: string): Promise<PackDetail>
  /** Crée l'instance et y installe le pack (progression via onProgress). */
  installPack(source: PackSourceId, packId: string, versionId: string, memoryMb: number): Promise<Instance>

  listMods(instanceId: string): Promise<LocalMod[]>
  /** Mods reconnus sur Modrinth (par SHA1), indexés par nom de fichier. */
  identifyMods(instanceId: string, files: string[]): Promise<Record<string, ModIdentity>>
  /** Renvoie le nouveau nom du fichier. */
  setModEnabled(instanceId: string, file: string, enabled: boolean): Promise<string>
  deleteMod(instanceId: string, file: string): Promise<void>
  /** Sans `files`, ouvre le sélecteur de fichiers ; renvoie les noms ajoutés. */
  addMods(instanceId: string, files?: string[]): Promise<string[]>
  /** Chemin d'un fichier glissé-déposé (inaccessible directement depuis la page, sandboxée). */
  pathForFile(file: File): string
  searchMods(instanceId: string, query: string, offset: number): Promise<{ hits: ModHit[]; total: number }>
  /** Installe un mod Modrinth et ses dépendances obligatoires ; renvoie les fichiers ajoutés. */
  installMod(instanceId: string, projectId: string): Promise<string[]>
  checkModUpdates(instanceId: string): Promise<ModUpdate[]>
  updateMod(instanceId: string, file: string, versionId: string): Promise<string>

  /** downloading : téléchargement en cours ; ready : prête, à installer ; available : version portable, à télécharger à la main. */
  onUpdate(cb: (u: { state: 'downloading' | 'ready' | 'available'; version: string }) => void): void
  /** Ferme le launcher, installe la mise à jour téléchargée et le relance. */
  installUpdate(): Promise<void>
  openReleasePage(): Promise<void>

  play(opts: PlayOptions): Promise<void>
  onProgress(cb: (p: Progress) => void): void
  onLog(cb: (line: string) => void): void
  onExit(cb: (code: number | null) => void): void

  /** Pseudo du compte Microsoft connecté, ou null. */
  getAccount(): Promise<string | null>
  /** Faux tant qu'aucune connexion n'a prouvé que le joueur possède Minecraft (toujours vrai en dev). */
  offlineAllowed(): Promise<boolean>
  /** Lance la connexion ; résout avec le pseudo une fois validée dans le navigateur. */
  login(): Promise<string>
  cancelLogin(): void
  logout(): Promise<void>
  onLoginCode(cb: (c: LoginCode) => void): void
}
