# Launcher-Tool

CU Boulder SuperSpeed (CUSS) portable bungee launcher for a ~9.5 kg RC aircraft, plus the Aircraft Launch Calculator (static HTML/JS, no build step). Owner: Liam Murphy.

## Source of truth
- This repo is the source of truth for calculator code: `index.html` + `app.js`, plain static files, open `index.html` directly. Planning, decisions and status live in the claude.ai project "CUSS Launcher"; mirror any decision that changes code into this file.
- Current code = ChatGPT-era site-work v29 (commit 437dba5) with the built-in setup switched to CUSS1 15FT QUAD. Model code unchanged from v29.
- Live copy: Claude artifact https://claude.ai/artifact/2UZhethwie3g8Roi6qgTU5. Keep it in sync when the calculator changes. The old ChatGPT Sites copy is history.
- After any model change, check CUSS1 still gives 18.1 m/s @ 138.8 in, 6.34 g, stop 162.9 in, or explain why it moved.

## Baseline configuration (decided 2026-10-28)
CUSS1 15FT QUAD is the only configuration kept. The 104 in default and the old 104 in optimization (launcher_model.py/.js) are history only.
- 9.5 kg plane + 2.5 kg carriage, 18 m/s target, 164 in usable travel, 8 deg incline
- 91 N thrust, rolling mu 0.20, CdA 0, rho 1.225 kg/m^3
- Main: 4 x 1/4 in MIL-C-5651 Type I, 295 in unstretched / 720 in loaded, midpoint force, 100% unloading
- Brakes: 4 x 1/4 in Type I, 16 in unstretched, engage at 122 in, midpoint
- Expected: 18.1 m/s release at 138.8 in, 6.34 g peak launch, carriage stop 162.9 in
- Stay with Type I cord (Liam's decision).

Known problems, unresolved: mains start at 144% extension (above 100% spec point and 140% min ultimate elongation); brakes reach ~256% at the stop; ~1 in of rail left.

## Model
- Per cord: p = ln(F75/F100)/ln(0.75), F(e) = F100 * max(e,0)^p, using MIL-C-5651D low/mid/high values.
- Main e = (loaded - relaxed - x)/relaxed; brake e = max(x - engage, 0)/brake_relaxed. Cord path assumed to shorten 1:1 with travel (unverified for the 720 in routing).
- Launch: 1,000 distance steps, combined mass. Release at first zero-acceleration crossing. After release: carriage only, thrust off, 500 steps; rebound with same curves + rolling friction.
- Ideal bungee work = KE + incline work - engine work (excludes rolling, drag, brake work).

## UI rules (Liam's requests)
- No explanatory or promotional text ("wordslop"). Concise labels only.
- Real draggable sliders plus numeric entry. No input/energy locking controls.
- Starting speed fixed at zero; no target release position input.
- Keep the energy breakdown (target KE, engine work, incline work, ideal bungee work).
- Rebound shown as a marker on the speed plot, not a separate plot.
- Saved configs: localStorage key `aircraft-launch-calculator-configs-v7`, migrations v1-v6. Don't break migration.
- Lowercase code comments, terse.

## Open inputs (don't invent these)
Physical rail length vs. 164 in stroke; actual 720 in routing; acceptable peak launch g and carriage braking g; pulley model/sheave diameter; CAD/FEA files.

## Hardware notes
Harbor Freight Haul-Master 2,000 lb hand winch (item 5798) for cocking; Wichard 1303 shackle as attachment candidate; release mechanism (burn-wire vs. snap shackle) not decided. Product ratings in old chats are historical; check supplier docs.
