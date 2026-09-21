import { ipcMain, shell } from 'electron'
import { loginWithDeviceCode } from '../../core/msa'
import { clearAccount, loadAccount, saveAccount } from '../accounts'
import { MSA_CLIENT_ID } from '../config'

let loginAbort: AbortController | null = null

export function registerAuthIpc() {
  ipcMain.handle('auth:account', async () => (await loadAccount())?.name ?? null)

  ipcMain.handle('auth:login', async (e) => {
    loginAbort?.abort()
    loginAbort = new AbortController()
    try {
      const { account, refreshToken } = await loginWithDeviceCode(
        MSA_CLIENT_ID,
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
}
