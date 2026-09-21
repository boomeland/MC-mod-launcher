import type { Account } from './types'

const UA = 'mc-mod-launcher/0.1'
const TENANT = 'https://login.microsoftonline.com/consumers/oauth2/v2.0'
const SCOPE = 'XboxLive.signin offline_access'

export class AuthError extends Error {}

export interface DeviceCode {
  deviceCode: string
  userCode: string
  verificationUri: string
  expiresIn: number
  interval: number
}

interface MsTokens {
  accessToken: string
  refreshToken: string
}

export interface LoginResult {
  account: Account
  /** À stocker (chiffré) pour se reconnecter sans redemander le code. Change à chaque refresh. */
  refreshToken: string
}

async function postForm<T>(url: string, body: Record<string, string>): Promise<{ ok: boolean; data: T }> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': UA },
    body: new URLSearchParams(body)
  })
  return { ok: res.ok, data: (await res.json()) as T }
}

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'User-Agent': UA },
    body: JSON.stringify(body)
  })
  const data = (await res.json().catch(() => ({}))) as T & { XErr?: number }
  if (!res.ok) throw new AuthError(explain(res.status, url, data))
  return data
}

const XERR: Record<number, string> = {
  2148916233: "Ce compte Microsoft n'a pas de profil Xbox (crée-en un sur xbox.com).",
  2148916235: "Xbox Live n'est pas disponible dans ton pays.",
  2148916238: 'Compte enfant : il doit être ajouté à une famille Microsoft par un adulte.'
}

function explain(status: number, url: string, data: { XErr?: number }): string {
  if (data.XErr && XERR[data.XErr]) return XERR[data.XErr]
  if (url.includes('login_with_xbox') && status === 403) {
    return "Mojang refuse cette app (403). L'app Azure doit être approuvée via le formulaire Minecraft API."
  }
  return `Échec d'authentification (${status}) sur ${new URL(url).host}`
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
async function pollDeviceLogin(clientId: string, dc: DeviceCode, signal?: AbortSignal): Promise<MsTokens> {
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

async function refreshMsTokens(clientId: string, refreshToken: string): Promise<MsTokens> {
  const { ok, data } = await postForm<Record<string, string>>(`${TENANT}/token`, {
    grant_type: 'refresh_token',
    client_id: clientId,
    refresh_token: refreshToken,
    scope: SCOPE
  })
  if (!ok) throw new AuthError('Session expirée, reconnecte-toi.')
  return { accessToken: data.access_token, refreshToken: data.refresh_token }
}

/** Xbox Live → XSTS → Minecraft Services → profil. */
async function minecraftLogin(msAccessToken: string): Promise<Account> {
  const xbl = await postJson<{ Token: string }>('https://user.auth.xboxlive.com/user/authenticate', {
    Properties: { AuthMethod: 'RPS', SiteName: 'user.auth.xboxlive.com', RpsTicket: `d=${msAccessToken}` },
    RelyingParty: 'http://auth.xboxlive.com',
    TokenType: 'JWT'
  })
  const xsts = await postJson<{ Token: string; DisplayClaims: { xui: { uhs: string }[] } }>(
    'https://xsts.auth.xboxlive.com/xsts/authorize',
    {
      Properties: { SandboxId: 'RETAIL', UserTokens: [xbl.Token] },
      RelyingParty: 'rp://api.minecraftservices.com/',
      TokenType: 'JWT'
    }
  )
  const mc = await postJson<{ access_token: string }>('https://api.minecraftservices.com/authentication/login_with_xbox', {
    identityToken: `XBL3.0 x=${xsts.DisplayClaims.xui[0].uhs};${xsts.Token}`
  })

  const res = await fetch('https://api.minecraftservices.com/minecraft/profile', {
    headers: { Authorization: `Bearer ${mc.access_token}`, 'User-Agent': UA }
  })
  if (res.status === 404) throw new AuthError("Ce compte Microsoft ne possède pas Minecraft Java Edition.")
  if (!res.ok) throw new AuthError(`Profil Minecraft indisponible (${res.status})`)
  const profile = (await res.json()) as { id: string; name: string }
  return { name: profile.name, uuid: profile.id, accessToken: mc.access_token, userType: 'msa' }
}

/** Connexion complète par code appareil. `onCode` reçoit le code à afficher à l'utilisateur. */
export async function loginWithDeviceCode(
  clientId: string,
  onCode: (dc: DeviceCode) => void,
  signal?: AbortSignal
): Promise<LoginResult> {
  const dc = await startDeviceLogin(clientId)
  onCode(dc)
  const tokens = await pollDeviceLogin(clientId, dc, signal)
  return { account: await minecraftLogin(tokens.accessToken), refreshToken: tokens.refreshToken }
}

/** Reconnexion silencieuse avec le refresh token stocké. */
export async function loginWithRefreshToken(clientId: string, refreshToken: string): Promise<LoginResult> {
  const tokens = await refreshMsTokens(clientId, refreshToken)
  return { account: await minecraftLogin(tokens.accessToken), refreshToken: tokens.refreshToken }
}
