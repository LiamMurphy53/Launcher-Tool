# Aircraft Launch Calculator

[Open the calculator](https://aircraft-launch-calculator.rainy-charm-8688.chatgpt.site) or open `index.html` locally.

The default main cords are three ⅜-inch MIL-C-5651 Type I cords, each 10 ft unstretched and 20 ft at full draw. Add bungee sets with different cord counts and lengths. Sliders and number fields adjust the inputs.

The force model fits a power law through the [MIL-C-5651D](https://www.milspecmonkey.com/materials/MIL-C-5651D%28shockcord%29.pdf) force ranges at 75% and 100% extension. Low, midpoint, and high cases use 50/90, 75/120, and 100/150 lbf at those two points, per cord. The default unloading factor is 100%, reproducing the specification midpoint of approximately 1.60 kN for three cords at full draw. Lower it to explore possible unloading losses; the actual unloading curve still needs measurement.

The model adds aircraft thrust during launch. At release, it switches to carriage mass for the braking calculation and includes remaining main-cord pull. It estimates exit speed, peak longitudinal g, launch pull, and required average brake force.

The chart shows combined bungee force from launch start to plane release.

This is a preliminary approximation. Force below 75% extension, unloading hysteresis, end fittings, release transients, and brake behavior require testing. The simplified brake model assumes braking begins after plane release.
