# Aircraft Launch Calculator

An interactive, browser-only concept calculator for aircraft launcher sizing. Open `index.html` in a browser or visit the [private hosted version](https://aircraft-launch-calculator.rainy-charm-8688.chatgpt.site).

## Inputs

- Aircraft mass, starting speed, target speed, launch length, braking length, and track incline
- Bungee model: combined stiffness, initial stretch, and effective energy transfer percentage
- Constant-force launcher as an alternative
- Aircraft thrust, rolling resistance, aerodynamic drag area, and air density

## Model

The calculator steps along the launch track and updates speed using `v_next² = v² + 2 a Δx`. At each step:

```text
bungee pull = efficiency × stiffness × max(0, initial stretch − distance)
net force   = launcher pull + aircraft thrust − gravity along track
              − rolling resistance − aerodynamic drag
drag        = ½ × air density × drag area × speed²
```

The constant-force option substitutes a fixed launcher pull. Results show predicted exit speed, target comparison, peak longitudinal acceleration, peak launcher pull, launch time, and change in kinetic energy. Braking uses the predicted exit speed and assumes constant deceleration across the entered braking distance; aircraft thrust is assumed off during braking.

This is a concept estimate. A real bungee force curve, attachment geometry, release behavior, airframe loads, tires, and braking limits need separate validation before hardware design.
