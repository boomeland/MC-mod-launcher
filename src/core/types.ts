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

export interface Account {
  name: string
  uuid: string
  accessToken: string
  userType: 'msa' | 'legacy'
}
