# DOX — extensions/ooda-loop/

## Purpose
OODA Loop pi extension. Structured workflow orchestration dengan all-seeing, all-knowing, all-thinking supervisor.

## Ownership
- Root: `/AGENTS.md`
- All code in this tree is owned by the OODA Loop extension
- Slice boundaries: plan, tdd, start, signoff, supervisor, shared

## Local Contracts
- **index.ts** = composition root. Registers commands, tools, hooks. Jangan taruh logic di sini.
- **shared/** = kernel minimal. No dependencies on other slices.
- **supervisor/** = system prompt injection + watcher + thinker + all-knowing.
- **plan/, tdd/, start/, signoff/** = vertical slices. Tiap slice punya `handler.ts` sendiri.
- **Mux abstraction** di `shared/mux.ts`. Jangan panggil herdr/tmux API langsung dari slice.

## Work Guidance
- Commands: `/ooda:activate/deactivate/plan/tdd/start/signoff/status/read/reset/context`
- All-knowing: scout-driven. Kalo gak tau → scout dulu.
- Supervisor: tiap turn cek worker lewat `ooda_status` tool.
- No direct coding in orchestrator mode — delegate ke sub-agents.

## Verification
- `npx tsc --noEmit` — 0 errors
- No runtime test suite yet

## Child DOX Index
- `/shared/` — shared kernel (types, state, mux) — too small for its own AGENTS.md, owned here
- `/supervisor/` — watcher, thinker, intervent, all-knowing, ooda-brain — owned here
- `/plan/` — /ooda:plan slice — owned here
- `/tdd/` — /ooda:tdd slice — owned here
- `/start/` — /ooda:start slice — owned here
- `/signoff/` — /ooda:signoff slice — owned here
