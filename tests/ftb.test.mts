import assert from 'node:assert/strict'
import { join, resolve } from 'node:path'
import { describe, it } from 'node:test'
import { ftbDownloads, toFtbVersion, type ApiFile } from '../src/core/modpacks/ftb'

const version = (mc: string, loader: string, loaderVersion = '1.0') => ({
  id: 1,
  name: '1.0.0',
  type: 'release',
  private: false,
  specs: { minimum: 4096, recommended: 6144 },
  targets: [
    { name: 'minecraft', version: mc, type: 'game' },
    { name: loader, version: loaderVersion, type: 'modloader' },
    { name: 'java', version: '17', type: 'runtime' }
  ]
})

const file = (path: string, name: string, serveronly = false): ApiFile => ({
  path,
  name,
  url: `https://example.invalid/${name}`,
  sha1: 'x',
  size: 1,
  serveronly
})

describe('versions FTB', () => {
  it('lit Minecraft, le loader et la RAM recommandée', () => {
    const v = toFtbVersion(version('1.20.1', 'forge', '47.4.20'))
    assert.deepEqual(
      [v.mcVersion, v.loader, v.loaderVersion, v.recommendedMemoryMb, v.supported],
      ['1.20.1', 'forge', '47.4.20', 6144, true]
    )
  })

  it('prend en charge Forge, NeoForge et Fabric à partir de 1.10, et le versionnage par année', () => {
    for (const [mc, loader] of [['1.10.2', 'forge'], ['1.12.2', 'forge'], ['1.21.1', 'neoforge'], ['1.16.5', 'fabric'], ['26.1.2', 'neoforge']]) {
      assert.ok(toFtbVersion(version(mc, loader)).supported, `${mc} ${loader}`)
    }
  })

  it('refuse Minecraft ≤ 1.9 (assets legacy, pas d\'installer Forge) et les loaders inconnus', () => {
    for (const [mc, loader] of [['1.7.10', 'forge'], ['1.6.4', 'forge'], ['1.4.7', 'forge'], ['1.20.1', 'quilt']]) {
      assert.ok(!toFtbVersion(version(mc, loader)).supported, `${mc} ${loader}`)
    }
  })
})

describe('fichiers FTB', () => {
  const gameDir = resolve('instance-test', 'minecraft')

  it('place les fichiers sous le dossier de jeu et ignore ceux réservés au serveur', () => {
    const items = ftbDownloads(gameDir, [file('./mods', 'a.jar'), file('./config/sub', 'b.toml'), file('./', 'server.properties', true)])
    assert.deepEqual(items.map((i) => i.dest), [join(gameDir, 'mods', 'a.jar'), join(gameDir, 'config', 'sub', 'b.toml')])
  })

  it('refuse tout chemin qui sort du dossier de l\'instance', () => {
    const bad = [file('./../..', 'evil.jar'), file('./mods', '../../evil.jar'), file(resolve('/'), 'evil.jar'), file('./', '')]
    for (const f of bad) assert.throws(() => ftbDownloads(gameDir, [file('./mods', 'ok.jar'), f]), /refusé/, `${f.path} + ${f.name}`)
  })
})
