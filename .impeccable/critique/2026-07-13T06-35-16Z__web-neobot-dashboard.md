---
target: web (NeoBot dashboard)
total_score: 32
p0_count: 0
p1_count: 0
timestamp: 2026-07-13T06-35-16Z
slug: web-neobot-dashboard
---
⚠️ DEGRADED: single-context (harness policy: sub-agents not spawned unless the user asks)

# Critique — NeoBot dashboard (`web/`)

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 4 | Connection pill + live-feed dot + toasts + button-loading + status badges; comprehensive |
| 2 | Match System / Real World | 3 | Raw enum/identifier leakage: `anticheat`, `server_restart`, `jumpLook` shown verbatim |
| 3 | User Control and Freedom | 3 | Wizard Back/Continue, logout, export/import backups; no undo on config save |
| 4 | Consistency and Standards | 4 | One token system, one Panel/Button/Field vocabulary across all 5 pages |
| 5 | Error Prevention | 3 | Per-step wizard validation + password confirm; Restart (drops connection) has no confirm |
| 6 | Recognition Rather Than Recall | 3 | Labeled icon+text nav (no icon-only); behavior names are raw identifiers |
| 7 | Flexibility and Efficiency | 2 | No keyboard shortcuts, no command palette, no bulk behavior toggle |
| 8 | Aesthetic and Minimalist Design | 4 | Clean dark surface, clear hierarchy, no decorative clutter |
| 9 | Error Recovery | 3 | Login 401-vs-429 distinct; some config errors surface raw codes (`invalid_config`) |
| 10 | Help and Documentation | 3 | Inline field hints + wizard copy; no tooltips/help center |
| **Total** | | **32/40** | **Good** |

## Anti-Patterns Verdict — PASS
**LLM assessment:** Not AI slop. Committed cyan identity (§19), self-hosted technical sans+mono, dark-OLED data-dense register with semantic status colors. No gradient text, no eyebrows, no numbered scaffolds, no side-stripe borders. Decorative panel blur was removed in the audit pass, so no glassmorphism tell. The one mild risk is the 4-stat KPI row reading templated, but the tiles carry varied content (icons/hints differ) and aren't the gradient hero-metric cliché.
**Deterministic scan:** `detect.mjs --json` clean (`[]`) on both `web/src` and `web/dist` — zero slop patterns. Contrast pass: ink 14–16:1, muted 7.6–8.7:1, faint 5.5–6.4:1, accent/ok/warn/danger all ≥6:1. **Exception: `idle` tone (`#64748b`) = 3.55–3.77:1 on panels — below AA 4.5 for the small badge/category text that uses it.**
**Visual overlays:** none — browser automation not exposed in this session; no reliable user-visible overlay. Deterministic scan + manual review only.

## Overall Impression
A genuinely production-grade operator dashboard: cohesive, legible, on-brand, and fast. It reads like a tool built by someone who's used Linear/Grafana, not a generated shell. The biggest opportunity is **language** — the UI leaks backend identifiers (enum categories, behavior names, error codes) that a first-time self-hoster won't parse — and **power-user efficiency** (no keyboard affordances on a screen operators will stare at all day).

## What's Working
1. **System status is everywhere and honest** — the header pill fuses bot status + a separate socket-liveness dot, control actions confirm via toast, and `currentActivity` streams live. A glance answers "is it alive and what's it doing."
2. **One vocabulary, five pages** — Panel/Button/Field/Toggle/Badge are reused verbatim; nothing is bespoke per screen. Consistency is a real strength here.
3. **Progressive disclosure in the wizard** — version field appears only when auto-detect is off; chat pool only when chat is on; IP list only when the allowlist is on. Cognitive load stays low (0–1 checklist failures).

## Priority Issues

- **[P2] `idle`-tone text fails AA contrast.** `#64748b` gives 3.55:1 on `surface-2`. **Why:** the reconnect-history category badges, info-level log badges, and "not set" env badges render small text in this tone — Sam (screen-magnifier/low-vision) and anyone on a dim laptop will strain. **Fix:** lighten `--color-idle` toward ~`#8695ab` (≥4.5:1) — dots stay fine (graphical 3:1). **Command:** `/impeccable colorize` (or direct token bump).
- **[P2] Raw backend identifiers leak into the UI.** `anticheat`, `server_restart`, `whitelist` (DisconnectCategory), `jumpLook`/`pathfindRandom` (behavior names), and error codes like `invalid_config` appear verbatim. **Why:** Jordan (first-timer) reads "server_restart" as a bug, not a category; it breaks the "speak the user's language" heuristic. **Fix:** a small humanize map (`anticheat → Anti-cheat`, `server_restart → Server restart`, `jumpLook → Jump & look`) at the render boundary. **Command:** `/impeccable clarify`.
- **[P2] No keyboard efficiency for a stare-at-it-all-day dashboard.** No shortcuts (pause/resume, reconnect, tab switch), no command palette. **Why:** Alex (operator) lives here; every action is a mouse trip. **Fix:** keybindings for the control actions + a `g d`/`g l`/`g c` nav pattern, surfaced in a `?` hint. **Command:** `/impeccable harden` (or a scoped feature).
- **[P2] Restart has no confirmation.** It's styled danger but drops the live Minecraft connection on a single click. **Why:** Riley/misclick loses the session; it's the one genuinely disruptive control. **Fix:** an inline confirm (not a modal — a two-step "Restart? · confirm") on Restart only. **Command:** `/impeccable harden`.
- **[P3] Spinners in content regions instead of skeletons.** Dashboard/Logs/Config show a centered spinner on first load. **Why:** the product register prefers skeletons that preserve layout; spinners feel less "solid." **Fix:** panel-shaped skeletons for the first paint. **Command:** `/impeccable polish`.

## Persona Red Flags
**Alex (Power User):** No keyboard shortcuts for pause/resume/reconnect. Behaviors toggle one-at-a-time (no "disable all"). Token-URL deep link is the only accelerator. Lives here daily — friction compounds.
**Sam (Accessibility):** Strong overall — status is never color-alone (dot + text label), focus rings are visible everywhere, forms are labeled, the minimap canvas has an `aria-label` + a text coord readout. **But** `idle`-tone small text at 3.55:1 fails AA, and the minimap's trail/ring carry no non-visual summary beyond current X/Y/Z.
**Jordan (First-Timer):** The wizard is genuinely gentle and well-copied. The leak is post-setup: "Ended: server_restart" and behavior identifiers like `pathfindRandom` in the activity line assume domain fluency.

## Minor Observations
- `version` on the Dashboard "Current session" panel is hard-coded to `v0.1.0` in JSX rather than read from the snapshot/status payload — it'll drift.
- Log tabs (Events/Sessions) don't reflect in the URL, so a refresh always lands on Events.
- The reconnect-history reason is truncated (good) but has no title/tooltip to reveal the full string on hover.

## Questions to Consider
- What would a **keyboard-first** version of this dashboard feel like — could an operator run the whole thing without a mouse?
- The UI faithfully mirrors the backend's vocabulary. Should it instead speak the *operator's* language and treat enums/behavior-ids as an implementation detail?
- Restart is one click from dropping the session. What's the confident, low-friction way to make that safe without a heavy modal?
