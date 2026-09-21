import AdmZip from 'adm-zip'
import assert from 'node:assert/strict'
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { afterEach, beforeEach, describe, it } from 'node:test'
import { isSupportedMc, safeImage } from '../src/core/modpacks/common'
import { extractOverrides, mrpackDownloads, packTargets, type MrpackFile } from '../src/core/modpacks/modrinth'

const file = (path: string, url = 'https://cdn.modrinth.com/data/x/a.jar', client?: 'required' | 'optional' | 'unsupported'): MrpackFile => ({
  path,
  hashes: { sha1: 'abc' },
  env: client ? { client, server: 'required' } : undefined,
  downloads: [url],
  fileSize: 1
})

describe('modpacks Modrinth (.mrpack)', () => {
  const gameDir = resolve('instance-test', 'minecraft')

  it('lit Minecraft et le loader dans les dépendances', () => {
    assert.deepEqual(packTargets({ minecraft: '1.20.1', 'fabric-loader': '0.15.7' }), { mcVersion: '1.20.1', loader: { name: 'fabric', version: '0.15.7' } })
    assert.deepEqual(packTargets({ minecraft: '1.21.1', neoforge: '21.1.77' }).loader, { name: 'neoforge', version: '21.1.77' })
    assert.deepEqual(packTargets({ minecraft: '1.20.1', 'quilt-loader': '0.20' }).loader?.name, 'quilt')
    assert.equal(packTargets({ minecraft: '1.21.1' }).loader, undefined)
    assert.throws(() => packTargets({ 'fabric-loader': '0.15.7' }), /Minecraft/)
  })

  it('télécharge les fichiers du client sous le dossier de jeu', () => {
    const items = mrpackDownloads(gameDir, [file('mods/a.jar'), file('mods/serveur.jar', undefined, 'unsupported'), file('config/b.toml', 'https://github.com/o/r/b.toml', 'optional')])
    assert.deepEqual(items.map((i) => i.dest), [join(gameDir, 'mods', 'a.jar'), join(gameDir, 'config', 'b.toml')])
  })

  it('refuse les hôtes non autorisés et les chemins hors du dossier', () => {
    assert.throws(() => mrpackDownloads(gameDir, [file('mods/a.jar', 'https://evil.example/a.jar')]), /Hôte/)
    assert.throws(() => mrpackDownloads(gameDir, [file('mods/a.jar', 'https://cdn.modrinth.com.evil.example/a.jar')]), /Hôte/)
    for (const p of ['../a.jar', 'mods/../../a.jar', resolve('/a.jar')]) assert.throws(() => mrpackDownloads(gameDir, [file(p)]), /refusé/, p)
  })

  it('ne garde que les images des CDN connus', () => {
    assert.equal(safeImage('https://cdn.modrinth.com/data/x/icon.png'), 'https://cdn.modrinth.com/data/x/icon.png')
    assert.equal(safeImage('https://evil.example/icon.png'), undefined)
    assert.equal(safeImage(null), undefined)
  })

  it('refuse Minecraft ≤ 1.9 pour les modpacks', () => {
    assert.deepEqual(['1.7.10', '1.9.4', '1.10.2', '1.21.1', '26.1'].map(isSupportedMc), [false, false, true, true, true])
  })
})

describe('overrides des .mrpack', () => {
  let dir: string
  beforeEach(async () => (dir = await mkdtemp(join(tmpdir(), 'mcl-mrpack-'))))
  afterEach(() => rm(dir, { recursive: true, force: true }))

  it('copie overrides/ puis client-overrides/, qui l\'emporte', async () => {
    const zip = new AdmZip()
    zip.addFile('modrinth.index.json', Buffer.from('{}'))
    zip.addFile('overrides/config/a.toml', Buffer.from('pack'))
    zip.addFile('overrides/options.txt', Buffer.from('commun'))
    zip.addFile('client-overrides/options.txt', Buffer.from('client'))
    await extractOverrides(zip, dir)
    assert.equal(await readFile(join(dir, 'config', 'a.toml'), 'utf8'), 'pack')
    assert.equal(await readFile(join(dir, 'options.txt'), 'utf8'), 'client')
    assert.deepEqual((await readdir(dir)).sort(), ['config', 'options.txt'])
  })

  it('refuse une archive qui écrirait hors du dossier (zip slip)', async () => {
    const zip = new AdmZip()
    zip.addFile('overrides/ok.txt', Buffer.from('x'))
    // AdmZip normalise les noms à l'ajout : on force un nom malveillant comme dans une archive forgée.
    zip.addFile('overrides/placeholder', Buffer.from('evil'))
    zip.getEntry('overrides/placeholder')!.entryName = 'overrides/../../evil.txt'
    await assert.rejects(extractOverrides(zip, join(dir, 'jeu')), /refusé/)
    assert.deepEqual((await readdir(dir)).includes('evil.txt'), false)
  })
})
