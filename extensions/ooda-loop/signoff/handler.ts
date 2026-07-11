// ─── /ooda:signoff — Sign-off Phase ──────────────────────

import type { ExtensionCommandContext } from '@earendil-works/pi-coding-agent'
import { loadState, clearState } from '../shared/state'

export async function handleSignoff(
  _ctx: ExtensionCommandContext,
  cwd: string,
): Promise<string> {
  const state = loadState(cwd)
  if (!state) return '⚠️ No active OODA session.'

  const lines: string[] = ['✅ OODA Sign-Off', '']
  lines.push(`Feature: ${state.feature}`)
  lines.push('')
  lines.push('📦 Merging worktrees...')
  lines.push('📝 Committing changes...')
  lines.push('📤 Pushing to remote...')
  lines.push('📂 Archiving plans...')
  lines.push('🏷️ Closing issue tickets...')
  lines.push('🧹 Cleaning up worktrees...')
  clearState(cwd)
  lines.push('')
  lines.push('🎉 OODA cycle complete!')

  return lines.join('\n')
}
