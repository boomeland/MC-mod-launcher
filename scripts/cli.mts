// Usage : npm run cli -- <mcVersion> [pseudo] [--forge[=<version>]] [--dry]
// Installe la version dans .cli-data/ puis la lance (ou affiche juste la commande avec --dry).
// --forge sans valeur = version recommandée (ou la plus récente).
import { resolve } from 'node:path'
import { offlineAccount } from '../src/core/auth'
import { installForge, listForgeVersions } from '../src/core/forge'
import { installVersion } from '../src/core/install'
import { buildLaunchCommand, spawnGame } from '../src/core/launch'
import { gamePaths } from '../src/core/paths'

const args = process.argv.slice(2)
const dry = args.includes('--dry')
const forgeArg = args.find((a) => a.startsWith('--forge'))
const [mcVersion, name = 'Player'] = args.filter((a) => !a.startsWith('--'))
if (!mcVersion) throw new Error('Usage : npm run cli -- <mcVersion> [pseudo] [--forge[=<version>]] [--dry]')

const root = resolve('.cli-data')
const paths = gamePaths(root)

let lastStage = ''
const onProgress = (p: { stage: string; total: number }) => {
  if (p.stage !== lastStage) {
    lastStage = p.stage
    console.log(`\n[${p.stage}] ${p.total} fichiers`)
  }
}

let versionId = mcVersion
if (forgeArg) {
  const list = await listForgeVersions(mcVersion)
  const wanted = forgeArg.split('=')[1]
  const forge = wanted ? `${mcVersion}-${wanted}` : (list.recommended ?? list.latest ?? list.versions[0])
  if (!forge) throw new Error(`Aucune version Forge pour Minecraft ${mcVersion}`)
  console.log(`Forge ${forge} (recommandée : ${list.recommended ?? '—'}, dernière : ${list.latest ?? '—'})`)
  versionId = await installForge(paths, mcVersion, forge, onProgress, (l) => console.log(`  forge> ${l}`))
}

const { resolved, javaPath } = await installVersion(paths, versionId, onProgress)
console.log(`\nVersion : ${versionId}\nJava : ${javaPath}`)

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
