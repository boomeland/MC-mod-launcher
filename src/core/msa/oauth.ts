// OAuth Microsoft : device code flow (client public, sans secret ni redirect URI).
import { AuthError } from './errors'
import { postForm } from './http'

const TENANT = 'https://login.microsoftonline.com/consumers/oauth2/v2.0'
const SCOPE = 'XboxLive.signin offline_access'

export interface DeviceCode {
  deviceCode: string
  userCode: string
  verificationUri: string
  expiresIn: number
  interval: number
}

export interface MsTokens {
  accessToken: string
  refreshToken: string
}

/** Étape 1 : demande un code que l'utilisateur saisit sur microsoft.com/link. */
export async function startDeviceLogin(clientId: string): Promise<DeviceCode> {
  if (!clientId) throw new AuthError('client_id Microsoft manquant (voir .env.example).')
  const { ok, data } = await postForm<Record<string, string | number>>(`${TENANT}/devicecode`, {
    client_id: clientId,
    scope: SCOPE
  })
  if (!ok) throw new AuthError(`Demande de code refusée : ${data.error_description ?? data.error}`)
  return {
    deviceCode: String(data.device_code),
    userCode: String(data.user_code),
    verificationUri: String(data.verification_uri),
    expiresIn: Number(data.expires_in),
    interval: Number(data.interval)
  }
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(new AuthError('Connexion annulée'))
    const t = setTimeout(resolve, ms)
    signal?.addEventListener('abort', () => { clearTimeout(t); reject(new AuthError('Connexion annulée')) }, { once: true })
  })
}

/** Étape 2 : attend que l'utilisateur ait validé le code. */
export async function pollDeviceLogin(clientId: string, dc: DeviceCode, signal?: AbortSignal): Promise<MsTokens> {
  let interval = dc.interval * 1000
  const deadline = Date.now() + dc.expiresIn * 1000
  while (Date.now() < deadline) {
    await sleep(interval, signal)
    const { ok, data } = await postForm<Record<string, string>>(`${TENANT}/token`, {
      grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
      client_id: clientId,
      device_code: dc.deviceCode
    })
    if (ok) return { accessToken: data.access_token, refreshToken: data.refresh_token }
    if (data.error === 'authorization_pending') continue
    if (data.error === 'slow_down') { interval += 5000; continue }
    throw new AuthError(data.error === 'authorization_declined' ? 'Connexion refusée' : `Erreur Microsoft : ${data.error}`)
  }
  throw new AuthError('Code expiré, recommence.')
}

export async function refreshMsTokens(clientId: string, refreshToken: string): Promise<MsTokens> {
  const { ok, data } = await postForm<Record<string, string>>(`${TENANT}/token`, {
    grant_type: 'refresh_token',
    client_id: clientId,
    refresh_token: refreshToken,
    scope: SCOPE
  })
  if (!ok) throw new AuthError('Session expirée, reconnecte-toi.')
  return { accessToken: data.access_token, refreshToken: data.refresh_token }
}
