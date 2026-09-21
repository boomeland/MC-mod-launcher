// Usage : npm run cli -- <mcVersion | ftb:<packId>> [pseudo] [--forge[=v] | --neoforge[=v] | --fabric[=v]] [--instance=<nom>] [--dry]
// Installe la version dans .cli-data/ puis la lance (ou affiche juste la commande avec --dry).
// --<loader> sans valeur = version recommandée (ou la plus récente).
// --instance=<nom> lance dans le dossier de jeu d'une instance (créée si besoin, 2048 Mo) au lieu de .cli-data/.
// ftb:<packId> installe un modpack FTB (sa dernière version jouable) : --instance est alors obligatoire.
import { join, resolve } from 'node:path'
import { offlineAccount } from '../src/core/auth'
import { createInstance, instanceGameDir, listInstances, type LoaderChoice } from '../src/core/instances'
import { installVersion } from '../src/core/install'
import { buildLaunchCommand, spawnGame } from '../src/core/launch'
import { LOADERS } from '../src/core/loaders'
import { getFtbPack, installFtbFiles, resolveFtbLoader, type FtbVersion } from '../src/core/modpacks/ftb'
import { gamePaths } from '../src/core/paths'
import { isModLoader } from '../src/core/types'

const args = process.argv.slice(2)
const dry = args.includes('--dry')
const instanceName = args.find((a) => a.startsWith('--instance='))?.split('=')[1]
const [loaderFlag, wanted] = args.find((a) => isModLoader(a.slice(2).split('=')[0]))?.slice(2).split('=') ?? []
const [target, name = 'Player'] = args.filter((a) => !a.startsWith('--'))
if (!target) throw new Error('Usage : npm run cli -- <mcVersion | ftb:<packId>> [pseudo] [--<loader>[=<version>]] [--instance=<nom>] [--dry]')

const root = resolve('.cli-data')
const paths = gamePaths(root)

let lastStage = ''
const onProgress = (p: { stage: string; total: number }) => {
  if (p.stage !== lastStage) {
    lastStage = p.stage
    console.log(`\n[${p.stage}] ${p.total} fichiers`)
  }
}

// 1. Version de Minecraft et loader : depuis le pack FTB, ou depuis la ligne de commande.
let mcVersion = target
let choice: LoaderChoice = { loader: 'vanilla' }
let ftb: { packId: number; version: FtbVersion } | undefined
if (target.startsWith('ftb:')) {
  if (!instanceName) throw new Error('Un modpack FTB s\'installe dans une instance : ajouter --instance=<nom>')
  const packId = Number(target.slice(4))
  const pack = await getFtbPack(packId)
  const version = pack.versions.find((v) => v.supported)
  if (!version) throw new Error(`Aucune version jouable de ${pack.name}`)
  console.log(`FTB ${pack.name} ${version.name} : MC ${version.mcVersion}, ${version.loader} ${version.loaderVersion}`)
  ftb = { packId, version }
  mcVersion = version.mcVersion
  choice = await resolveFtbLoader(version)
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

// 3. Dossier de jeu : celui d'une instance (et les fichiers du pack FTB), ou .cli-data/.
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
  if (ftb) await installFtbFiles(gameDir, ftb.packId, ftb.version.id, onProgress)
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
