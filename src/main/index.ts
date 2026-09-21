import { app, BrowserWindow, ipcMain } from 'electron'
import { join } from 'node:path'
import { offlineAccount } from '../core/auth'
import { installVersion } from '../core/install'
import { buildLaunchCommand, spawnGame } from '../core/launch'
import { gamePaths } from '../core/paths'
import { fetchVersionList } from '../core/version'

const paths = gamePaths(join(app.getPath('userData'), 'minecraft'))
let win: BrowserWindow | null = null
let running = false

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

ipcMain.handle('game:play', async (e, versionId: string, username: string) => {
  if (running) throw new Error('Une partie est déjà en cours')
  running = true
  const send = (channel: string, payload: unknown) => e.sender.send(channel, payload)
  try {
    const { resolved, javaPath } = await installVersion(paths, versionId, (p) => send('game:progress', p))
    const cmd = buildLaunchCommand(paths, resolved, {
      versionId,
      account: offlineAccount(username),
      javaPath,
      gameDir: paths.root
    })
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
