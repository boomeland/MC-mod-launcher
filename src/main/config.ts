import { app } from 'electron'
import { join } from 'node:path'
import { gamePaths } from '../core/paths'

/** client_id de l'app Azure, lu dans .env (MAIN_VITE_MSA_CLIENT_ID). */
export const MSA_CLIENT_ID = import.meta.env.MAIN_VITE_MSA_CLIENT_ID ?? ''

/** Dossier de jeu du launcher (versions, librairies, assets, Java). */
export const paths = gamePaths(join(app.getPath('userData'), 'minecraft'))
