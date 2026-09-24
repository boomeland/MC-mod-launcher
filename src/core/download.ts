import { createHash } from 'node:crypto'
import { createReadStream, createWriteStream } from 'node:fs'
import { mkdir, rename, stat, unlink } from 'node:fs/promises'
import { dirname } from 'node:path'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import type { ProgressFn } from './types'

// Modrinth exige un User-Agent qui identifie le projet (sinon il peut limiter ou bloquer les requêtes).
const UA = 'boomeland/boomLauncher (github.com/boomeland/boomLauncher)'

// Sans délai à nous, Node attend 5 min un serveur muet, et downloadFile réessaie 3 fois : « Préparation… » restait
// figé un quart d'heure, sans erreur ni moyen de relancer. 30 s de silence suffisent à conclure.
export const TIMEOUT_MS = 30_000

/**
 * Exécute une requête et l'abandonne après TIMEOUT_MS sans signe de vie du serveur. `alive` relance le délai :
 * un téléchargement l'appelle à chaque morceau reçu, pour couper un serveur muet et pas un gros fichier sur une
 * connexion lente. Sans appel à `alive` (petites réponses JSON), c'est un délai total.
 */
export async function withTimeout<T>(url: string, run: (signal: AbortSignal, alive: () => void) => Promise<T>): Promise<T> {
  const ctrl = new AbortController()
  let timer: ReturnType<typeof setTimeout> | undefined
  const alive = () => {
    clearTimeout(timer)
    timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS)
  }
  alive()
  try {
    return await run(ctrl.signal, alive)
  } catch (e) {
    // L'erreur d'annulation de Node est en anglais et ne nomme pas le serveur.
    if (ctrl.signal.aborted) throw new Error(`pas de réponse de ${new URL(url).host} depuis ${TIMEOUT_MS / 1000} s`)
    throw e
  } finally {
    clearTimeout(timer)
  }
}

export function fetchJson<T>(url: string): Promise<T> {
  return withTimeout(url, async (signal) => {
    const res = await fetch(url, { headers: { 'User-Agent': UA }, signal })
    if (!res.ok) throw new Error(`HTTP ${res.status} sur ${url}`)
    return (await res.json()) as T
  })
}

export function postJson<T>(url: string, body: unknown): Promise<T> {
  return withTimeout(url, async (signal) => {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'User-Agent': UA, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal
    })
    if (!res.ok) throw new Error(`HTTP ${res.status} sur ${url}`)
    return (await res.json()) as T
  })
}

export function sha1File(path: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const h = createHash('sha1')
    createReadStream(path).on('data', (d) => h.update(d)).on('end', () => resolve(h.digest('hex'))).on('error', reject)
  })
}

async function isValid(dest: string, sha1?: string, size?: number): Promise<boolean> {
  try {
    const s = await stat(dest)
    if (size !== undefined && s.size !== size) return false
    if (sha1) return (await sha1File(dest)) === sha1
    return s.size > 0
  } catch {
    return false
  }
}

export interface DownloadItem {
  url: string
  dest: string
  sha1?: string
  size?: number
}

export async function downloadFile(item: DownloadItem, retries = 3): Promise<void> {
  if (await isValid(item.dest, item.sha1, item.size)) return
  await mkdir(dirname(item.dest), { recursive: true })
  const tmp = `${item.dest}.part`
  let lastErr: unknown
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      await withTimeout(item.url, async (signal, alive) => {
        const res = await fetch(item.url, { headers: { 'User-Agent': UA }, signal })
        if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`)
        await pipeline(
          Readable.fromWeb(res.body as never),
          async function* (chunks: AsyncIterable<Buffer>) {
            for await (const chunk of chunks) {
              alive()
              yield chunk
            }
          },
          createWriteStream(tmp)
        )
      })
      if (item.sha1 && (await sha1File(tmp)) !== item.sha1) throw new Error('SHA1 invalide')
      await rename(tmp, item.dest)
      return
    } catch (e) {
      lastErr = e
      await unlink(tmp).catch(() => {})
    }
  }
  throw new Error(`Échec du téléchargement de ${item.url} : ${(lastErr as Error).message}`)
}

/** Télécharge une liste de fichiers avec une concurrence limitée. */
export async function downloadAll(
  items: DownloadItem[],
  stage: string,
  onProgress?: ProgressFn,
  concurrency = 16
): Promise<void> {
  let done = 0
  let next = 0
  onProgress?.({ stage, done, total: items.length })
  const worker = async () => {
    while (next < items.length) {
      const item = items[next++]
      await downloadFile(item)
      onProgress?.({ stage, done: ++done, total: items.length })
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker))
}
