// ─── /ooda:plan — Plan Phase ──────────────────────────────

import type { ExtensionCommandContext } from '@earendil-works/pi-coding-agent'
import { createInitialState, saveState } from '../shared/state'
import { formatInsights } from '../supervisor/thinker'

export async function handlePlan(
  feature: string,
  _ctx: ExtensionCommandContext,
  cwd: string,
): Promise<string> {
  const state = createInitialState(feature)
  state.phase = 'observing'
  saveState(cwd, state)

  const lines: string[] = [`🚀 OODA Plan: ${feature}`, '']

  lines.push('🔍 Observe: gathering context...')
  state.phase = 'orienting'
  saveState(cwd, state)

  lines.push('📋 Orient: creating PRD & plan...')
  state.phase = 'deciding'
  saveState(cwd, state)

  lines.push('🧐 Decide: reviewing plan...')
  state.phase = 'reviewing'
  saveState(cwd, state)

  state.batches = []
  state.currentBatch = 0
  saveState(cwd, state)

  lines.push('')
  lines.push('✅ Plan ready. Use /ooda:tdd to design test gates.')
  lines.push('')
  lines.push(formatInsights([]))

  return lines.join('\n')
}
