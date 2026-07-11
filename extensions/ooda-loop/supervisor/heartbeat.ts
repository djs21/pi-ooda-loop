import type { ExtensionAPI } from '@earendil-works/pi-coding-agent'

interface SupervisorHeartbeatState {
  intervalMs: number
  tick: number
  startedAt: string
}

export class SupervisorHeartbeat {
  private _state: (SupervisorHeartbeatState & { interval: NodeJS.Timeout }) | null = null

  constructor(private pi: ExtensionAPI) {}

  start(intervalSeconds: number): string {
    this.stop() // Only one at a time

    const intervalMs = intervalSeconds * 1000
    const startedAt = new Date().toISOString()
    let tick = 0

    const interval = setInterval(() => {
      tick++
      this.pi.sendMessage(
        {
          customType: 'ooda-supervisor-ping',
          content: `🔍 OODA Supervisor check #${tick}`,
          display: true,
          details: {
            type: 'supervisor-ping',
            tick,
            intervalSeconds,
          },
        },
        { triggerTurn: true }
      )
    }, intervalMs)

    this._state = { intervalMs, tick, startedAt, interval }

    return `Supervision heartbeat started — every ${intervalSeconds}s (tick #0)`
  }

  stop(): string | null {
    if (!this._state) return null
    clearInterval(this._state.interval)
    const ticks = this._state.tick
    this._state = null
    return `Supervision stopped after ${ticks} tick(s)`
  }

  getState() {
    if (!this._state) return null
    return {
      active: true,
      intervalMs: this._state.intervalMs,
      tick: this._state.tick,
      startedAt: this._state.startedAt,
    }
  }

  isActive(): boolean {
    return this._state !== null
  }
}
