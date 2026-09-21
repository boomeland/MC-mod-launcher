import assert from 'node:assert/strict'
import { mkdir, mkdtemp, readdir, rm, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, it } from 'node:test'
import {
  createInstance,
  deleteInstance,
  getInstance,
  instanceGameDir,
  listInstances,
  updateInstance
} from '../src/core/instances'

let base: string

beforeEach(async () => {
  base = join(await mkdtemp(join(tmpdir(), 'mcl-')), 'instances') // n'existe pas encore : createInstance doit le créer
})
afterEach(() => rm(join(base, '..'), { recursive: true, force: true }))

const exists = (p: string) => stat(p).then(() => true, () => false)

describe('instances', () => {
  it('crée une instance avec son dossier de jeu et mods/', async () => {
    const i = await createInstance(base, { name: 'Mon Modpack', mcVersion: '1.20.1', loader: 'forge', loaderVersion: '1.20.1-47.4.10', memoryMb: 4096 })
    assert.equal(i.id, 'mon-modpack')
    assert.equal(i.loader, 'forge')
    assert.equal(i.memoryMb, 4096)
    assert.ok(await exists(join(instanceGameDir(base, i.id), 'mods')))
    assert.deepEqual(await getInstance(base, i.id), i)
  })

  it('une instance vanilla n\'a pas de version de loader, même si l\'entrée en contient une', async () => {
    const input = { name: 'Solo', mcVersion: '1.21.1', loader: 'vanilla', loaderVersion: '21.1.251' } as const
    const i = await createInstance(base, input)
    assert.equal(i.loader, 'vanilla')
    assert.ok(!('loaderVersion' in i))
    assert.equal(i.memoryMb, 2048)
  })

  it('refuse un loader inconnu ou sans version, sans réserver de dossier', async () => {
    const bad = [
      { name: 'Inconnu', mcVersion: '1.21.1', loader: 'quilt', loaderVersion: '0.16.0' },
      { name: 'Sans version', mcVersion: '1.21.1', loader: 'neoforge', loaderVersion: '' }
    ]
    for (const input of bad) await assert.rejects(createInstance(base, input as never))
    assert.deepEqual(await listInstances(base), [])
    assert.deepEqual(await readdir(base).catch(() => []), [])
  })

  it('retire les accents et les caractères spéciaux du slug', async () => {
    assert.equal((await createInstance(base, { name: 'Été à Nîmes !', mcVersion: '1.20.1', loader: 'vanilla' })).id, 'ete-a-nimes')
    assert.equal((await createInstance(base, { name: '???', mcVersion: '1.20.1', loader: 'vanilla' })).id, 'instance')
  })

  it('génère des ids uniques, même en parallèle', async () => {
    const all = await Promise.all(Array.from({ length: 5 }, () => createInstance(base, { name: 'Pack', mcVersion: '1.20.1', loader: 'vanilla' })))
    assert.equal(new Set(all.map((i) => i.id)).size, 5)
    assert.ok(all.some((i) => i.id === 'pack') && all.some((i) => i.id === 'pack-2'))
  })

  it('refuse un nom vide ou une version manquante', async () => {
    await assert.rejects(createInstance(base, { name: '   ', mcVersion: '1.20.1', loader: 'vanilla' }))
    await assert.rejects(createInstance(base, { name: 'X', mcVersion: '', loader: 'vanilla' }))
  })

  it('borne la mémoire', async () => {
    assert.equal((await createInstance(base, { name: 'Bas', mcVersion: '1.20.1', loader: 'vanilla', memoryMb: 1 })).memoryMb, 512)
    assert.equal((await createInstance(base, { name: 'Haut', mcVersion: '1.20.1', loader: 'vanilla', memoryMb: 10 ** 9 })).memoryMb, 32768)
    assert.equal((await createInstance(base, { name: 'NaN', mcVersion: '1.20.1', loader: 'vanilla', memoryMb: NaN })).memoryMb, 2048)
  })

  it('liste par ordre de création et ignore les dossiers cassés', async () => {
    await createInstance(base, { name: 'A', mcVersion: '1.20.1', loader: 'vanilla' })
    await createInstance(base, { name: 'B', mcVersion: '1.20.1', loader: 'vanilla' })
    await mkdir(join(base, 'sans-meta'))
    await mkdir(join(base, 'Pas Un Slug'))
    assert.deepEqual((await listInstances(base)).map((i) => i.id), ['a', 'b'])
    assert.deepEqual(await listInstances(join(base, 'inexistant')), [])
  })

  it('met à jour nom et mémoire sans changer le dossier', async () => {
    const i = await createInstance(base, { name: 'Ancien', mcVersion: '1.20.1', loader: 'vanilla' })
    const u = await updateInstance(base, i.id, { name: 'Nouveau', memoryMb: 6144 })
    assert.equal(u.id, i.id)
    assert.equal(u.name, 'Nouveau')
    assert.equal(u.memoryMb, 6144)
    assert.equal((await updateInstance(base, i.id, { name: '  ' })).name, 'Nouveau')
  })

  it('supprime l\'instance et son dossier de jeu', async () => {
    const i = await createInstance(base, { name: 'Jetable', mcVersion: '1.20.1', loader: 'vanilla' })
    await writeFile(join(instanceGameDir(base, i.id), 'monde.dat'), 'x')
    await deleteInstance(base, i.id)
    assert.ok(!(await exists(join(base, i.id))))
  })

  it('refuse les ids qui sortent du dossier (pas de suppression hors instances/)', async () => {
    const i = await createInstance(base, { name: 'Ok', mcVersion: '1.20.1', loader: 'vanilla' })
    const precieux = join(base, '..', 'precieux')
    await mkdir(precieux)
    await writeFile(join(precieux, 'important.txt'), 'à garder')

    for (const bad of ['../precieux', '..', '.', '', '/', 'a/../../precieux', 'A', 'a b', 'a--b', '-a']) {
      await assert.rejects(deleteInstance(base, bad), /invalide/, `deleteInstance(${JSON.stringify(bad)})`)
      await assert.rejects(getInstance(base, bad))
      assert.throws(() => instanceGameDir(base, bad), /invalide/)
    }
    assert.ok(await exists(join(precieux, 'important.txt')))
    assert.deepEqual((await readdir(base)).sort(), [i.id])
  })
})
