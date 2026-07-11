// ─── Supervisor: Intervention Logic ─────────────────────────

import type { OodaState } from '../shared/types'
import type { WorkerSnapshot } from './watcher'

export interface Intervention {
  action: 'ignore' | 'restart' | 'cancel' | 'replan' | 'alert'
  reason: string
  workerName?: string
}

export function evaluateIntervention(
  errors: WorkerSnapshot[],
  _state: OodaState,
): Intervention[] {
  const interventions: Intervention[] = []

  for (const err of errors) {
    // Error worker with partial output
    if (err.status === 'error' && err.lastOutput.length > 100) {
      interventions.push({
        action: 'restart',
        reason: `Worker '${err.name}' has partial output — salvageable. Restart with context.`,
        workerName: err.name,
      })
      continue
    }

    // Stalled worker
    if (err.status === 'running' && err.elapsedMs > 300_000 && err.lastOutput.trim().length < 20) {
      interventions.push({
        action: 'cancel',
        reason: `Worker '${err.name}' stalled (${(err.elapsedMs / 1000).toFixed(0)}s, no output). Cancel and reassess.`,
        workerName: err.name,
      })
      continue
    }

    // Worker that failed immediately
    if (err.status === 'error' && err.lastOutput.trim().length < 100) {
      interventions.push({
        action: 'restart',
        reason: `Worker '${err.name}' failed early. Likely environment issue. Restart fresh.`,
        workerName: err.name,
      })
      continue
    }

    // Default: alert but let continue
    interventions.push({
      action: 'alert',
      reason: `Worker '${err.name}' needs attention.`,
      workerName: err.name,
    })
  }

  return interventions
}

export function formatInterventions(interventions: Intervention[]): string {
  if (interventions.length === 0) return ''
  return [
    '',
    '🛑 OODA Interventions:',
    ...interventions.map(i => {
      const icon = i.action === 'restart' ? '🔄' : i.action === 'cancel' ? '🗑️' : i.action === 'replan' ? '📋' : '⚠️'
      return `  ${icon} [${i.action}] ${i.reason}`
    }),
    'Use /ooda:start to restart cancelled workers.',
    '',
  ].join('\n')
}
