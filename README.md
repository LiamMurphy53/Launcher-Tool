# Aircraft Launch Calculator

Bungee launcher calculator for the CU Boulder SuperSpeed RC aircraft launcher. Static `index.html` + `app.js`; open `index.html` in a browser. Live copy: https://claude.ai/artifact/2UZhethwie3g8Roi6qgTU5

## Default setup
CUSS1 15FT QUAD: 9.5 kg plane, 2.5 kg carriage, 18 m/s target, 164 in total travel, 8° incline, 91 N thrust, rolling μ 0.20, CdA 0, 1.225 kg/m³. Launch: 4 × ¼″ MIL-C-5651 Type I, 295 in unstretched, 720 in loaded. Braking: 4 × ¼″ Type I, 16 in unstretched, stretch begins at 122 in. Midpoint force case, 100% unloading factor. Minimum rail left at stop: 6 in.

All lengths are inches. "Loaded length" is total cord length at the start, not added stretch. Saved configurations live in the viewer's browser only (localStorage `aircraft-launch-calculator-configs-v7`).

## Force model
Per cord, a power law through the MIL-C-5651D force points at 75% and 100% extension:
p = ln(F75/F100) / ln(0.75), F(e) = F100 · e^p.
Counts multiply force; the unloading factor multiplies total launch pull. The cord path is assumed to shorten 1 in per 1 in of carriage travel.

## Simulation
- Launch: 1,000 distance steps; launch pull + thrust − brake pull − incline − rolling − drag on combined mass.
- Release: first point where loaded-carriage acceleration reaches zero.
- After release: carriage only, thrust off, 500 steps. First stop and rebound/settling estimated; settled position marked on the speed plot.

## Limits
Spec force points are not measured loading/unloading curves; below 75% and above 100% the fit is extrapolated. Low/high cases are not guaranteed bounds. Rebound uses the same curves both ways with rolling friction only. No cord mass, waves, rate or temperature effects, pulley losses, unequal sharing, or end-fitting slip. G values are longitudinal only. Deceleration-triggered release needs validation against the actual hook mechanism.
