import { app, safeStorage } from 'electron'
import { readFile, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

interface Stored {
  name: string
  uuid: string
  /** Refresh token chiffré (safeStorage), en base64. */
  token: string
}

const file = () => join(app.getPath('userData'), 'account.json')

export async function saveAccount(name: string, uuid: string, refreshToken: string): Promise<void> {
  // Jamais de refresh token en clair sur disque : sans chiffrement dispo, on ne persiste pas.
  if (!safeStorage.isEncryptionAvailable()) return
  const token = safeStorage.encryptString(refreshToken).toString('base64')
  await writeFile(file(), JSON.stringify({ name, uuid, token } satisfies Stored))
}

export async function loadAccount(): Promise<{ name: string; uuid: string; refreshToken: string } | null> {
  try {
    const s = JSON.parse(await readFile(file(), 'utf8')) as Stored
    return { name: s.name, uuid: s.uuid, refreshToken: safeStorage.decryptString(Buffer.from(s.token, 'base64')) }
  } catch {
    return null
  }
}

export async function clearAccount(): Promise<void> {
  await rm(file(), { force: true })
}
