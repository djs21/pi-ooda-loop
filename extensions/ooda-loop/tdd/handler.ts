// ─── /ooda:tdd — TDD Gate Design Phase ───────────────────

import type { ExtensionCommandContext } from '@earendil-works/pi-coding-agent'
import { loadState, saveState } from '../shared/state'

export async function handleTdd(
  _args: string,
  _ctx: ExtensionCommandContext,
  cwd: string,
): Promise<string> {
  const state = loadState(cwd)
  if (!state || state.phase === 'idle') {
    return '⚠️ No active OODA session. Run /ooda:plan <feature> first.'
  }

  const lines: string[] = ['🧪 OODA TDD Gate Design', '']

  for (let i = 0; i < state.batches.length; i++) {
    const batch = state.batches[i]
    lines.push(`Batch ${i + 1} (${batch.parallel ? '⚡ parallel' : '→ sequential'}):`)
    for (const task of batch.tasks) {
      lines.push(`  📦 ${task.name} [${task.branch}]`)
      lines.push(`    RED:   define failing test for ${task.name}`)
      lines.push(`    GREEN: implement minimal code to pass`)
      lines.push(`    REFACTOR: clean up, verify all tests pass`)
      lines.push('')
    }
  }

  state.phase = 'acting'
  saveState(cwd, state)

  lines.push('Use /ooda:start to execute workers in parallel.')
  return lines.join('\n')
}
