import { ipcMain } from 'electron'
import type { ChildProcess } from 'node:child_process'
import { offlineAccount } from '../../core/auth'
import { installForge } from '../../core/forge'
import { installVersion } from '../../core/install'
import { buildLaunchCommand, spawnGame } from '../../core/launch'
import { loginWithRefreshToken } from '../../core/msa'
import type { Account, Progress } from '../../core/types'
import type { PlayOptions } from '../../shared/api'
import { loadAccount, saveAccount } from '../accounts'
import { MSA_CLIENT_ID, paths } from '../config'

let running = false

/** Compte Microsoft (token rafraîchi juste avant le lancement : il dure ~24 h) ou compte hors-ligne. */
async function resolveAccount(offlineName: string): Promise<Account> {
  const stored = await loadAccount()
  if (!stored) return offlineAccount(offlineName)
  const r = await loginWithRefreshToken(MSA_CLIENT_ID, stored.refreshToken)
  await saveAccount(r.account.name, r.account.uuid, r.refreshToken)
  return r.account
}

function forwardLogs(proc: ChildProcess, send: (line: string) => void) {
  const forward = (d: Buffer) => d.toString().split(/\r?\n/).filter(Boolean).forEach(send)
  proc.stdout!.on('data', forward)
  proc.stderr!.on('data', forward)
}

export function registerGameIpc() {
  ipcMain.handle('game:play', async (e, { mcVersion, forgeVersion, offlineName }: PlayOptions) => {
    if (running) throw new Error('Une partie est déjà en cours')
    running = true
    const send = (channel: string, payload: unknown) => e.sender.send(channel, payload)
    try {
      const onProgress = (p: Progress) => send('game:progress', p)
      // Forge : l'installer crée une version "<mc>-forge-<x>" qui hérite du vanilla.
      const versionId = forgeVersion
        ? await installForge(paths, mcVersion, forgeVersion, onProgress, (l) => send('game:log', `[forge] ${l}`))
        : mcVersion
      const { resolved, javaPath } = await installVersion(paths, versionId, onProgress)
      const account = await resolveAccount(offlineName)

      const proc = spawnGame(buildLaunchCommand(paths, resolved, { versionId, account, javaPath, gameDir: paths.root }))
      forwardLogs(proc, (line) => send('game:log', line))
      proc.on('exit', (code) => {
        running = false
        send('game:exit', code)
      })
    } catch (err) {
      running = false
      throw err
    }
  })
}
