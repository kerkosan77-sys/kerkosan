export class EngineCancelledError extends Error {
  constructor() {
    super('Motor işlemi iptal edildi.')
    this.name = 'EngineCancelledError'
  }
}
