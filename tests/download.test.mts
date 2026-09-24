import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { createServer, type ServerResponse } from 'node:http'
import type { AddressInfo } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { after, before, describe, it, mock } from 'node:test'
import { downloadFile, TIMEOUT_MS } from '../src/core/download'

// Serveur local qui envoie les en-têtes puis se tait : le test dicte ensuite quand il parle (ou pas).
// Les horloges de setTimeout sont simulées pour ne pas attendre de vraies périodes de 30 s.
let url = ''
let dir = ''
let waiting: ((res: ServerResponse) => void) | undefined
const server = createServer((_req, res) => {
  res.writeHead(200, { 'Content-Type': 'application/octet-stream' })
  res.flushHeaders()
  waiting?.(res)
})
const nextRequest = () => new Promise<ServerResponse>((resolve) => (waiting = resolve))
const tick = (ms: number) => mock.timers.tick(ms)
// Laisse le temps aux octets de traverser la boucle réseau (vraies E/S, horloge simulée).
const flush = () => new Promise((r) => setImmediate(r))

describe('délai des téléchargements', () => {
  before(async () => {
    await new Promise<void>((r) => server.listen(0, '127.0.0.1', r))
    url = `http://127.0.0.1:${(server.address() as AddressInfo).port}/f.jar`
    dir = await mkdtemp(join(tmpdir(), 'dl-test-'))
  })
  after(async () => {
    server.closeAllConnections()
    server.close()
    await rm(dir, { recursive: true, force: true })
  })

  it('abandonne un serveur muet avec un message qui le nomme', async () => {
    mock.timers.enable({ apis: ['setTimeout'] })
    try {
      const req = nextRequest()
      const dl = downloadFile({ url, dest: join(dir, 'muet.jar') }, 1)
      await req
      tick(TIMEOUT_MS)
      await assert.rejects(dl, /pas de réponse de 127\.0\.0\.1:\d+ depuis 30 s/)
    } finally {
      mock.timers.reset()
    }
  })

  it("ne coupe pas un téléchargement lent qui dure plus que le délai, tant que des données arrivent", async () => {
    mock.timers.enable({ apis: ['setTimeout'] })
    try {
      const req = nextRequest()
      const dest = join(dir, 'lent.jar')
      const dl = downloadFile({ url, dest }, 1)
      const res = await req
      for (let i = 0; i < 3; i++) {
        res.write(`morceau${i};`)
        for (let j = 0; j < 10; j++) await flush()
        tick(TIMEOUT_MS * 0.8) // 3 × 24 s = 72 s au total, jamais 30 s de silence
      }
      res.end()
      await dl
      assert.equal(await readFile(dest, 'utf8'), 'morceau0;morceau1;morceau2;')
    } finally {
      mock.timers.reset()
    }
  })
})
