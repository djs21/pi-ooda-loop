# OODA Loop — Pi Extension

**Observe → Orient → Decide → Act** — otomatis.

Structured workflow orchestration dengan **all-seeing, all-knowing, all-thinking** supervisor. Pas `/ooda:activate`, agent jadi orchestrator penuh — scout kalo gak tau, delegasi ke sub-agents, supervise real-time via herdr/tmux.

## Install

```bash
pi install git:djs21/pi-ooda-loop
```

Butuh tmux atau herdr:
```bash
tmux new -A -s pi 'pi'
# atau jalan langsung di herdr
```

## Commands

| Command | Description |
|---|---|
| `/ooda:activate` | 🎯 Aktifkan OODA orchestrator mode — agent otomatis OODA tiap task |
| `/ooda:deactivate` | Balik ke mode normal |
| `/ooda:context` | Fast check: branch, git status, mux, test config |
| `/ooda:plan <feature>` | Plan: scout → PRD → task grouping + batches |
| `/ooda:tdd` | TDD gate design RED-GREEN-REFACTOR per task |
| `/ooda:start` | Execute workers parallel di mux panes + supervisor |
| `/ooda:signoff` | Merge, push, archive, close issues |
| `/ooda:status` | Show all workers + output snippets + insights |
| `/ooda:read <worker-id>` | Full output dari worker pane |
| `/ooda:reset` | Clear session state |

## Dua Mode

### Manual Mode (default)
Lo panggil `/ooda:plan` → `/ooda:tdd` → `/ooda:start` → `/ooda:signoff` manual.

### Orchestrator Mode (`/ooda:activate`)
System prompt di-inject. Agent otomatis:
1. **Observe:** cek git status, scout kalo gak tau
2. **Orient:** breakdown task, tulis plan
3. **Decide:** presentasi + konfirmasi
4. **Act:** dispatch workers via herdr/tmux
5. **Supervise:** tiap turn cek worker via `ooda_status` tool
6. **Review:** verify sebelum declare done
7. **Sign-off:** merge, push, archive

Semua command manual tetap bisa dipake sebagai override.

## All-Knowing (Scout-Driven)

"Tau kapan gak tau." Gak pre-gather semua context tiap turn. Kalo agent nemu sesuatu yg gak familiar:

- Struktur / konvensi kode → dispatch **Scout** sub-agent
- Dependensi asing → dispatch **Scout**
- Error gak jelas → dispatch **Scout**
- Behavior mencurigakan → dispatch **Scout**

Scout = sub-agent khusus yg cuma investigate. Agent gak tebak-tebak.

## All-Seeing (Supervisor)

Setelah worker jalan, agent gak bengong:
- Panggil `ooda_status` tool tiap turn
- Baca partial output: detect error, test progress
- Siapin next batch logic sambil nunggu
- Worker stall >5min → intervensi (restart / cancel / replan)

## Mux Support

| Backend | Auto-detect | Commands |
|---|---|---|
| **herdr** | `$HERDR_ENV=1` | `pane split`, `pane read`, `pane run` |
| **tmux** | `$TMUX` | `split-window`, `capture-pane`, `send-keys` |

Override: `PI_OODA_MUX=herdr|tmux`

## Architecture (Vertical Slices)

```
extensions/ooda-loop/
├── index.ts              # Composition root — 10 commands, 1 tool
├── shared/               # Shared kernel (minimal)
│   ├── types.ts          # Phase, Worker, OodaState, Gate rules
│   ├── state.ts          # .ooda-state.json persistence
│   └── mux.ts            # herdr/tmux abstraction
├── supervisor/           # All-seeing, all-knowing, all-thinking
│   ├── watcher.ts        # 👁️ pane read → real-time snapshots
│   ├── thinker.ts        # 🧠 analyze partial output → insights
│   ├── intervent.ts      # 🛑 error detection → action plan
│   ├── all-knowing.ts    # 📡 scout-driven context gathering
│   └── ooda-brain.ts     # 🧠 orchestrator system prompt builder
├── plan/                 # /ooda:plan slice
├── tdd/                  # /ooda:tdd slice
├── start/                # /ooda:start slice
└── signoff/              # /ooda:signoff slice
```
