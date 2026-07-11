# OODA Loop — Pi Extension

**Observe → Orient → Decide → Act**

Structured workflow orchestration dengan **all-seeing, all-thinking** supervisor. Main agent gak pernah bengong — dia ngawasin semua worker real-time via herdr/tmux.

## Install

```bash
pi install .
```

Butuh tmux atau herdr:
```bash
tmux new -A -s pi 'pi'
# atau jalan di herdr
```

## Commands

| Command | Description |
|---|---|
| `/ooda:plan <feature>` | Scout → plan → task grouping + batches |
| `/ooda:tdd` | RED-GREEN-REFACTOR gate design per task |
| `/ooda:start` | Execute workers parallel di mux panes + supervisor |
| `/ooda:signoff` | Merge, push, archive, close issues |
| `/ooda:status` | Show all workers + output snippets + insights |
| `/ooda:read <worker-id>` | Full output dari worker pane |
| `/ooda:reset` | Clear session state |

## How It Works

```
1. /ooda:plan "fitur-x"
   ├── Scout: reconnaissance codebase
   ├── Planner: PRD + plan + task grouping
   └── Reviewer: verify plan

2. /ooda:tdd
   └── TDD gate design per task

3. /ooda:start
   ├── Spawn workers di herdr/tmux panes
   ├── SUPERVISOR AKTIF:
   │   ├── 👁️ All-Seeing: pane read tiap worker
   │   ├── 🧠 All-Thinking: analyze partial output
   │   └── 🛑 Early intervention
   └── Semua selesai → merge batch

4. /ooda:signoff
   └── Merge, push, archive, close
```

## Mux Support

| Backend | Auto-detect | Commands |
|---|---|---|
| **herdr** | `$HERDR_ENV=1` | `pane split`, `pane read`, `pane run` |
| **tmux** | `$TMUX` | `split-window`, `capture-pane`, `send-keys` |

Override: `PI_OODA_MUX=herdr|tmux`

## Architecture (Vertical Slices)

```
extensions/ooda-loop/
├── index.ts              # Composition root
├── shared/               # Shared kernel (minimal)
│   ├── types.ts          # Phase, Worker, OodaState, Gate rules
│   ├── state.ts          # .ooda-state.json persistence
│   └── mux.ts            # herdr/tmux abstraction
├── supervisor/           # All-seeing, all-thinking
│   ├── watcher.ts        # pane read → real-time status
│   ├── thinker.ts        # analyze partial output → insights
│   ├── intervent.ts      # error detection → action plan
│   └── prompt-inject.ts  # system prompt injection
├── plan/                 # /ooda:plan slice
├── tdd/                  # /ooda:tdd slice
├── start/                # /ooda:start slice
└── signoff/              # /ooda:signoff slice
```
