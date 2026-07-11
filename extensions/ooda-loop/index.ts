// ─── OODA Loop Extension — Composition Root ──────────────

import type { ExtensionAPI, ExtensionCommandContext } from '@earendil-works/pi-coding-agent'
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
import { loadConfig, saveLocalConfig, saveGlobalConfig, clearLocalConfig, clearGlobalConfig, getBlockedTools, formatConfig, DEFAULT_CONFIG } from './shared/config'
import type { OodaPhase } from './shared/types'
import { SupervisorHeartbeat } from './supervisor/heartbeat'

export default function (pi: ExtensionAPI) {
  // ─── Supervisor Heartbeat ──────────────────────────
  const heartbeat = new SupervisorHeartbeat(pi)
  pi.on('session_shutdown', () => { heartbeat.stop(); })
  // ─── System Prompt Injection ──────────────────────────
  pi.on('before_agent_start', async (_event: unknown, ctx: any) => {
    const cwd = ctx.cwd
    const state = loadState(cwd)
    const config = loadConfig(cwd)

    // Auto-activate if configured and no active state
    if (config.autoActivate && (!state || !state.oodaMode)) {
      const newState = state || createNewState()
      newState.oodaMode = true
      newState.phase = newState.phase === 'idle' ? 'observing' : newState.phase
      saveState(cwd, newState)
    }

    const activeState = loadState(cwd)
    if (activeState?.oodaMode) {
      // Block tools per phase
      const blocked = getBlockedTools(config, activeState.phase)
      if (blocked.length > 0) {
        const active = pi.getActiveTools()
        const filtered = active.filter((t: string) => !blocked.includes(t))
        pi.setActiveTools(filtered)
      }
      return { systemPrompt: buildOrchestratorPrompt() + '\n\n## OODA Supervise Tool\nUse `ooda_supervise` to start/stop periodic supervision heartbeat during acting phase. This schedules automatic worker checks so you don\'t need blocking sleeps.' }
    }
  })

  // ─── OODA Mode Activation ─────────────────────────────

  pi.registerCommand('ooda:activate', {
    description: 'Aktifkan OODA Orchestrator Mode — agent jadi all-seeing, all-knowing, all-thinking',
    handler: async (_args: string, cmdCtx: ExtensionCommandContext) => {
      const cwd = cmdCtx.cwd
      let state = loadState(cwd)
      if (!state) state = createNewState()
      state.oodaMode = true
      state.phase = 'observing'
      saveState(cwd, state)

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

  pi.registerCommand('ooda:deactivate', {
    description: 'Nonaktifkan OODA Orchestrator Mode — kembali ke mode normal',
    handler: async (_args: string, cmdCtx: ExtensionCommandContext) => {
      const cwd = cmdCtx.cwd
      let state = loadState(cwd)
      if (!state) state = createNewState()
      state.oodaMode = false
      state.phase = 'idle'
      saveState(cwd, state)
      cmdCtx.ui.notify('OODA Orchestrator Mode DEACTIVATED. Kembali ke mode normal.', 'info')
    },
  })

  pi.registerCommand('ooda:context', {
    description: 'Tampilkan environment context — git, branch, test, mux, dll',
    handler: async (_args: string, cmdCtx: ExtensionCommandContext) => {
      cmdCtx.ui.notify(formatContext(gatherContext(cmdCtx.cwd)), 'info')
    },
  })

  pi.registerCommand('ooda:config', {
    description: 'OODA Config — interactive menu — view/set autoActivate, blockTools per phase',
    handler: async (args: string, cmdCtx: ExtensionCommandContext) => {
      const cwd = cmdCtx.cwd
      const parts = args.trim().split(/\s+/)

      // CLI mode if args provided
      if (parts.length > 0 && parts[0] !== '') {
        const sub = parts[0]

        // /ooda:config autoActivate [true|false] [--global]
        if (sub === 'autoActivate') {
          const val = parts[1]
          if (val !== 'true' && val !== 'false') {
            cmdCtx.ui.notify('Usage: /ooda:config autoActivate true|false [--global]', 'warning')
            return
          }
          const isGlobal = parts.includes('--global')
          const config = isGlobal ? loadConfig(cwd) : { ...DEFAULT_CONFIG }
          config.autoActivate = val === 'true'
          if (isGlobal) saveGlobalConfig(config)
          else saveLocalConfig(cwd, config)
          cmdCtx.ui.notify(`autoActivate → ${val}${isGlobal ? ' (global)' : ' (local)'}`, 'info')
          return
        }

        if (sub === 'block') {
          const phase = parts[1] as OodaPhase
          const tools = parts.slice(2).filter(p => p !== '--global')
          const isGlobal = parts.includes('--global')
          if (!phase || tools.length === 0) {
            cmdCtx.ui.notify('Usage: /ooda:config block <phase> <tool...> [--global]', 'warning')
            return
          }
          const config = loadConfig(cwd)
          const blocked = config.blockTools[phase] || []
          config.blockTools[phase] = [...new Set([...blocked, ...tools])]
          if (isGlobal) saveGlobalConfig(config)
          else saveLocalConfig(cwd, config)
          cmdCtx.ui.notify(`🔒 ${phase}: ${config.blockTools[phase]!.join(', ')}${isGlobal ? ' (global)' : ' (local)'}`, 'info')
          return
        }

        if (sub === 'unblock') {
          const phase = parts[1] as OodaPhase
          const tools = parts.slice(2).filter(p => p !== '--global')
          const isGlobal = parts.includes('--global')
          if (!phase || tools.length === 0) {
            cmdCtx.ui.notify('Usage: /ooda:config unblock <phase> <tool...> [--global]', 'warning')
            return
          }
          const config = loadConfig(cwd)
          const blocked = config.blockTools[phase] || []
          config.blockTools[phase] = blocked.filter((t: string) => !tools.includes(t))
          if (isGlobal) saveGlobalConfig(config)
          else saveLocalConfig(cwd, config)
          cmdCtx.ui.notify(`🔓 ${phase}: ${config.blockTools[phase]!.join(', ') || 'none'}${isGlobal ? ' (global)' : ' (local)'}`, 'info')
          return
        }

        // /ooda:config clear [--global]
        if (sub === 'clear') {
          const isGlobal = parts.includes('--global')
          if (isGlobal) clearGlobalConfig()
          else clearLocalConfig(cwd)
          cmdCtx.ui.notify(`Config reset to defaults${isGlobal ? ' (global)' : ' (local)'}`, 'info')
          return
        }

        // Unknown subcommand
        cmdCtx.ui.notify(`Unknown subcommand: ${sub}. Use: autoActivate, block, unblock, clear`, 'warning')
        return
      }

      // Interactive mode
      await handleConfigInteractive(cwd, cmdCtx)
    },
  })

  // ─── OODA Cycle Commands ─────────────────────────────

  pi.registerCommand('ooda:plan', {
    description: 'OODA Plan — scout, PRD, plan, task grouping, batch design',
    handler: async (args: string, cmdCtx: ExtensionCommandContext) => {
      const cwd = cmdCtx.cwd
      const state = loadState(cwd)
      if (!state?.oodaMode) {
        cmdCtx.ui.notify('⚠️ OODA mode tidak aktif. Jalankan /ooda:activate dulu.', 'warning')
        return
      }
      const feature = args.trim() || 'unnamed-feature'
      cmdCtx.ui.notify(await handlePlan(feature, cmdCtx, cwd), 'info')
    },
  })

  pi.registerCommand('ooda:tdd', {
    description: 'OODA TDD — design RED-GREEN-REFACTOR gates per task',
    handler: async (args: string, cmdCtx: ExtensionCommandContext) => {
      const cwd = cmdCtx.cwd
      const state = loadState(cwd)
      if (!state?.oodaMode) {
        cmdCtx.ui.notify('⚠️ OODA mode tidak aktif. Jalankan /ooda:activate dulu.', 'warning')
        return
      }
      cmdCtx.ui.notify(await handleTdd(args, cmdCtx, cwd), 'info')
    },
  })

  pi.registerCommand('ooda:start', {
    description: 'OODA Execute — spawn workers in mux panes, all-seeing supervision',
    handler: async (_args: string, cmdCtx: ExtensionCommandContext) => {
      if (!isMuxAvailable()) {
        cmdCtx.ui.notify(`⚠️ ${muxSetupHint()}`, 'warning')
        return
      }
      cmdCtx.ui.notify(await handleStart(cmdCtx, cmdCtx.cwd), 'info')
    },
  })

  pi.registerCommand('ooda:signoff', {
    description: 'OODA Sign-off — merge, push, archive, close issues',
    handler: async (_args: string, cmdCtx: ExtensionCommandContext) => {
      cmdCtx.ui.notify(await handleSignoff(cmdCtx, cmdCtx.cwd), 'info')
    },
  })

  // ─── Supervision Commands ─────────────────────────────

  pi.registerCommand('ooda:status', {
    description: 'OODA Status — show all worker panes, output, and insights',
    handler: async (_args: string, cmdCtx: ExtensionCommandContext) => {
      const cwd = cmdCtx.cwd
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

  pi.registerCommand('ooda:read', {
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

  pi.registerCommand('ooda:reset', {
    description: 'OODA Reset — clear session state',
    handler: async (_args: string, cmdCtx: ExtensionCommandContext) => {
      clearState(cmdCtx.cwd)
      cmdCtx.ui.notify('🔄 OODA session reset.', 'info')
    },
  })

  // ─── Tool for the Agent ────────────────────────────
  pi.registerTool({
    name: 'ooda_status',
    label: 'OODA Status',
    description: 'Show current OODA cycle status — workers, batches, insights',
    promptSnippet: 'Check the status of all running OODA workers',
    parameters: {},
    execute: async () => {
      const cwd = process.cwd()
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

  // ─── Supervise Tool for the Agent ────────────────────
  pi.registerTool({
    name: 'ooda_supervise',
    label: 'OODA Supervise',
    description: 'Start/stop periodic supervision heartbeat during acting phase. Agent calls this to schedule automatic worker checks.',
    promptSnippet: 'Use ooda_supervise to start/stop periodic worker checks instead of blocking sleep',
    parameters: {
      action: { type: 'string', enum: ['start', 'stop', 'status'], description: 'start=begin periodic checks, stop=cancel, status=show current state' },
      interval_seconds: { type: 'number', description: 'Seconds between checks (15-300, default 30)', default: 30 },
    },
    execute: async (_id: string, params: { action: string; interval_seconds?: number }) => {
      if (params.action === 'start') {
        const msg = heartbeat.start(params.interval_seconds ?? 30)
        return { content: [{ type: 'text', text: msg }], details: {} }
      }
      if (params.action === 'stop') {
        const msg = heartbeat.stop() || 'No active supervision'
        return { content: [{ type: 'text', text: msg }], details: {} }
      }
      // status
      const state = heartbeat.getState()
      return { content: [{ type: 'text', text: JSON.stringify(state || { active: false }) }], details: {} }
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

async function handleConfigInteractive(cwd: string, cmdCtx: ExtensionCommandContext) {
  const ALL_PHASES = ['observing', 'orienting', 'deciding', 'acting', 'reviewing', 'signoff', 'idle']
  const ALL_TOOLS = ['read', 'write', 'edit', 'bash', 'grep', 'find', 'ls', 'subagent']

  let running = true
  while (running) {
    const choice = await cmdCtx.ui.select(
      '📋 OODA Config',
      ['[1] Auto-Activate', '[2] Block Tools', '[3] Unblock Tools', '[4] Clear Config', '[5] View Config', '[6] Done']
    )
    if (!choice) { running = false; break }

    switch (choice) {
      case '[1] Auto-Activate': {
        const config = loadConfig(cwd)
        const ok = await cmdCtx.ui.confirm(
          'Auto-Activate',
          `Enable auto-activation? Currently: ${config.autoActivate ? 'ON' : 'OFF'}`
        )
        config.autoActivate = ok
        saveLocalConfig(cwd, config)
        cmdCtx.ui.notify(`autoActivate → ${ok ? 'ON' : 'OFF'} (local)`, 'info')
        break
      }

      case '[2] Block Tools': {
        const phaseSel = await cmdCtx.ui.select('Select phase', ALL_PHASES)
        if (!phaseSel) break
        const phase = phaseSel as OodaPhase
        const config = loadConfig(cwd)
        const currentBlocked = config.blockTools[phase as OodaPhase] || []
        // Loop select tools to block
        let blocking = true
        while (blocking) {
          const availTools = ALL_TOOLS.filter(t => !currentBlocked.includes(t))
          if (availTools.length === 0) {
            cmdCtx.ui.notify(`All tools already blocked for "${phase}"`, 'info')
            blocking = false
            break
          }
          const toolSel = await cmdCtx.ui.select('Pick a tool to block (or Done)', [...availTools, '[Done]'])
          if (!toolSel || toolSel === '[Done]') { blocking = false; break }
          if (!currentBlocked.includes(toolSel)) currentBlocked.push(toolSel)
        }
        config.blockTools[phase as OodaPhase] = currentBlocked
        saveLocalConfig(cwd, config)
        cmdCtx.ui.notify(`🔒 ${phase}: ${currentBlocked.join(', ') || 'none'}`, 'info')
        break
      }

      case '[3] Unblock Tools': {
        const phaseSel = await cmdCtx.ui.select('Select phase', ALL_PHASES)
        if (!phaseSel) break
        const phase = phaseSel as OodaPhase
        const config = loadConfig(cwd)
        const currentBlocked = [...(config.blockTools[phase as OodaPhase] || [])]
        if (currentBlocked.length === 0) {
          cmdCtx.ui.notify(`No tools blocked for "${phase}"`, 'info')
          break
        }
        let unblocking = true
        while (unblocking) {
          const toolSel = await cmdCtx.ui.select('Pick a tool to unblock (or Done)', [...currentBlocked, '[Done]'])
          if (!toolSel || toolSel === '[Done]') { unblocking = false; break }
          const idx = currentBlocked.indexOf(toolSel)
          if (idx >= 0) currentBlocked.splice(idx, 1)
          if (currentBlocked.length === 0) {
            cmdCtx.ui.notify(`All tools unblocked from "${phase}"`, 'info')
            unblocking = false
            break
          }
        }
        config.blockTools[phase as OodaPhase] = currentBlocked
        saveLocalConfig(cwd, config)
        cmdCtx.ui.notify(`🔓 ${phase}: ${currentBlocked.join(', ') || 'none'}`, 'info')
        break
      }

      case '[4] Clear Config': {
        const ok = await cmdCtx.ui.confirm(
          'Clear Config',
          'Reset config to defaults? This clears all local overrides.'
        )
        if (ok) {
          clearLocalConfig(cwd)
          cmdCtx.ui.notify('Config reset to defaults (local)', 'info')
        }
        break
      }

      case '[5] View Config': {
        const config = loadConfig(cwd)
        cmdCtx.ui.notify(formatConfig(config, cwd), 'info')
        break
      }

      case '[6] Done':
        running = false
        break
    }
  }
}

