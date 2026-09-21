import os from 'node:os'
import type { Rule } from './types'

export function currentOs(): 'windows' | 'osx' | 'linux' {
  switch (process.platform) {
    case 'win32': return 'windows'
    case 'darwin': return 'osx'
    default: return 'linux'
  }
}

function currentArch(): string {
  return process.arch === 'ia32' ? 'x86' : process.arch
}

/** Règles Mojang : la dernière règle qui matche gagne, défaut = interdit si des règles existent. */
export function rulesAllow(rules?: Rule[], features: Record<string, boolean> = {}): boolean {
  if (!rules || rules.length === 0) return true
  let allowed = false
  for (const r of rules) {
    if (r.os) {
      if (r.os.name && r.os.name !== currentOs()) continue
      if (r.os.arch && r.os.arch !== currentArch()) continue
      if (r.os.version && !new RegExp(r.os.version).test(os.release())) continue
    }
    if (r.features) {
      const ok = Object.entries(r.features).every(([k, v]) => (features[k] ?? false) === v)
      if (!ok) continue
    }
    allowed = r.action === 'allow'
  }
  return allowed
}
