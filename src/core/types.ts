export interface Rule {
  action: 'allow' | 'disallow'
  os?: { name?: string; arch?: string; version?: string }
  features?: Record<string, boolean>
}

export interface Artifact {
  path?: string
  url: string
  sha1?: string
  size?: number
}

export interface Library {
  name: string
  url?: string
  downloads?: {
    artifact?: Artifact
    classifiers?: Record<string, Artifact>
  }
  natives?: Record<string, string>
  extract?: { exclude?: string[] }
  rules?: Rule[]
}

export type Argument = string | { rules?: Rule[]; value: string | string[] }

export interface VersionJson {
  id: string
  type?: string
  inheritsFrom?: string
  jar?: string
  mainClass: string
  minecraftArguments?: string
  arguments?: { game?: Argument[]; jvm?: Argument[] }
  libraries: Library[]
  assets?: string
  assetIndex?: { id: string; url: string; sha1: string; size: number }
  downloads?: { client?: Artifact }
  javaVersion?: { component: string; majorVersion: number }
  logging?: { client?: { argument: string; file: { id: string; url: string; sha1: string } } }
}

export interface VersionListEntry {
  id: string
  type: 'release' | 'snapshot' | 'old_beta' | 'old_alpha'
  url: string
  releaseTime: string
}

export interface Progress {
  stage: string
  done: number
  total: number
}

export type ProgressFn = (p: Progress) => void

/** Loaders de mods gérés. Vanilla n'en fait pas partie : il n'a ni versions propres ni installation en plus. */
export const MOD_LOADERS = ['forge', 'neoforge', 'fabric'] as const
export type ModLoader = (typeof MOD_LOADERS)[number]

/** Garde pour les entrées non fiables (IPC, fichiers) avant d'indexer LOADERS avec. */
export const isModLoader = (x: unknown): x is ModLoader => (MOD_LOADERS as readonly unknown[]).includes(x)

export interface Account {
  name: string
  uuid: string
  accessToken: string
  userType: 'msa' | 'legacy'
}
