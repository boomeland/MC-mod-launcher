import type { Account } from '../types'
import { minecraftLogin } from './minecraft'
import { pollDeviceLogin, refreshMsTokens, startDeviceLogin, type DeviceCode } from './oauth'

export { AuthError } from './errors'
export type { DeviceCode } from './oauth'

export interface LoginResult {
  account: Account
  /** À stocker (chiffré) pour se reconnecter sans redemander le code. Change à chaque refresh. */
  refreshToken: string
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
