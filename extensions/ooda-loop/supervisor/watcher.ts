// ─── Supervisor: All-Seeing Watcher ─────────────────────────
// Real-time monitoring of all worker panes.
// Main agent uses this to "see" what workers are doing without polling.

import { readPaneOutput, listPanes, closePane } from '../shared/mux.ts'
import type { WorkerTask, WorkerBatch, OodaState } from '../shared/types.ts'

export interface WorkerSnapshot {
  taskId: string
  name: string
  status: string
  lastOutput: string
  error?: string
  elapsedMs: number
  muxPaneId?: string
}

export function snapshotAllWorkers(state: OodaState, now: number): WorkerSnapshot[] {
  const snapshots: WorkerSnapshot[] = []
  const allPanes = listPanes()

  for (const batch of state.batches) {
    for (const task of batch.tasks) {
      const pane = allPanes.find(p => p.id === task.muxPaneId)
      const lastOutput = task.muxPaneId ? readPaneOutput(task.muxPaneId, 20) : ''
      const elapsed = now - (task.startedAt ?? now)

      snapshots.push({
        taskId: task.id,
        name: task.name,
        status: task.status,
        lastOutput: lastOutput.slice(0, 500),
        error: task.error,
        elapsedMs: elapsed,
        muxPaneId: task.muxPaneId,
      })
    }
  }

  return snapshots
}

export function detectErrors(snapshots: WorkerSnapshot[]): WorkerSnapshot[] {
  return snapshots.filter(s => {
    if (s.status === 'error') return true
    // Heuristic: "exit code 1", "Error:", "FAIL" in last output
    const output = s.lastOutput
    if (/exit code \d+|Error:|FAIL|Cannot|not found/i.test(output)) return true
    // Stalled: running > 5 minutes with no meaningful output
    if (s.status === 'running' && s.elapsedMs > 300_000 && output.trim().length < 10) return true
    return false
  })
}

export function formatWorkerSummary(snapshots: WorkerSnapshot[]): string {
  const parts = snapshots.map(s => {
    const elapsed = (s.elapsedMs / 1000).toFixed(0)
    const statusIcon = s.status === 'done' ? '✅' : s.status === 'error' ? '❌' : s.status === 'running' ? '🔄' : '⏳'
    const outputSnippet = s.lastOutput.trim() ? `\n    ${s.lastOutput.trim().split('\n').slice(-3).join('\n    ')}` : ''
    return `${statusIcon} ${s.name} [${elapsed}s] ${s.status}${s.error ? ' — ' + s.error : ''}${outputSnippet}`
  })

  return [
    '',
    '┌── OODA Supervisor ──────────────────────────────┐',
    ...parts.map(p => `  ${p}`),
    '└──────────────────────────────────────────────────┘',
    '',
  ].join('\n')
}
