// ─── Mux Abstraction Layer ──────────────────────────────────
// Reuses pattern from pi-my-subagents/mux.ts
// Supports herdr & tmux with auto-detection

import { execSync, execFileSync } from 'node:child_process'

export type MuxBackend = 'herdr' | 'tmux'

function hasCommand(cmd: string): boolean {
  try { execSync(`command -v ${cmd}`, { stdio: 'ignore' }); return true }
  catch { return false }
}

export function getMuxBackend(): MuxBackend | null {
  const pref = process.env.PI_OODA_MUX?.toLowerCase()
  if (pref === 'herdr' && process.env.HERDR_ENV === '1' && hasCommand('herdr')) return 'herdr'
  if (pref === 'tmux' && process.env.TMUX && hasCommand('tmux')) return 'tmux'
  if (process.env.HERDR_ENV === '1' && hasCommand('herdr')) return 'herdr'
  if (process.env.TMUX && hasCommand('tmux')) return 'tmux'
  return null
}

export function isMuxAvailable(): boolean {
  return getMuxBackend() !== null
}

export function muxSetupHint(): string {
  return 'Start pi inside tmux (`tmux new -A -s pi "pi"`) or herdr.'
}

// ─── Pane Operations ──────────────────────────────────────────

export function createPane(name: string): string {
  const backend = getMuxBackend()
  if (!backend) throw new Error(`No mux backend. ${muxSetupHint()}`)

  if (backend === 'tmux') {
    const session = process.env.TMUX
    if (!session) throw new Error('Not in tmux session')
    // Split current pane to right, new pane gets a shell
    const out = execFileSync('tmux', [
      'split-window', '-h', '-P', '-F', '#{pane_id}', '-t', session,
    ], { encoding: 'utf8' }).trim()
    return out
  }

  if (backend === 'herdr') {
    // Get current pane and split
    const list = JSON.parse(execFileSync('herdr', ['pane', 'list'], { encoding: 'utf8' }))
    const currentPane = list?.focused?.pane_id || list?.result?.[0]?.pane_id
    if (!currentPane) throw new Error('Could not determine current herdr pane')

    const out = execFileSync('herdr', [
      'pane', 'split', currentPane, '--direction', 'right', '--no-focus',
    ], { encoding: 'utf8' })
    const parsed = JSON.parse(out)
    const newId = parsed?.result?.pane?.pane_id
    if (!newId) throw new Error('Failed to create herdr pane')
    return newId
  }

  throw new Error('Unsupported mux backend')
}

export function sendCommand(paneId: string, command: string): void {
  const backend = getMuxBackend()
  if (!backend) return

  if (backend === 'tmux') {
    execFileSync('tmux', ['send-keys', '-t', paneId, command, 'Enter'], { stdio: 'ignore' })
    return
  }

  if (backend === 'herdr') {
    execFileSync('herdr', ['pane', 'run', paneId, command], { stdio: 'ignore' })
    return
  }
}

export function sendEscape(paneId: string): void {
  const backend = getMuxBackend()
  if (!backend) return

  if (backend === 'tmux') {
    execFileSync('tmux', ['send-keys', '-t', paneId, 'Escape'], { stdio: 'ignore' })
    return
  }

  if (backend === 'herdr') {
    execFileSync('herdr', ['pane', 'run', paneId, '\\x1b'], { stdio: 'ignore' })
    return
  }
}

export function readPaneOutput(paneId: string, lines = 50): string {
  const backend = getMuxBackend()
  if (!backend) return ''

  if (backend === 'tmux') {
    return execFileSync('tmux', [
      'capture-pane', '-t', paneId, '-p', '-S', `-${lines}`,
    ], { encoding: 'utf8' })
  }

  if (backend === 'herdr') {
    const out = execFileSync('herdr', [
      'pane', 'read', paneId, '--source', 'recent', '--lines', String(lines),
    ], { encoding: 'utf8' })
    const parsed = JSON.parse(out)
    return parsed?.result?.content ?? out
  }

  return ''
}

export function waitForDone(paneId: string, timeoutMs = 120_000): boolean {
  const backend = getMuxBackend()
  if (!backend) return false

  if (backend === 'tmux') {
    // No agent-status in tmux, rely on no activity heuristic
    try {
      execFileSync('tmux', ['wait-for', '-L', `ooda-${paneId}`], { timeout: timeoutMs, stdio: 'ignore' })
      return true
    } catch {
      return false
    }
  }

  if (backend === 'herdr') {
    try {
      execFileSync('herdr', ['wait', 'agent-status', paneId, '--status', 'done', '--timeout', String(timeoutMs)], { stdio: 'ignore' })
      return true
    } catch {
      return false
    }
  }

  return false
}

export function listPanes(): Array<{ id: string; label?: string; status?: string }> {
  const backend = getMuxBackend()
  if (!backend) return []

  if (backend === 'tmux') {
    const out = execFileSync('tmux', ['list-panes', '-a', '-F', '#{pane_id}:#{pane_title}'], { encoding: 'utf8' })
    return out.trim().split('\n').filter(Boolean).map(l => {
      const [id, ...label] = l.split(':')
      return { id, label: label.join(':') || undefined }
    })
  }

  if (backend === 'herdr') {
    const out = execFileSync('herdr', ['pane', 'list'], { encoding: 'utf8' })
    const parsed = JSON.parse(out)
    const panes = parsed?.result ?? []
    return panes.map((p: any) => ({
      id: p.pane_id,
      label: p.label,
      status: p.agent_status,
    }))
  }

  return []
}

export function closePane(paneId: string): void {
  const backend = getMuxBackend()
  if (!backend) return

  if (backend === 'tmux') {
    execFileSync('tmux', ['kill-pane', '-t', paneId], { stdio: 'ignore' })
    return
  }

  if (backend === 'herdr') {
    execFileSync('herdr', ['pane', 'close', paneId], { stdio: 'ignore' })
    return
  }
}
