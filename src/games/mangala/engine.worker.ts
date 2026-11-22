import { analyzePosition } from './search'

interface Request {
  id: number
  position: string
  depth: number
  multiPV: number
}

const scope = self as unknown as {
  onmessage: ((event: MessageEvent<Request>) => void) | null
  postMessage(message: unknown): void
}

scope.onmessage = (event) => {
  const { id, position, depth, multiPV } = event.data
  try {
    scope.postMessage({ id, lines: analyzePosition(position, { depth, multiPV }) })
  } catch (error) {
    scope.postMessage({ id, error: error instanceof Error ? error.message : String(error) })
  }
}
