# Aircraft Launch Calculator

[Open the calculator](https://aircraft-launch-calculator.rainy-charm-8688.chatgpt.site) or open `index.html` locally.

Enter aircraft mass and thrust, target speed, launch and braking lengths, track angle, and rolling and aerodynamic resistance. Number fields have draggable sliders for quick changes.

Add bungee sets with different cord counts, unstretched lengths, stretched lengths at launch, and stiffness per cord. Each set pulls until its extension reaches zero. The force model is:

`F(x) = efficiency × Σ[count × stiffness × max(0, stretched length − unstretched length − x)]`

Aircraft thrust is added during launch and set to zero for braking. The calculator integrates speed along the track and estimates peak longitudinal g, combined bungee pull, launch time, and braking demand.

The model assumes 1:1 cord contraction with aircraft travel and linear springs. Verify actual cord behavior, release loads, aircraft structure, and brakes before design use.
