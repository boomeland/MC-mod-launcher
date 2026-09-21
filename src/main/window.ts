import { BrowserWindow } from 'electron'
import { join } from 'node:path'

export function createWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 900,
    height: 620,
    backgroundColor: '#14161a',
    webPreferences: { preload: join(__dirname, '../preload/index.js'), sandbox: true }
  })
  win.setMenuBarVisibility(false)
  if (process.env.ELECTRON_RENDERER_URL) win.loadURL(process.env.ELECTRON_RENDERER_URL)
  else win.loadFile(join(__dirname, '../renderer/index.html'))
  return win
}
