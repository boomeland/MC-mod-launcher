import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { createLogDecoder } from '../src/core/log4j'

const ts = new Date(2026, 8, 21, 15, 13, 59).getTime()
const event = (msg: string, extra = '') =>
  `<log4j:Event logger="net.minecraft.server.MinecraftServer" timestamp="${ts}" level="INFO" thread="Server thread">\r\n` +
  `  <log4j:Message><![CDATA[${msg}]]></log4j:Message>${extra}\r\n</log4j:Event>\r\n`

describe('décodage des logs log4j', () => {
  it('transforme un événement XML en une ligne lisible', () => {
    assert.deepEqual(createLogDecoder()(event('Saving chunks')), ['[15:13:59] [Server thread/INFO] Saving chunks'])
  })

  it('recolle un événement coupé entre plusieurs morceaux', () => {
    const decode = createLogDecoder()
    const xml = event('Coupé <en> deux')
    assert.deepEqual(decode(xml.slice(0, 40)), [])
    assert.deepEqual(decode(xml.slice(40, 120)), [])
    assert.deepEqual(decode(xml.slice(120)), ['[15:13:59] [Server thread/INFO] Coupé <en> deux'])
  })

  it('ajoute la pile d\'une exception', () => {
    const line = createLogDecoder()(event('Boum', '<log4j:Throwable><![CDATA[java.lang.RuntimeException: x\n\tat A.b()\n]]></log4j:Throwable>'))
    assert.deepEqual(line, ['[15:13:59] [Server thread/INFO] Boum\njava.lang.RuntimeException: x\n\tat A.b()'])
  })

  it('laisse passer le texte simple et ignore les lignes vides', () => {
    const decode = createLogDecoder()
    assert.deepEqual(decode('[12:40:19] [Render thread/INFO] texte\r\n\r\n' + event('xml') + 'fin sans retour'), [
      '[12:40:19] [Render thread/INFO] texte',
      '[15:13:59] [Server thread/INFO] xml'
    ])
    assert.deepEqual(decode(' de ligne\n'), ['fin sans retour de ligne'])
  })
})
