import { createHash } from 'node:crypto'
import type { Account } from './types'

/** UUID "offline" identique à celui que génère un serveur en offline-mode (UUID v3 de "OfflinePlayer:<nom>"). */
export function offlineAccount(name: string): Account {
  const b = createHash('md5').update(`OfflinePlayer:${name}`).digest()
  b[6] = (b[6] & 0x0f) | 0x30
  b[8] = (b[8] & 0x3f) | 0x80
  const h = b.toString('hex')
  const uuid = `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`
  return { name, uuid, accessToken: '0', userType: 'legacy' }
}
