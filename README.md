# Aircraft Launch Calculator

[Open the calculator](https://aircraft-launch-calculator.rainy-charm-8688.chatgpt.site) or open `index.html` locally.

Inputs: aircraft mass and thrust, target speed, launch and braking lengths, track angle, bungee stiffness and stretch (or constant launch force), rolling resistance, and aerodynamic drag.

The bungee model uses `F = efficiency × stiffness × max(0, initial stretch − distance)`. Aircraft thrust is added during launch and set to zero for braking. The calculator integrates speed along the track and estimates peak longitudinal g, launcher pull, launch time, and braking demand.

Concept estimate only. Verify actual cord behavior, release loads, aircraft structure, and brakes before design use.
