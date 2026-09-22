import { app, safeStorage } from 'electron'
import { access, readFile, rm, writeFile } from 'node:fs/promises'
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

// Le mode hors-ligne n'est offert qu'à qui a prouvé une fois posséder Minecraft (connexion réussie : sans le jeu,
// Minecraft Services renvoie 404 et la connexion échoue), comme le launcher officiel : un launcher qui fait jouer
// sans compte est refusé par Mojang. La marque survit à la déconnexion. Elle se falsifie en créant le fichier :
// elle ne protège de rien, elle évite seulement de proposer le jeu à qui ne l'a pas acheté.
const ownerFile = () => join(app.getPath('userData'), 'owner-verified')

export async function markOwnershipVerified(): Promise<void> {
  await writeFile(ownerFile(), '')
}

export async function offlineAllowed(): Promise<boolean> {
  // En dev, tous les tests passent par le hors-ligne tant que Mojang n'a pas approuvé l'app (403 à la connexion).
  if (!app.isPackaged) return true
  return access(ownerFile()).then(
    () => true,
    () => false
  )
}
