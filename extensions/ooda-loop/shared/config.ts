// ─── OODA Config — Global + Local ────────────────────────
// Global: ~/.pi/config/ooda-config.json
// Local:  .pi/ooda-config.json (project-level)
// Priority: Local > Global

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { homedir } from 'node:os'
import { join, dirname } from 'node:path'
import type { OodaPhase } from './types'

const CONFIG_DIR = '.pi'
const CONFIG_FILE = 'ooda-config.json'
const GLOBAL_CONFIG_DIR = join(homedir(), CONFIG_DIR, 'config')

export interface OodaConfig {
  autoActivate: boolean
  blockTools: Partial<Record<OodaPhase, string[]>>
}

export const DEFAULT_BLOCKED: Record<OodaPhase, string[]> = {
  idle:      [],
  observing: ['write', 'edit'],
  orienting: [],
  deciding:  [],
  acting:    [],
  reviewing: ['write', 'edit'],
  signoff:   ['write', 'edit'],
}

export const DEFAULT_CONFIG: OodaConfig = {
  autoActivate: false,
  blockTools: { ...DEFAULT_BLOCKED },
}

function globalPath(): string {
  return join(GLOBAL_CONFIG_DIR, CONFIG_FILE)
}

function localPath(cwd: string): string {
  return join(cwd, CONFIG_DIR, CONFIG_FILE)
}

function readFile(path: string): OodaConfig | null {
  try {
    return JSON.parse(readFileSync(path, 'utf-8'))
  } catch { return null }
}

function writeFile(path: string, config: OodaConfig): void {
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, JSON.stringify(config, null, 2) + '\n')
}

export function loadConfig(cwd: string): OodaConfig {
  const global = readFile(globalPath())
  const local = readFile(localPath(cwd))
  return mergeConfig(global, local)
}

function mergeConfig(global: OodaConfig | null, local: OodaConfig | null): OodaConfig {
  // Start with defaults
  const merged: OodaConfig = {
    autoActivate: DEFAULT_CONFIG.autoActivate,
    blockTools: { ...DEFAULT_CONFIG.blockTools },
  }

  // Apply global
  if (global) {
    if (typeof global.autoActivate === 'boolean') merged.autoActivate = global.autoActivate
    if (global.blockTools) {
      for (const [phase, tools] of Object.entries(global.blockTools)) {
        if (tools && Array.isArray(tools)) {
          merged.blockTools[phase as OodaPhase] = [...tools]
        }
      }
    }
  }

  // Apply local (overrides global)
  if (local) {
    if (typeof local.autoActivate === 'boolean') merged.autoActivate = local.autoActivate
    if (local.blockTools) {
      for (const [phase, tools] of Object.entries(local.blockTools)) {
        if (tools && Array.isArray(tools)) {
          merged.blockTools[phase as OodaPhase] = [...tools]
        }
      }
    }
  }

  return merged
}

export function saveLocalConfig(cwd: string, config: OodaConfig): void {
  writeFile(localPath(cwd), config)
}

export function saveGlobalConfig(config: OodaConfig): void {
  writeFile(globalPath(), config)
}

export function clearLocalConfig(cwd: string): void {
  const path = localPath(cwd)
  if (existsSync(path)) {
    writeFile(path, DEFAULT_CONFIG)
  }
}

export function clearGlobalConfig(): void {
  const path = globalPath()
  if (existsSync(path)) {
    writeFile(path, DEFAULT_CONFIG)
  }
}

export function getBlockedTools(config: OodaConfig, phase: OodaPhase): string[] {
  return config.blockTools[phase] ?? DEFAULT_BLOCKED[phase] ?? []
}

export function formatConfig(config: OodaConfig, cwd: string): string {
  const lines = [
    '📋 OODA Config',
    '',
    `Auto-activate: ${config.autoActivate ? '✅ ON' : '❌ OFF'}`,
    '',
    'Blocked tools per phase:',
  ]
  for (const [phase, tools] of Object.entries(config.blockTools)) {
    if (tools && tools.length > 0) {
      lines.push(`  ${phase.padEnd(12)} 🔒 ${tools.join(', ')}`)
    } else {
      lines.push(`  ${phase.padEnd(12)} ✅ none`)
    }
  }
  lines.push('')
  lines.push(`Global: ${globalPath()}`)
  lines.push(`Local:  ${localPath(cwd)}`)
  return lines.join('\n')
}