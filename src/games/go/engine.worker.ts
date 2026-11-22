import { analyzeGo, chooseGoMove } from './bot'
import { hashString, makeRng } from './fastboard'
import { getLevel } from './levels'

type Request =
  | { id: number; type: 'analyze'; position: string; playouts: number; multiPV: number }
  | { id: number; type: 'choose'; position: string; level: number }

const scope = self as unknown as {
  onmessage: ((event: MessageEvent<Request>) => void) | null
  postMessage(message: unknown): void
}

scope.onmessage = (event) => {
  const request = event.data
  try {
    if (request.type === 'analyze') {
      // Seeded by the position: analysing the same position again gives the same answer.
      const rng = makeRng(hashString(`${request.position} ${request.playouts}`))
      const { lines, ownership } = analyzeGo(request.position, { playouts: request.playouts, multiPV: request.multiPV }, rng)
      scope.postMessage({ id: request.id, lines, ownership })
    } else {
      scope.postMessage({ id: request.id, move: chooseGoMove(request.position, getLevel(request.level)) })
    }
  } catch (error) {
    scope.postMessage({ id: request.id, error: error instanceof Error ? error.message : String(error) })
  }
}
