// La config log4j de Mojang (json.logging, passée au lancement) écrit la console du jeu en XML (LegacyXMLLayout),
// pensé pour être analysé par un launcher : ~5 lignes par message. On ne peut pas s'en passer, car c'est elle qui corrige
// Log4Shell sur les anciennes versions (%msg{nolookups}). On la décode donc en lignes lisibles « [heure] [thread/NIVEAU] message ».
// Les sorties en texte simple (NeoForge et d'autres remplacent la config) passent telles quelles.

const EVENT_END = '</log4j:Event>'

const attr = (tag: string, name: string) => tag.match(new RegExp(`${name}="([^"]*)"`))?.[1] ?? ''
const cdata = (xml: string, tag: string) =>
  xml.match(new RegExp(`<log4j:${tag}><!\\[CDATA\\[([\\s\\S]*?)\\]\\]></log4j:${tag}>`))?.[1]

function formatEvent(xml: string): string {
  const open = xml.slice(0, xml.indexOf('>'))
  const time = new Date(Number(attr(open, 'timestamp'))).toTimeString().slice(0, 8)
  const throwable = cdata(xml, 'Throwable')
  const message = (cdata(xml, 'Message') ?? '') + (throwable ? `\n${throwable.trimEnd()}` : '')
  return `[${time}] [${attr(open, 'thread')}/${attr(open, 'level')}] ${message}`
}

/**
 * Décodeur à état : reçoit la sortie du jeu par morceaux (un événement XML peut être coupé entre deux morceaux)
 * et renvoie les lignes complètes prêtes à afficher.
 */
export function createLogDecoder(): (chunk: string) => string[] {
  let buf = ''
  return (chunk) => {
    buf += chunk
    const out: string[] = []
    for (;;) {
      const start = buf.indexOf('<log4j:Event')
      const nl = buf.indexOf('\n')
      if (start === -1 || (nl !== -1 && nl < start)) {
        // Ligne de texte simple avant le prochain événement XML : on attend qu'elle soit complète.
        if (nl === -1) break
        const line = buf.slice(0, nl).trimEnd()
        buf = buf.slice(nl + 1)
        if (line.trim()) out.push(line)
        continue
      }
      const end = buf.indexOf(EVENT_END, start)
      if (end === -1) break
      out.push(formatEvent(buf.slice(start, end)))
      buf = buf.slice(end + EVENT_END.length)
    }
    return out
  }
}
