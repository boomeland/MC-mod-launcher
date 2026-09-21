import { app } from 'electron'
import { registerAuthIpc } from './ipc/auth'
import { registerGameIpc } from './ipc/game'
import { registerVersionsIpc } from './ipc/versions'
import { createWindow } from './window'

registerVersionsIpc()
registerAuthIpc()
registerGameIpc()

app.whenReady().then(createWindow)
app.on('window-all-closed', () => app.quit())
