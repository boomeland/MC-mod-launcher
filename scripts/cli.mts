// Usage : npm run cli -- <versionId> [pseudo] [--dry]
// Installe la version dans .cli-data/ puis la lance (ou affiche juste la commande avec --dry).
import { resolve } from 'node:path'
import { offlineAccount } from '../src/core/auth'
import { installVersion } from '../src/core/install'
import { buildLaunchCommand, spawnGame } from '../src/core/launch'
import { gamePaths } from '../src/core/paths'

const args = process.argv.slice(2)
const dry = args.includes('--dry')
const [versionId, name = 'Player'] = args.filter((a) => !a.startsWith('--'))
if (!versionId) throw new Error('Usage : npm run cli -- <versionId> [pseudo] [--dry]')

const root = resolve('.cli-data')
const paths = gamePaths(root)

let lastStage = ''
const { resolved, javaPath } = await installVersion(paths, versionId, (p) => {
  if (p.stage !== lastStage) {
    lastStage = p.stage
    console.log(`\n[${p.stage}] ${p.total} fichiers`)
  }
})
console.log(`\nJava : ${javaPath}`)

const cmd = buildLaunchCommand(paths, resolved, {
  versionId,
  account: offlineAccount(name),
  javaPath,
  gameDir: root
})

if (dry) {
  console.log([cmd.command, ...cmd.args].join(' '))
  process.exit(0)
}

const proc = spawnGame(cmd)
proc.stdout!.on('data', (d) => process.stdout.write(d))
proc.stderr!.on('data', (d) => process.stderr.write(d))
proc.on('exit', (code) => process.exit(code ?? 0))
