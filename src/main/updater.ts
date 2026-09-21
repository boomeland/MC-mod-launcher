// Mise à jour automatique depuis les releases GitHub : electron-updater lit latest.yml (version, fichier, SHA-512)
// joint à chaque release, télécharge l'installeur en arrière-plan et l'installe au redémarrage ou à la fermeture.
import { app, ipcMain, shell, type BrowserWindow } from 'electron'
import { autoUpdater } from 'electron-updater'

const RELEASES_PAGE = 'https://github.com/boomeland/MC-mod-launcher/releases/latest'

export function initUpdater(win: BrowserWindow) {
  if (!app.isPackaged) return // en dev, il n'y a pas de version installée à remplacer

  // La version portable ne peut pas se remplacer elle-même : on la prévient seulement, sans rien télécharger.
  const portable = Boolean(process.env.PORTABLE_EXECUTABLE_DIR)
  autoUpdater.autoDownload = !portable
  autoUpdater.autoInstallOnAppQuit = true

  const send = (state: 'downloading' | 'ready' | 'available', version: string) =>
    win.webContents.send('update:state', { state, version })
  autoUpdater.on('update-available', (info) => send(portable ? 'available' : 'downloading', info.version))
  autoUpdater.on('update-downloaded', (info) => send('ready', info.version))
  // Hors ligne, GitHub indisponible… : rien à montrer à l'utilisateur, on réessaiera au prochain démarrage.
  autoUpdater.on('error', (e) => console.error('Mise à jour :', e.message))

  // Installation silencieuse, puis relance du launcher mis à jour.
  ipcMain.handle('update:install', () => autoUpdater.quitAndInstall(true, true))
  // L'URL est fixée ici : le renderer ne choisit pas ce qu'on ouvre dans le navigateur.
  ipcMain.handle('update:open-page', () => shell.openExternal(RELEASES_PAGE))

  win.webContents.once('did-finish-load', () => void autoUpdater.checkForUpdates().catch(() => {}))
}
