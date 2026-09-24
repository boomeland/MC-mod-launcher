// Token Microsoft → Xbox Live → XSTS → Minecraft Services → profil.
import { withTimeout } from '../download'
import type { Account } from '../types'
import { AuthError } from './errors'
import { postJson, UA } from './http'

export async function minecraftLogin(msAccessToken: string): Promise<Account> {
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

  const profileUrl = 'https://api.minecraftservices.com/minecraft/profile'
  const profile = await withTimeout(profileUrl, async (signal) => {
    const res = await fetch(profileUrl, { headers: { Authorization: `Bearer ${mc.access_token}`, 'User-Agent': UA }, signal })
    if (res.status === 404) throw new AuthError('Ce compte Microsoft ne possède pas Minecraft Java Edition.')
    if (!res.ok) throw new AuthError(`Profil Minecraft indisponible (${res.status})`)
    return (await res.json()) as { id: string; name: string }
  })
  return { name: profile.name, uuid: profile.id, accessToken: mc.access_token, userType: 'msa' }
}
