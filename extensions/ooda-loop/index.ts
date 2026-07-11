// ─── OODA Loop Extension — Composition Root ──────────────

import type { ExtensionAPI, ExtensionContext, ExtensionCommandContext } from '@earendil-works/pi-coding-agent'
import { handlePlan } from './plan/handler'
import { handleTdd } from './tdd/handler'
import { handleStart } from './start/handler'
import { handleSignoff } from './signoff/handler'
import { loadState, saveState, clearState } from './shared/state'
import { isMuxAvailable, muxSetupHint, listPanes, readPaneOutput } from './shared/mux'
import { snapshotAllWorkers, formatWorkerSummary } from './supervisor/watcher'
import { analyzeWorkers, formatInsights } from './supervisor/thinker'
import { gatherContext, formatContext } from './supervisor/all-knowing'
import { buildOrchestratorPrompt } from './supervisor/ooda-brain'

export function activate(api: ExtensionAPI, ctx: ExtensionContext): void {
  const cwd = ctx.cwd

  // ─── System Prompt Injection ──────────────────────────
  api.on('before_agent_start', async (_event: unknown) => {
    const state = loadState(cwd)
    if (state?.oodaMode) {
      return { systemPrompt: buildOrchestratorPrompt() }
    }
  })

  // ─── OODA Mode Activation ─────────────────────────────

  api.registerCommand('ooda:activate', {
    description: 'Aktifkan OODA Orchestrator Mode — agent jadi all-seeing, all-knowing, all-thinking',
    handler: async (_args: string, cmdCtx: ExtensionCommandContext) => {
      let state = loadState(cwd)
      if (!state) state = createNewState()
      state.oodaMode = true
      state.phase = 'observing'
      saveState(cwd, state)

      // Gather context immediately
      const env = gatherContext(cwd)

      cmdCtx.ui.notify([
        '🎯 OODA Orchestrator Mode ACTIVE',
        '',
        'Aku jadi ALL-SEEING, ALL-KNOWING, ALL-THINKING.',
        'Setiap request bakal otomatis melalui siklus OODA.',
        'Gak ada lagi kerja langsung — semuanya didelegasi.',
        '',
        formatContext(env),
        '',
        'Kirim task lo. Aku bakal Observe → Orient → Decide → Act → Review.',
      ].join('\n'), 'info')
    },
  })

  api.registerCommand('ooda:deactivate', {
    description: 'Nonaktifkan OODA Orchestrator Mode — kembali ke mode normal',
    handler: async (_args: string, cmdCtx: ExtensionCommandContext) => {
      let state = loadState(cwd)
      if (!state) state = createNewState()
      state.oodaMode = false
      state.phase = 'idle'
      saveState(cwd, state)

      cmdCtx.ui.notify('OODA Orchestrator Mode DEACTIVATED. Kembali ke mode normal.', 'info')
    },
  })

  api.registerCommand('ooda:context', {
    description: 'Tampilkan environment context — git, branch, test, mux, dll',
    handler: async (_args: string, cmdCtx: ExtensionCommandContext) => {
      const env = gatherContext(cwd)
      cmdCtx.ui.notify(formatContext(env), 'info')
    },
  })

  // ─── OODA Cycle Commands ─────────────────────────────

  api.registerCommand('ooda:plan', {
    description: 'OODA Plan — scout, PRD, plan, task grouping, batch design',
    handler: async (args: string, cmdCtx: ExtensionCommandContext) => {
      const state = loadState(cwd)
      if (!state?.oodaMode) {
        cmdCtx.ui.notify('⚠️ OODA mode tidak aktif. Jalankan /ooda:activate dulu.', 'warning')
        return
      }
      const feature = args.trim() || 'unnamed-feature'
      cmdCtx.ui.notify(await handlePlan(feature, cmdCtx, cwd), 'info')
    },
  })

  api.registerCommand('ooda:tdd', {
    description: 'OODA TDD — design RED-GREEN-REFACTOR gates per task',
    handler: async (args: string, cmdCtx: ExtensionCommandContext) => {
      const state = loadState(cwd)
      if (!state?.oodaMode) {
        cmdCtx.ui.notify('⚠️ OODA mode tidak aktif. Jalankan /ooda:activate dulu.', 'warning')
        return
      }
      cmdCtx.ui.notify(await handleTdd(args, cmdCtx, cwd), 'info')
    },
  })

  api.registerCommand('ooda:start', {
    description: 'OODA Execute — spawn workers in mux panes, all-seeing supervision',
    handler: async (_args: string, cmdCtx: ExtensionCommandContext) => {
      if (!isMuxAvailable()) {
        cmdCtx.ui.notify(`⚠️ ${muxSetupHint()}`, 'warning')
        return
      }
      cmdCtx.ui.notify(await handleStart(cmdCtx, cwd), 'info')
    },
  })

  api.registerCommand('ooda:signoff', {
    description: 'OODA Sign-off — merge, push, archive, close issues',
    handler: async (_args: string, cmdCtx: ExtensionCommandContext) => {
      cmdCtx.ui.notify(await handleSignoff(cmdCtx, cwd), 'info')
    },
  })

  // ─── Supervision Commands ─────────────────────────────

  api.registerCommand('ooda:status', {
    description: 'OODA Status — show all worker panes, output, and insights',
    handler: async (_args: string, cmdCtx: ExtensionCommandContext) => {
      const state = loadState(cwd)
      if (!state || state.phase === 'idle') {
        cmdCtx.ui.notify('No active OODA session.', 'info')
        return
      }
      const now = Date.now()
      const snapshots = snapshotAllWorkers(state, now)
      const insights = analyzeWorkers(snapshots, state)
      cmdCtx.ui.notify([
        formatWorkerSummary(snapshots),
        formatInsights(insights),
        `Phase: ${state.phase} | Batches: ${state.batches.length} | Current: ${state.currentBatch}`,
      ].join('\n'), 'info')
    },
  })

  api.registerCommand('ooda:read', {
    description: 'OODA Read — show output from a specific worker pane',
    handler: async (args: string, cmdCtx: ExtensionCommandContext) => {
      const workerId = args.trim()
      if (!workerId) { cmdCtx.ui.notify('Usage: /ooda:read <worker-id>', 'warning'); return }
      const panes = listPanes()
      const target = panes.find(p => p.id === workerId || p.label === workerId)
      if (!target) {
        cmdCtx.ui.notify(`No pane found: ${workerId}. Available: ${panes.map(p => p.id).join(', ')}`, 'warning')
        return
      }
      cmdCtx.ui.notify(`📄 Output from ${target.id}:\n\n${readPaneOutput(target.id, 100)}`, 'info')
    },
  })

  api.registerCommand('ooda:reset', {
    description: 'OODA Reset — clear session state',
    handler: async (_args: string, cmdCtx: ExtensionCommandContext) => {
      clearState(cwd)
      cmdCtx.ui.notify('🔄 OODA session reset.', 'info')
    },
  })

  // ─── Tool for the Agent ────────────────────────────
  api.registerTool({
    name: 'ooda_status',
    label: 'OODA Status',
    description: 'Show current OODA cycle status — workers, batches, insights',
    promptSnippet: 'Check the status of all running OODA workers',
    parameters: {},
    execute: async () => {
      const state = loadState(cwd)
      if (!state || state.phase === 'idle') {
        return { content: [{ type: 'text', text: '{"phase":"idle"}' }], details: {} }
      }
      const now = Date.now()
      const snapshots = snapshotAllWorkers(state, now)
      const insights = analyzeWorkers(snapshots, state)
      return {
        content: [{ type: 'text', text: JSON.stringify({
          phase: state.phase,
          feature: state.feature,
          oodaMode: state.oodaMode,
          batches: state.batches.length,
          currentBatch: state.currentBatch,
          context: gatherContext(cwd),
          workers: snapshots.map(s => ({
            name: s.name,
            status: s.status,
            elapsedMs: s.elapsedMs,
            lastOutputSnippet: s.lastOutput.slice(0, 200),
            error: s.error,
          })),
          insights,
        }) }],
        details: {},
      }
    },
  })
}

function createNewState() {
  return {
    phase: 'observing' as const,
    feature: '',
    oodaMode: false,
    batches: [],
    currentBatch: 0,
    artifacts: [],
  }
}
