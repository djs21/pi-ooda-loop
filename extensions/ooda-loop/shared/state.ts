// ─── OODA State Persistence ─────────────────────────────────

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import type { OodaState } from './types.ts'

const STATE_FILE = '.ooda-state.json'

function getStatePath(cwd: string): string {
  return join(cwd, STATE_FILE)
}

export function loadState(cwd: string): OodaState | null {
  const path = getStatePath(cwd)
  if (!existsSync(path)) return null
  try {
    return JSON.parse(readFileSync(path, 'utf-8'))
  } catch {
    return null
  }
}

export function saveState(cwd: string, state: OodaState): void {
  const path = getStatePath(cwd)
  mkdirSync(require('node:path').dirname(path), { recursive: true })
  writeFileSync(path, JSON.stringify(state, null, 2))
}

export function clearState(cwd: string): void {
  const path = getStatePath(cwd)
  if (existsSync(path)) {
    writeFileSync(path, JSON.stringify({ phase: 'idle', feature: '', oodaMode: false, batches: [], currentBatch: 0, artifacts: [] }))
  }
}

export function createInitialState(feature: string): OodaState {
  return {
    phase: 'idle',
    feature,
    oodaMode: false,
    batches: [],
    currentBatch: 0,
    artifacts: [],
  }
}
