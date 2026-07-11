// ─── Phase Types ─────────────────────────────────────────────

export type OodaPhase =
  | 'idle'
  | 'observing'
  | 'orienting'
  | 'deciding'
  | 'acting'
  | 'reviewing'
  | 'signoff'

export const OODA_PHASES: OodaPhase[] = [
  'idle', 'observing', 'orienting', 'deciding', 'acting', 'reviewing', 'signoff',
]

export const OODA_PHASE_LABELS: Record<OodaPhase, string> = {
  idle:      'Idle',
  observing: 'Observe — gather context',
  orienting: 'Orient — analyze & plan',
  deciding:  'Decide — evaluate options',
  acting:    'Act — execute parallel workers',
  reviewing: 'Review — verify quality gates',
  signoff:   'Sign-off — user test & close',
}

// ─── Worker Types ─────────────────────────────────────────────

export type WorkerStatus = 'pending' | 'starting' | 'running' | 'error' | 'done'

export interface WorkerTask {
  id: string
  name: string
  branch: string
  worktreeDir: string
  status: WorkerStatus
  muxPaneId?: string          // herdr pane_id or tmux %id
  error?: string
  startedAt?: number
  finishedAt?: number
}

export interface WorkerBatch {
  batch: number
  tasks: WorkerTask[]
  parallel: boolean
}

// ─── OODA State ───────────────────────────────────────────────

export interface OodaState {
  phase: OodaPhase
  feature: string
  oodaMode: boolean          // true = orchestrator mode active
  batches: WorkerBatch[]
  currentBatch: number
  startedAt?: number
  prdPath?: string
  planPath?: string
  artifacts: string[]
}

// ─── Tool Gate Types ──────────────────────────────────────────

export type ToolName = 'read' | 'write' | 'edit' | 'bash' | 'subagent' | 'grep' | 'find' | 'ls'

export interface GateRule {
  tool: ToolName
  allowed: boolean
  reason: string
}

export const PHASE_GATES: Record<OodaPhase, GateRule[]> = {
  idle: [],
  observing: [
    { tool: 'read',     allowed: true,  reason: 'Observe: gather context' },
    { tool: 'grep',     allowed: true,  reason: 'Observe: search codebase' },
    { tool: 'find',     allowed: true,  reason: 'Observe: find files' },
    { tool: 'ls',       allowed: true,  reason: 'Observe: list files' },
    { tool: 'bash',     allowed: true,  reason: 'Observe: read-only commands' },
    { tool: 'subagent', allowed: true,  reason: 'Observe: dispatch scouts' },
    { tool: 'write',    allowed: false, reason: 'Observe: read-only phase' },
    { tool: 'edit',     allowed: false, reason: 'Observe: read-only phase' },
  ],
  orienting: [
    { tool: 'read',     allowed: true,  reason: 'Orient: consult docs' },
    { tool: 'write',    allowed: true,  reason: 'Orient: document analysis' },
    { tool: 'edit',     allowed: true,  reason: 'Orient: refine docs' },
    { tool: 'subagent', allowed: true,  reason: 'Orient: dispatch analysts' },
    { tool: 'bash',     allowed: true,  reason: 'Orient: analysis commands' },
  ],
  deciding: [
    { tool: 'read',     allowed: true,  reason: 'Decide: review options' },
    { tool: 'write',    allowed: true,  reason: 'Decide: write plan' },
    { tool: 'edit',     allowed: true,  reason: 'Decide: refine plan' },
    { tool: 'subagent', allowed: true,  reason: 'Decide: dispatch planners' },
  ],
  acting: [
    { tool: 'read',     allowed: true,  reason: 'Act: review context' },
    { tool: 'write',    allowed: true,  reason: 'Act: implement changes' },
    { tool: 'edit',     allowed: true,  reason: 'Act: implement changes' },
    { tool: 'bash',     allowed: true,  reason: 'Act: run commands' },
    { tool: 'subagent', allowed: true,  reason: 'Act: dispatch workers' },
  ],
  reviewing: [
    { tool: 'read',     allowed: true,  reason: 'Review: inspect code' },
    { tool: 'grep',     allowed: true,  reason: 'Review: search patterns' },
    { tool: 'bash',     allowed: true,  reason: 'Review: run tests' },
    { tool: 'subagent', allowed: true,  reason: 'Review: dispatch reviewers' },
    { tool: 'write',    allowed: false, reason: 'Review: read-only phase' },
    { tool: 'edit',     allowed: false, reason: 'Review: read-only phase' },
  ],
  signoff: [
    { tool: 'read',     allowed: true,  reason: 'Sign-off: review' },
    { tool: 'bash',     allowed: true,  reason: 'Sign-off: verification' },
    { tool: 'write',    allowed: false, reason: 'Sign-off: user decision' },
    { tool: 'edit',     allowed: false, reason: 'Sign-off: user decision' },
  ],
}
