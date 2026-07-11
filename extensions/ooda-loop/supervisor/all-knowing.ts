// ─── All-Knowing: Scout-Driven Context ──────────────────
// "Tau kapan gak tau" — instead of gathering everything proactively,
// the agent dispatches scouts when it encounters unknowns.

import { execSync } from 'node:child_process'
import { existsSync } from 'node:fs'

export interface EnvironmentContext {
  cwd: string
  gitBranch: string
  gitDirty: boolean
  gitUncommitted: number
  muxBackend: string | null
  hasTests: boolean
  testCommand: string
}

function silentExec(cmd: string): string {
  try { return execSync(cmd, { encoding: 'utf8', stdio: 'pipe' }).trim() }
  catch { return '' }
}

function countLines(s: string): number {
  return s ? s.split('\n').length : 0
}

export function gatherContext(cwd: string): EnvironmentContext {
  const gitBranch = silentExec('git rev-parse --abbrev-ref HEAD 2>/dev/null')
  const gitStatus = silentExec('git status --porcelain 2>/dev/null')
  return {
    cwd,
    gitBranch: gitBranch || '(not a git repo)',
    gitDirty: gitStatus.length > 0,
    gitUncommitted: countLines(gitStatus),
    muxBackend: process.env.HERDR_ENV === '1' ? 'herdr' : process.env.TMUX ? 'tmux' : null,
    hasTests: existsSync('vitest.config.ts') || existsSync('jest.config.ts') || existsSync('.mocharc.yml'),
    testCommand: 'npm test',
  }
}

export function formatContext(ctx: EnvironmentContext): string {
  return [
    `📋 Context:`,
    `  Branch: ${ctx.gitBranch}`,
    `  Dirty:  ${ctx.gitDirty ? `⚠️ ${ctx.gitUncommitted} uncommitted` : '✅ clean'}`,
    `  Mux:    ${ctx.muxBackend ?? '❌ none'}`,
    `  Test:   ${ctx.testCommand}`,
  ].join('\n')
}
