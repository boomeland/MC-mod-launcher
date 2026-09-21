import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { neoforgeVersionsFor } from '../src/core/loaders/neoforge'

// Extrait réel du maven-metadata.xml de NeoForge : non trié, avec des bêtas et une version poisson d'avril.
const MAVEN = [
  '20.2.12-beta', '21.0.167', '21.1.9', '21.1.99', '21.1.251', '21.10.5',
  '26.1.0.3', '26.1.2.108', '26.2.0.85', '26.1.2.109', '26.3.0.6-beta', '26.3.0.7-beta', '0.25w14craftmine.3'
]

describe('versions NeoForge', () => {
  it('associe un Minecraft 1.x à ses versions, triées de la plus récente à la plus ancienne', () => {
    assert.deepEqual(neoforgeVersionsFor('1.21.1', MAVEN).versions, ['21.1.251', '21.1.99', '21.1.9'])
  })

  it('complète un Minecraft sans patch ("1.21" → 21.0.x) sans confondre 21.1 et 21.10', () => {
    assert.deepEqual(neoforgeVersionsFor('1.21', MAVEN).versions, ['21.0.167'])
    assert.deepEqual(neoforgeVersionsFor('1.21.10', MAVEN).versions, ['21.10.5'])
  })

  it('gère le versionnage par année de Mojang (trois composantes)', () => {
    assert.deepEqual(neoforgeVersionsFor('26.1', MAVEN).versions, ['26.1.0.3'])
    assert.deepEqual(neoforgeVersionsFor('26.1.2', MAVEN).versions, ['26.1.2.109', '26.1.2.108'])
  })

  it('recommande la plus récente hors bêta, et rien s\'il n\'y a que des bêtas', () => {
    assert.equal(neoforgeVersionsFor('1.21.1', MAVEN).recommended, '21.1.251')
    const betas = neoforgeVersionsFor('26.3', MAVEN)
    assert.equal(betas.recommended, undefined)
    assert.equal(betas.latest, '26.3.0.7-beta')
  })

  it('ne propose rien pour un Minecraft sans NeoForge (1.20.1, snapshot)', () => {
    assert.deepEqual(neoforgeVersionsFor('1.20.1', MAVEN).versions, [])
    assert.deepEqual(neoforgeVersionsFor('25w14a', MAVEN).versions, [])
  })
})
