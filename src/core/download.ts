import { createHash } from 'node:crypto'
import { createReadStream, createWriteStream } from 'node:fs'
import { mkdir, rename, stat, unlink } from 'node:fs/promises'
import { dirname } from 'node:path'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import type { ProgressFn } from './types'

const UA = 'mc-mod-launcher/0.1'

export async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { headers: { 'User-Agent': UA } })
  if (!res.ok) throw new Error(`HTTP ${res.status} sur ${url}`)
  return (await res.json()) as T
}

function sha1File(path: string): Promise<string> {
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
      const res = await fetch(item.url, { headers: { 'User-Agent': UA } })
      if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`)
      await pipeline(Readable.fromWeb(res.body as never), createWriteStream(tmp))
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
