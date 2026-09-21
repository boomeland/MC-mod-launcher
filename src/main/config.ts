import { app } from 'electron'
import { join } from 'node:path'
import { gamePaths } from '../core/paths'

/** client_id de l'app Azure, lu dans .env (MAIN_VITE_MSA_CLIENT_ID). */
export const MSA_CLIENT_ID = import.meta.env.MAIN_VITE_MSA_CLIENT_ID ?? ''

/** Fichiers partagés par toutes les instances (versions, librairies, assets, Java). */
export const paths = gamePaths(join(app.getPath('userData'), 'minecraft'))

/** Un sous-dossier par instance : <id>/instance.json et <id>/minecraft/ (mods, mondes, options). */
export const INSTANCES_DIR = join(app.getPath('userData'), 'instances')
