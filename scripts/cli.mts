// Usage : npm run cli -- <mcVersion | ftb:<id> | mr:<id>> [pseudo] [--forge[=v] | --neoforge[=v] | --fabric[=v]] [--instance=<nom>] [--dry]
// Installe la version dans .cli-data/ puis la lance (ou affiche juste la commande avec --dry).
// --<loader> sans valeur = version recommandée (ou la plus récente).
// --instance=<nom> lance dans le dossier de jeu d'une instance (créée si besoin, 2048 Mo) au lieu de .cli-data/.
// ftb:<id> ou mr:<id|slug> installe un modpack FTB ou Modrinth (sa dernière version jouable) : --instance est alors obligatoire.
import { join, resolve } from 'node:path'
import { offlineAccount } from '../src/core/auth'
import { createInstance, instanceGameDir, listInstances, type LoaderChoice } from '../src/core/instances'
import { installVersion } from '../src/core/install'
import { buildLaunchCommand, spawnGame } from '../src/core/launch'
import { LOADERS } from '../src/core/loaders'
import { PACK_SOURCES, type PreparedPack } from '../src/core/modpacks'
import { gamePaths } from '../src/core/paths'
import { isModLoader } from '../src/core/types'

const args = process.argv.slice(2)
const dry = args.includes('--dry')
const instanceName = args.find((a) => a.startsWith('--instance='))?.split('=')[1]
const [loaderFlag, wanted] = args.find((a) => isModLoader(a.slice(2).split('=')[0]))?.slice(2).split('=') ?? []
const [target, name = 'Player'] = args.filter((a) => !a.startsWith('--'))
if (!target) throw new Error('Usage : npm run cli -- <mcVersion | ftb:<id> | mr:<id>> [pseudo] [--<loader>[=<version>]] [--instance=<nom>] [--dry]')

const root = resolve('.cli-data')
const paths = gamePaths(root)

let lastStage = ''
const onProgress = (p: { stage: string; total: number }) => {
  if (p.stage !== lastStage) {
    lastStage = p.stage
    console.log(`\n[${p.stage}] ${p.total} fichiers`)
  }
}

// 1. Version de Minecraft et loader : depuis le modpack, ou depuis la ligne de commande.
let mcVersion = target
let choice: LoaderChoice = { loader: 'vanilla' }
let pack: PreparedPack | undefined
const packTarget = target.match(/^(ftb|mr):(.+)$/)
if (packTarget) {
  if (!instanceName) throw new Error('Un modpack s\'installe dans une instance : ajouter --instance=<nom>')
  const source = PACK_SOURCES[packTarget[1] === 'mr' ? 'modrinth' : 'ftb']
  const detail = await source.getPack(packTarget[2])
  const version = detail.versions.find((v) => v.supported)
  if (!version) throw new Error(`Aucune version jouable de ${detail.name}`)
  pack = await source.prepare(detail, version, join(root, 'modpacks'))
  mcVersion = pack.mcVersion
  choice = pack.loader
  console.log(`${detail.name} ${version.name} : MC ${mcVersion}, ${choice.loader} ${'loaderVersion' in choice ? choice.loaderVersion : ''}`)
} else if (isModLoader(loaderFlag)) {
  const list = await LOADERS[loaderFlag].listVersions(mcVersion)
  // Forge accepte la version courte ("47.3.0") comme la forme Maven complète ("1.20.1-47.3.0").
  const loaderVersion = wanted
    ? list.versions.find((v) => v === wanted || v === `${mcVersion}-${wanted}`)
    : (list.recommended ?? list.latest ?? list.versions[0])
  if (!loaderVersion) throw new Error(`Aucune version ${loaderFlag}${wanted ? ` ${wanted}` : ''} pour Minecraft ${mcVersion}`)
  console.log(`${loaderFlag} ${loaderVersion} (recommandée : ${list.recommended ?? '—'}, dernière : ${list.latest ?? '—'})`)
  choice = { loader: loaderFlag, loaderVersion }
}

// 2. Installation du loader puis de tout ce que la version demande.
const versionId =
  choice.loader === 'vanilla'
    ? mcVersion
    : await LOADERS[choice.loader].install(paths, mcVersion, choice.loaderVersion, onProgress, (l) => console.log(`  ${choice.loader}> ${l}`))
const { resolved, javaPath } = await installVersion(paths, versionId, onProgress)
console.log(`\nVersion : ${versionId}\nJava : ${javaPath}`)

// 3. Dossier de jeu : celui d'une instance (et les fichiers du modpack), ou .cli-data/.
let gameDir = root
let maxMemoryMb: number | undefined
if (instanceName) {
  const dir = join(root, 'instances')
  const instance =
    (await listInstances(dir)).find((i) => i.name === instanceName) ??
    (await createInstance(dir, { name: instanceName, mcVersion, memoryMb: 2048, ...choice }))
  gameDir = instanceGameDir(dir, instance.id)
  maxMemoryMb = instance.memoryMb
  console.log(`Instance ${instance.id} → ${gameDir} (${maxMemoryMb} Mo)`)
  if (pack) await pack.install(gameDir, onProgress)
}

const cmd = buildLaunchCommand(paths, resolved, {
  versionId,
  account: offlineAccount(name),
  javaPath,
  gameDir,
  maxMemoryMb
})

if (dry) {
  console.log([cmd.command, ...cmd.args].join(' '))
  process.exit(0)
}

const proc = spawnGame(cmd)
proc.stdout!.on('data', (d) => process.stdout.write(d))
proc.stderr!.on('data', (d) => process.stderr.write(d))
proc.on('exit', (code) => process.exit(code ?? 0))
