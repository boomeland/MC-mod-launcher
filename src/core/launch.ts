import { spawn, type ChildProcess } from 'node:child_process'
import { delimiter, join } from 'node:path'
import { libraryFile, resolveLibraries } from './libraries'
import type { GamePaths } from './paths'
import { rulesAllow } from './rules'
import type { Account, Argument } from './types'
import type { ResolvedVersion } from './version'
import pkg from '../../package.json'

export interface LaunchOptions {
  versionId: string
  account: Account
  javaPath: string
  /** Dossier de jeu (saves, mods, options…). Différent de la racine pour supporter plusieurs instances. */
  gameDir: string
  maxMemoryMb?: number
  extraJvmArgs?: string[]
}

const LAUNCHER_NAME = 'mc-mod-launcher'
// Lue dans package.json, seule source de la version : une release ne peut plus annoncer une version périmée au jeu.
const LAUNCHER_VERSION = pkg.version

function flatten(args: Argument[] | undefined): string[] {
  const out: string[] = []
  for (const a of args ?? []) {
    if (typeof a === 'string') out.push(a)
    else if (rulesAllow(a.rules)) out.push(...(Array.isArray(a.value) ? a.value : [a.value]))
  }
  return out
}

function substitute(args: string[], vars: Record<string, string>): string[] {
  return args.map((a) => a.replace(/\$\{(\w+)\}/g, (m, k: string) => vars[k] ?? m))
}

export function buildLaunchCommand(paths: GamePaths, resolved: ResolvedVersion, o: LaunchOptions) {
  const { json } = resolved

  const classpath = [
    ...resolveLibraries(json.libraries).filter((l) => !l.extract).map((l) => libraryFile(paths.libraries, l)),
    paths.versionJar(o.versionId) // pour une version héritée, installVersion en a fait une copie du jar vanilla
  ].join(delimiter)

  const vars: Record<string, string> = {
    auth_player_name: o.account.name,
    auth_uuid: o.account.uuid,
    auth_access_token: o.account.accessToken,
    auth_session: `token:${o.account.accessToken}:${o.account.uuid}`,
    user_type: o.account.userType,
    user_properties: '{}',
    clientid: '',
    auth_xuid: '',
    version_name: o.versionId,
    version_type: json.type ?? 'release',
    game_directory: o.gameDir,
    assets_root: paths.assets,
    game_assets: paths.assets,
    assets_index_name: json.assetIndex?.id ?? json.assets ?? '',
    natives_directory: paths.nativesDir(o.versionId),
    launcher_name: LAUNCHER_NAME,
    launcher_version: LAUNCHER_VERSION,
    classpath,
    classpath_separator: delimiter,
    library_directory: paths.libraries
  }

  // Format récent : arguments.{jvm,game}. Format ≤ 1.12 : chaîne minecraftArguments + JVM args implicites.
  const legacy = typeof json.minecraftArguments === 'string'
  const jvmArgs = legacy
    ? ['-Djava.library.path=${natives_directory}', '-Dminecraft.launcher.brand=${launcher_name}',
       '-Dminecraft.launcher.version=${launcher_version}', '-cp', '${classpath}']
    : flatten(json.arguments?.jvm)
  const gameArgs = legacy ? json.minecraftArguments!.split(' ') : flatten(json.arguments?.game)

  const logCfg = json.logging?.client
  const logArgs = logCfg ? [logCfg.argument.replace('${path}', join(paths.assets, 'log_configs', logCfg.file.id))] : []

  const args = [
    `-Xmx${o.maxMemoryMb ?? 2048}M`,
    ...(o.extraJvmArgs ?? []),
    ...logArgs,
    ...substitute(jvmArgs, vars),
    json.mainClass,
    ...substitute(gameArgs, vars)
  ]
  return { command: o.javaPath, args, cwd: o.gameDir }
}

export function spawnGame(cmd: { command: string; args: string[]; cwd: string }): ChildProcess {
  // Sous Windows : javaw.exe (pas de console) et surtout PAS windowsHide, qui cacherait aussi la fenêtre du jeu.
  const command = process.platform === 'win32' ? cmd.command.replace(/java\.exe$/i, 'javaw.exe') : cmd.command
  return spawn(command, cmd.args, { cwd: cmd.cwd, stdio: ['ignore', 'pipe', 'pipe'] })
}
