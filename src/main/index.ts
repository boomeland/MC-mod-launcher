import { app } from 'electron'
import { registerAuthIpc } from './ipc/auth'
import { registerGameIpc } from './ipc/game'
import { registerInstancesIpc } from './ipc/instances'
import { registerModpacksIpc } from './ipc/modpacks'
import { registerModsIpc } from './ipc/mods'
import { registerVersionsIpc } from './ipc/versions'
import { createWindow } from './window'

registerVersionsIpc()
registerInstancesIpc()
registerModpacksIpc()
registerModsIpc()
registerAuthIpc()
registerGameIpc()

app.whenReady().then(createWindow)
app.on('window-all-closed', () => app.quit())
