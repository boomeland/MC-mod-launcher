import { app, BrowserWindow, ipcMain, shell } from 'electron'
import { join } from 'node:path'
import { offlineAccount } from '../core/auth'
import { installVersion } from '../core/install'
import { buildLaunchCommand, spawnGame } from '../core/launch'
import { loginWithDeviceCode, loginWithRefreshToken } from '../core/msa'
import { gamePaths } from '../core/paths'
import type { Account } from '../core/types'
import { fetchVersionList } from '../core/version'
import { clearAccount, loadAccount, saveAccount } from './accounts'

const CLIENT_ID = import.meta.env.MAIN_VITE_MSA_CLIENT_ID ?? ''

const paths = gamePaths(join(app.getPath('userData'), 'minecraft'))
let win: BrowserWindow | null = null
let running = false
let loginAbort: AbortController | null = null

function createWindow() {
  win = new BrowserWindow({
    width: 900,
    height: 620,
    backgroundColor: '#14161a',
    webPreferences: { preload: join(__dirname, '../preload/index.js'), sandbox: true }
  })
  win.setMenuBarVisibility(false)
  if (process.env.ELECTRON_RENDERER_URL) win.loadURL(process.env.ELECTRON_RENDERER_URL)
  else win.loadFile(join(__dirname, '../renderer/index.html'))
}

ipcMain.handle('versions:list', async () => {
  const m = await fetchVersionList()
  return {
    latestRelease: m.latest.release,
    versions: m.versions.map((v) => ({ id: v.id, type: v.type }))
  }
})

// --- Compte Microsoft ---

ipcMain.handle('auth:account', async () => (await loadAccount())?.name ?? null)

ipcMain.handle('auth:login', async (e) => {
  loginAbort?.abort()
  loginAbort = new AbortController()
  try {
    const { account, refreshToken } = await loginWithDeviceCode(
      CLIENT_ID,
      (dc) => {
        e.sender.send('auth:code', { userCode: dc.userCode, verificationUri: dc.verificationUri })
        if (dc.verificationUri.startsWith('https://')) void shell.openExternal(dc.verificationUri)
      },
      loginAbort.signal
    )
    await saveAccount(account.name, account.uuid, refreshToken)
    return account.name
  } finally {
    loginAbort = null
  }
})

ipcMain.on('auth:cancel', () => loginAbort?.abort())
ipcMain.handle('auth:logout', () => clearAccount())

// --- Lancement ---

ipcMain.handle('game:play', async (e, versionId: string, offlineName: string) => {
  if (running) throw new Error('Une partie est déjà en cours')
  running = true
  const send = (channel: string, payload: unknown) => e.sender.send(channel, payload)
  try {
    const { resolved, javaPath } = await installVersion(paths, versionId, (p) => send('game:progress', p))

    // Token rafraîchi juste avant le lancement (l'access token Minecraft dure ~24 h).
    let account: Account
    const stored = await loadAccount()
    if (stored) {
      const r = await loginWithRefreshToken(CLIENT_ID, stored.refreshToken)
      await saveAccount(r.account.name, r.account.uuid, r.refreshToken)
      account = r.account
    } else {
      account = offlineAccount(offlineName)
    }

    const cmd = buildLaunchCommand(paths, resolved, { versionId, account, javaPath, gameDir: paths.root })
    const proc = spawnGame(cmd)
    const forward = (d: Buffer) => d.toString().split(/\r?\n/).filter(Boolean).forEach((l) => send('game:log', l))
    proc.stdout!.on('data', forward)
    proc.stderr!.on('data', forward)
    proc.on('exit', (code) => {
      running = false
      send('game:exit', code)
    })
  } catch (err) {
    running = false
    throw err
  }
})

app.whenReady().then(createWindow)
app.on('window-all-closed', () => app.quit())
