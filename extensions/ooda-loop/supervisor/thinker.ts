// ─── Supervisor: All-Thinking Thinker ──────────────────────
// While workers run, main agent uses this to analyze partial output,
// prepare next batch inputs, and detect early warning signs.

import type { OodaState } from '../shared/types'
import type { WorkerSnapshot } from './watcher'

export interface ThinkingInsight {
  type: 'warning' | 'ready' | 'error' | 'info'
  message: string
  sourceWorker?: string
}

/**
 * Analyze worker snapshots and produce insights.
 * Called by the main agent (not polled — reactive after worker status change).
 */
export function analyzeWorkers(
  snapshots: WorkerSnapshot[],
  state: OodaState,
): ThinkingInsight[] {
  const insights: ThinkingInsight[] = []

  // 1. Prepare next batch inputs from completed workers
  const currentBatch = state.batches[state.currentBatch]
  if (currentBatch) {
    const allDone = currentBatch.tasks.every(t => t.status === 'done')
    if (allDone) {
      const nextBatch = state.batches[state.currentBatch + 1]
      if (nextBatch) {
        insights.push({
          type: 'ready',
          message: `Batch ${state.currentBatch + 1} complete. Next batch (${nextBatch.tasks.length} tasks, ${nextBatch.parallel ? 'parallel' : 'sequential'}) ready to start.`,
        })
      }
    }
  }

  // 2. Detect errors early
  for (const snap of snapshots) {
    if (snap.status === 'error') {
      insights.push({
        type: 'error',
        message: `Worker '${snap.name}' failed: ${snap.error}`,
        sourceWorker: snap.name,
      })
    }
  }

  // 3. Stalled workers (running > 5min, no progress)
  for (const snap of snapshots) {
    if (snap.status === 'running' && snap.elapsedMs > 300_000) {
      const outputLen = snap.lastOutput.trim().length
      if (outputLen < 50) {
        insights.push({
          type: 'warning',
          message: `Worker '${snap.name}' may be stalled (${(snap.elapsedMs / 1000).toFixed(0)}s, little output). Consider checking.`,
          sourceWorker: snap.name,
        })
      }
    }
  }

  // 4. Ready to merge insight
  const doneCount = snapshots.filter(s => s.status === 'done').length
  const totalCount = snapshots.length
  if (doneCount > 0 && doneCount < totalCount) {
    insights.push({
      type: 'info',
      message: `${doneCount}/${totalCount} workers done. ${totalCount - doneCount} remaining.`,
    })
  }

  // 5. Partial output analysis (heuristic)
  for (const snap of snapshots) {
    if (snap.status === 'running') {
      const output = snap.lastOutput
      if (/test.*pass/i.test(output)) {
        insights.push({
          type: 'info',
          message: `Worker '${snap.name}' tests passing.`,
          sourceWorker: snap.name,
        })
      }
      if (/test.*fail/i.test(output)) {
        insights.push({
          type: 'warning',
          message: `Worker '${snap.name}' has test failures.`,
          sourceWorker: snap.name,
        })
      }
    }
  }

  return insights
}

export function formatInsights(insights: ThinkingInsight[]): string {
  if (insights.length === 0) return ''

  const icons: Record<string, string> = {
    error: '❌',
    warning: '⚠️',
    ready: '✅',
    info: 'ℹ️',
  }

  return [
    '',
    '🧠 OODA Thinker:',
    ...insights.map(i => `  ${icons[i.type] ?? '•'} ${i.message}`),
    '',
  ].join('\n')
}
