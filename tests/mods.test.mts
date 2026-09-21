import assert from 'node:assert/strict'
import { mkdir, mkdtemp, readdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, it } from 'node:test'
import { addModFiles, deleteMod, listMods, modPath, setModEnabled } from '../src/core/mods'

let root: string
let gameDir: string

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'mcl-mods-'))
  gameDir = join(root, 'minecraft')
  await mkdir(join(gameDir, 'mods'), { recursive: true })
})
afterEach(() => rm(root, { recursive: true, force: true }))

const files = async () => (await readdir(join(gameDir, 'mods'))).sort()

describe('mods locaux', () => {
  it('liste les .jar (actifs ou non) et ignore le reste', async () => {
    await writeFile(join(gameDir, 'mods', 'sodium.jar'), 'abc')
    await writeFile(join(gameDir, 'mods', 'Iris.JAR.disabled'), 'x')
    await writeFile(join(gameDir, 'mods', 'notes.txt'), 'x')
    await mkdir(join(gameDir, 'mods', 'dossier.jar'))
    const mods = await listMods(gameDir)
    assert.deepEqual(mods.map((m) => [m.file, m.enabled]), [['Iris.JAR.disabled', false], ['sodium.jar', true]])
    assert.deepEqual(await listMods(join(root, 'inexistant')), [])
  })

  it('désactive puis réactive par renommage', async () => {
    await writeFile(join(gameDir, 'mods', 'a.jar'), 'x')
    assert.equal(await setModEnabled(gameDir, 'a.jar', false), 'a.jar.disabled')
    assert.deepEqual(await files(), ['a.jar.disabled'])
    assert.equal(await setModEnabled(gameDir, 'a.jar.disabled', true), 'a.jar')
    assert.equal(await setModEnabled(gameDir, 'a.jar', true), 'a.jar') // déjà actif : rien à faire
    assert.deepEqual(await files(), ['a.jar'])
  })

  it('supprime un mod', async () => {
    await writeFile(join(gameDir, 'mods', 'a.jar'), 'x')
    await deleteMod(gameDir, 'a.jar')
    assert.deepEqual(await files(), [])
  })

  it('ajoute des .jar et refuse les autres fichiers', async () => {
    const src = join(root, 'Mon Mod.jar')
    await writeFile(src, 'x')
    assert.deepEqual(await addModFiles(gameDir, [src]), ['Mon Mod.jar'])
    assert.deepEqual(await files(), ['Mon Mod.jar'])
    await writeFile(join(root, 'virus.exe'), 'x')
    await assert.rejects(addModFiles(gameDir, [join(root, 'virus.exe')]), /\.jar/)
  })

  it('refuse les noms qui ne sont pas un .jar de mods/ (entrée IPC)', async () => {
    const precieux = join(gameDir, 'saves', 'monde.dat')
    await mkdir(join(gameDir, 'saves'))
    await writeFile(precieux, 'à garder')
    for (const bad of ['../saves/monde.dat', '..\\saves\\x.jar', '../x.jar', 'sous/x.jar', 'x.txt', '', '.jar.exe', 'C:\\x.jar']) {
      assert.throws(() => modPath(gameDir, bad), /invalide/, bad)
      await assert.rejects(deleteMod(gameDir, bad), /invalide/, bad)
    }
    assert.deepEqual(await readdir(join(gameDir, 'saves')), ['monde.dat'])
  })
})
