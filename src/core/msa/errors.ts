export class AuthError extends Error {}

/** Codes XErr renvoyés par XSTS → message compréhensible. */
const XERR: Record<number, string> = {
  2148916233: "Ce compte Microsoft n'a pas de profil Xbox (crée-en un sur xbox.com).",
  2148916235: "Xbox Live n'est pas disponible dans ton pays.",
  2148916238: 'Compte enfant : il doit être ajouté à une famille Microsoft par un adulte.'
}

export function explain(status: number, url: string, data: { XErr?: number }): string {
  if (data.XErr && XERR[data.XErr]) return XERR[data.XErr]
  if (url.includes('login_with_xbox') && status === 403) {
    return "Mojang refuse cette app (403). L'app Azure doit être approuvée via le formulaire Minecraft API."
  }
  return `Échec d'authentification (${status}) sur ${new URL(url).host}`
}
