import { withTimeout } from '../download'
import { AuthError, explain } from './errors'

export const UA = 'boomLauncher/0.1'

export function postForm<T>(url: string, body: Record<string, string>): Promise<{ ok: boolean; data: T }> {
  return withTimeout(url, async (signal) => {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': UA },
      body: new URLSearchParams(body),
      signal
    })
    return { ok: res.ok, data: (await res.json()) as T }
  })
}

/** POST JSON ; toute réponse non 2xx devient une AuthError au message explicite. */
export function postJson<T>(url: string, body: unknown): Promise<T> {
  return withTimeout(url, async (signal) => {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'User-Agent': UA },
      body: JSON.stringify(body),
      signal
    })
    const data = (await res.json().catch(() => ({}))) as T & { XErr?: number }
    if (!res.ok) throw new AuthError(explain(res.status, url, data))
    return data
  })
}
