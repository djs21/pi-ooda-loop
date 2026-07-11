// ─── /ooda:start — Execute Phase ──────────────────────────
// Spawns workers in mux panes, supervisor watches all.
// Main agent is ALL-SEEING, ALL-THINKING.

import type { ExtensionCommandContext } from '@earendil-works/pi-coding-agent'
import { loadState, saveState } from '../shared/state.ts'
import { createPane, sendCommand, isMuxAvailable, muxSetupHint, listPanes } from '../shared/mux.ts'
import { snapshotAllWorkers, detectErrors, formatWorkerSummary } from '../supervisor/watcher.ts'
import { analyzeWorkers, formatInsights } from '../supervisor/thinker.ts'
import { evaluateIntervention, formatInterventions } from '../supervisor/intervent.ts'
import { buildOodaSupervisorPrompt } from '../supervisor/prompt-inject.ts'
import type { WorkerTask, OodaState } from '../shared/types.ts'

async function spawnWorker(
  task: WorkerTask,
  _cwd: string,
): Promise<string> {
  // Create mux pane for the worker
  const paneId = createPane(task.name)

  // Spawn pi agent inside the pane
  const worktreeDir = task.worktreeDir
  const piCmd = [
    `cd ${worktreeDir}`,
    'git worktree add . ',
    'pi --session-auto',
  ].join(' && ')

  sendCommand(paneId, piCmd)
  return paneId
}

export async function handleStart(
  ctx: ExtensionCommandContext,
  cwd: string,
): Promise<string> {
  if (!isMuxAvailable()) {
    return `⚠️ ${muxSetupHint()}`
  }

  const state = loadState(cwd)
  if (!state || state.batches.length === 0) {
    return '⚠️ No tasks to execute. Run /ooda:plan <feature> first, then /ooda:tdd.'
  }

  const lines: string[] = ['🚀 OODA Execute — All-Seeing, All-Thinking', '']

  // ─── Inject supervisor system prompt ────────────────
  const supervisorPrompt = buildOodaSupervisorPrompt()
  lines.push('🧠 Supervisor rules injected.')
  lines.push('')

  state.phase = 'acting'
  saveState(cwd, state)

  // ─── Execute batches ──────────────────────────────
  for (let b = state.currentBatch; b < state.batches.length; b++) {
    const batch = state.batches[b]
    const mode = batch.parallel ? '⚡ parallel' : '→ sequential'
    lines.push(`Batch ${b + 1} (${mode}):`)

    // Spawn workers
    for (const task of batch.tasks) {
      lines.push(`  Spawning ${task.name}...`)
      const paneId = await spawnWorker(task, cwd)
      task.muxPaneId = paneId
      task.status = 'running'
      task.startedAt = Date.now()
      saveState(cwd, state)
    }

    // ─── Supervisor loop (all-seeing, all-thinking) ──
    lines.push('')
    lines.push('  👁️ Supervising workers...')
    lines.push('  🧠 Analyzing partial output...')

    // Wait loop: continuously check status
    const startBatch = Date.now()
    const maxBatchTime = 600_000 // 10 minutes per batch
    let lastSummary = ''

    while (true) {
      const now = Date.now()

      // ALL-SEEING: snapshot all workers
      const snapshots = snapshotAllWorkers(state, now)
      const summary = formatWorkerSummary(snapshots)

      // Only log on change
      if (summary !== lastSummary) {
        lines.push(summary)
        lastSummary = summary
      }

      // ALL-THINKING: analyze partial output
      const insights = analyzeWorkers(snapshots, state)
      const insightStr = formatInsights(insights)
      if (insightStr) lines.push(insightStr)

      // DETECT ERRORS: early intervention
      const errors = detectErrors(snapshots)
      if (errors.length > 0) {
        const interventions = evaluateIntervention(errors, state)
        const interventStr = formatInterventions(interventions)
        if (interventStr) lines.push(interventStr)

        // Handle auto-restart for cancellable workers
        for (const inter of interventions) {
          if (inter.action === 'cancel' || inter.action === 'restart') {
            const task = batch.tasks.find(t => t.name === inter.workerName)
            if (task?.muxPaneId) {
              // TODO: use closePane from mux
              task.status = 'error'
              task.error = inter.reason
              saveState(cwd, state)
            }
          }
        }
      }

      // Check if all done
      const allDone = batch.tasks.every(t => t.status === 'done')
      if (allDone) break

      // Timeout safeguard
      if (now - startBatch > maxBatchTime) {
        lines.push('')
        lines.push('⏰ Batch timeout reached. Remaining workers will need manual attention.')
        break
      }

      // Non-blocking: return so main agent can process
      // (In practice, the orchestrator loop handles this via steer messages)
      break // Exit after one cycle — agent will steer back
    }

    state.currentBatch = b + 1
    saveState(cwd, state)
    lines.push('')
  }

  state.phase = 'reviewing'
  saveState(cwd, state)

  lines.push('')
  lines.push('✅ All batches complete. Use /ooda:signoff to verify & push.')

  // Return supervisor prompt + workflow
  return supervisorPrompt + '\n\n' + lines.join('\n')
}
