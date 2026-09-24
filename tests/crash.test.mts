import assert from 'node:assert/strict'
import { mkdir, mkdtemp, readFile, rm, utimes, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { after, before, describe, it } from 'node:test'
import { diagnoseCrash, explainCrash, findCrashReport } from '../src/core/crash'

// Textes réels, obtenus en provoquant les crashs (chemins anonymisés) :
// - fabric-console : Sodium Extra sans Sodium (Fabric 0.19.5, MC 1.21.1), fenêtre d'erreur, pas de rapport ;
// - neoforge-report : REI sans Architectury ni Cloth Config (NeoForge 21.1.248), début de crash-reports/crash-…-fml.txt ;
// - oom-console : vanilla 1.21.1 avec -Xmx200M, écran « Out of memory », pas de rapport ;
// - hs_err.log : vanilla avec -Xmx64M -XX:+CrashOnOutOfMemoryError, début du hs_err_pid*.log de Java.
const FIXTURES = join(import.meta.dirname, 'fixtures', 'crash')
const fixture = (name: string) => readFile(join(FIXTURES, name), 'utf8')

describe('cause d\'un crash', () => {
  it('reprend la solution calculée par Fabric', async () => {
    assert.equal(
      explainCrash(await fixture('fabric-console.txt')),
      'Mods incompatibles. Solution proposée par Fabric : Install sodium, version 0.8.13+mc1.21.1 or later.'
    )
  })

  it('liste les échecs de chargement de NeoForge', async () => {
    assert.equal(
      explainCrash(await fixture('neoforge-report.txt')),
      "Les mods n'ont pas pu être chargés : Mod roughlyenoughitems requires architectury 8 or above ; " +
        'Mod roughlyenoughitems requires cloth_config 10.0 or above'
    )
  })

  it('reconnaît un manque de mémoire, dans la console comme dans un hs_err', async () => {
    for (const f of ['oom-console.txt', 'hs_err.log']) assert.match(explainCrash(await fixture(f)) ?? '', /manqué de mémoire/)
  })

  it('ne voit rien dans une console normale', async () => {
    const normal = (await fixture('oom-console.txt')).split('\n').slice(0, 2).join('\n') // avant l'erreur
    assert.equal(explainCrash(normal), undefined)
  })
})

describe('rapport de crash', () => {
  let game = ''
  const start = Date.now()
  before(async () => {
    game = await mkdtemp(join(tmpdir(), 'crash-test-'))
    await mkdir(join(game, 'crash-reports'))
  })
  after(() => rm(game, { recursive: true, force: true }))

  it("ignore un rapport d'une partie précédente", async () => {
    const old = join(game, 'crash-reports', 'crash-ancien.txt')
    await writeFile(old, await fixture('neoforge-report.txt'))
    await utimes(old, new Date(start - 60_000), new Date(start - 60_000))
    assert.equal(await findCrashReport(game, start), undefined)
    assert.equal(await diagnoseCrash(game, start, ['[main/INFO] Stopping!']), null)
  })

  it('trouve le hs_err écrit par Java à la racine du dossier de jeu', async () => {
    const hs = join(game, 'hs_err_pid6528.log')
    await writeFile(hs, await fixture('hs_err.log')) // pas copyFile : sous Windows, la copie garde la date de l'original
    assert.deepEqual(await diagnoseCrash(game, start, []), {
      cause: "Minecraft a manqué de mémoire : augmente la RAM de l'instance dans l'onglet Réglages.",
      report: hs
    })
  })

  it('préfère crash-reports/ et retombe sur la description quand la cause est inconnue', async () => {
    const report = join(game, 'crash-reports', 'crash-nouveau.txt')
    const text = (await fixture('neoforge-report.txt')).replace(/\tFailure message: .*\n/g, '')
    await writeFile(report, text)
    assert.deepEqual(await diagnoseCrash(game, start, []), {
      cause: 'Le jeu a planté : Mod loading failures have occurred; consult the issue messages for more details',
      report
    })
  })

  it('trouve la cause dans la console quand aucun rapport n\'est écrit', async () => {
    const empty = await mkdtemp(join(tmpdir(), 'crash-test-'))
    try {
      const console = (await fixture('fabric-console.txt')).split('\n')
      assert.match((await diagnoseCrash(empty, start, console))?.cause ?? '', /Install sodium/)
    } finally {
      await rm(empty, { recursive: true, force: true })
    }
  })
})
