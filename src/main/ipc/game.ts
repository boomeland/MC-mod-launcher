import { ipcMain } from 'electron'
import type { ChildProcess } from 'node:child_process'
import { mkdir } from 'node:fs/promises'
import { offlineAccount } from '../../core/auth'
import { getInstance, instanceGameDir, splitJvmArgs } from '../../core/instances'
import { installVersion } from '../../core/install'
import { buildLaunchCommand, spawnGame } from '../../core/launch'
import { LOADERS } from '../../core/loaders'
import { createLogDecoder } from '../../core/log4j'
import { loginWithRefreshToken } from '../../core/msa'
import type { Account, Progress } from '../../core/types'
import type { PlayOptions } from '../../shared/api'
import { loadAccount, offlineAllowed, saveAccount } from '../accounts'
import { INSTANCES_DIR, MSA_CLIENT_ID, paths } from '../config'

let running = false

/** Compte Microsoft (token rafraîchi à chaque partie : il dure ~24 h) ou compte hors-ligne. */
async function resolveAccount(offlineName: string): Promise<Account> {
  const stored = await loadAccount()
  if (!stored) {
    // Vérifié ici et pas seulement dans l'UI : l'IPC n'est pas une entrée fiable.
    if (!(await offlineAllowed()))
      throw new Error('Connecte-toi une première fois avec un compte Microsoft qui possède Minecraft : le mode hors-ligne sera ensuite disponible.')
    return offlineAccount(offlineName)
  }
  const r = await loginWithRefreshToken(MSA_CLIENT_ID, stored.refreshToken)
  await saveAccount(r.account.name, r.account.uuid, r.refreshToken)
  return r.account
}

/** Un décodeur par flux : un événement XML coupé entre deux morceaux ne doit pas se mélanger à l'autre flux. */
function forwardLogs(proc: ChildProcess, send: (line: string) => void) {
  for (const stream of [proc.stdout!, proc.stderr!]) {
    const decode = createLogDecoder()
    stream.on('data', (d: Buffer) => decode(d.toString()).forEach(send))
  }
}

export function registerGameIpc() {
  ipcMain.handle('game:play', async (e, { instanceId, offlineName }: PlayOptions) => {
    if (running) throw new Error('Une partie est déjà en cours')
    running = true
    const send = (channel: string, payload: unknown) => e.sender.send(channel, payload)
    try {
      // Avant les téléchargements : un compte refusé ne doit pas coûter des centaines de Mo (le token dure ~24 h).
      const account = await resolveAccount(offlineName)
      const instance = await getInstance(INSTANCES_DIR, instanceId)
      const gameDir = instanceGameDir(INSTANCES_DIR, instanceId)
      await mkdir(gameDir, { recursive: true })

      const onProgress = (p: Progress) => send('game:progress', p)
      // Un loader crée sa propre version (ex. "1.20.1-forge-47.3.0") qui hérite du vanilla.
      const versionId =
        instance.loader === 'vanilla'
          ? instance.mcVersion
          : await LOADERS[instance.loader].install(paths, instance.mcVersion, instance.loaderVersion, onProgress, (l) =>
              send('game:log', `[${instance.loader}] ${l}`)
            )
      const { resolved, javaPath } = await installVersion(paths, versionId, onProgress)

      const proc = spawnGame(
        buildLaunchCommand(paths, resolved, {
          versionId,
          account,
          javaPath,
          gameDir,
          maxMemoryMb: instance.memoryMb,
          extraJvmArgs: splitJvmArgs(instance.jvmArgs)
        })
      )
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
