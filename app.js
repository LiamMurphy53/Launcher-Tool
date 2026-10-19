const G = 9.80665;
const $ = id => document.getElementById(id);
let mode = 'bungee';
let nextSetId = 1;

const sliderConfig = {
  mass: [1, 100, 0.5], brakeMass: [0.1, 30, 0.1], target: [0, 40, 0.1], length: [0.1, 4, 0.01],
  brake: [0.1, 2, 0.01], angle: [-30, 30, 0.5], start: [0, 20, 0.1],
  efficiency: [1, 100, 1], constantForce: [0, 10000, 100],
  thrust: [0, 1000, 10], rolling: [0, 0.2, 0.005],
  cda: [0, 10, 0.1], density: [0, 1.5, 0.025]
};

function enhanceSliders(scope) {
  scope.querySelectorAll('input[type="number"]').forEach(number => {
    if (number.dataset.sliderReady) return;
    const [min, max, step] = number.dataset.range
      ? number.dataset.range.split(',').map(Number)
      : sliderConfig[number.id];
    if (![min, max, step].every(Number.isFinite)) return;
    const slider = document.createElement('input');
    slider.type = 'range';
    slider.className = 'value-slider';
    slider.min = String(min);
    slider.max = String(Math.max(max, Number(number.value) || max));
    slider.step = String(step);
    slider.value = number.value;
    slider.setAttribute('aria-label', `${number.closest('.field').querySelector('label').textContent} slider`);
    number.closest('.unit').after(slider);
    number.dataset.sliderReady = 'true';
    number.addEventListener('input', () => {
      const value = Number(number.value);
      if (Number.isFinite(value)) {
        if (value > Number(slider.max)) slider.max = String(value);
        if (value < Number(slider.min)) slider.min = String(value);
        slider.value = number.value;
      }
      calculate();
    });
    slider.addEventListener('input', () => {
      number.value = slider.value;
      calculate();
    });
  });
}

function addBungeeSet(data = { count: 3, natural: 3.048, stretched: 6.096 }) {
  const id = nextSetId++;
  const card = document.createElement('div');
  card.className = 'bungee-card';
  card.dataset.setId = id;
  card.innerHTML = `<div class="bungee-header"><span>Bungee set <span class="set-number"></span></span><button type="button" class="remove-set" aria-label="Remove bungee set">Remove</button></div>
    <div class="field"><label for="count-${id}">Cord count</label><div class="unit"><input id="count-${id}" class="count" type="number" min="1" step="1" value="${data.count}" data-range="1,30,1"><span>cords</span></div></div>
    <div class="row"><div class="field"><label for="natural-${id}">Unstretched length</label><div class="unit"><input id="natural-${id}" class="natural" type="number" min="0" step="any" value="${data.natural}" data-range="0,100,0.5"><span>m</span></div></div>
    <div class="field"><label for="stretched-${id}">Stretched length</label><div class="unit"><input id="stretched-${id}" class="stretched" type="number" min="0" step="any" value="${data.stretched}" data-range="0,150,0.5"><span>m</span></div></div></div>`;
  $('bungee-list').append(card);
  enhanceSliders(card);
  renumberSets();
  calculate();
}

function renumberSets() {
  [...document.querySelectorAll('.bungee-card')].forEach((card, i) => {
    card.querySelector('.set-number').textContent = i + 1;
    card.querySelector('.remove-set').disabled = document.querySelectorAll('.bungee-card').length === 1;
  });
}

function bungeeSets() {
  return [...document.querySelectorAll('.bungee-card')].map(card => ({
    count: Number(card.querySelector('.count').value),
    natural: Number(card.querySelector('.natural').value),
    stretched: Number(card.querySelector('.stretched').value)
  }));
}

function val(id) { return Number($(id).value); }
function fmt(n, d = 1) { return Number.isFinite(n) ? new Intl.NumberFormat('en-US', { maximumFractionDigits: d }).format(n) : '—'; }
function forceFmt(n) { return n >= 1000 ? `${fmt(n / 1000, 1)} kN` : `${fmt(n, 0)} N`; }
function resist(v, p) { return p.mass * G * Math.sin(p.rad) + p.rolling * p.mass * G * Math.cos(p.rad) + 0.5 * p.density * p.cda * v * v; }
const MIL = {
  low: { f75: 50 * 4.448221615, f100: 90 * 4.448221615 },
  mid: { f75: 75 * 4.448221615, f100: 120 * 4.448221615 },
  high: { f75: 100 * 4.448221615, f100: 150 * 4.448221615 }
};
function cordForce(extensionRatio, forceCase) {
  if (extensionRatio <= 0) return 0;
  const spec = MIL[forceCase];
  const exponent = Math.log(spec.f75 / spec.f100) / Math.log(0.75);
  return spec.f100 * extensionRatio ** exponent;
}
function pull(x, p) {
  if (mode === 'constant') return p.constantForce;
  return p.efficiency * p.sets.reduce((sum, set) => sum + set.count * cordForce((set.stretched - set.natural - x) / set.natural, p.forceCase), 0);
}

function drawForce(p) {
  const svg = $('force-chart');
  const total = p.length, L = 54, R = 18, T = 16, B = 28, H = 200, W = 760;
  const maxForce = Math.max(1, pull(0, p)) * 1.1;
  const x = d => L + (W - L - R) * d / total;
  const y = f => T + (H - T - B) * (1 - f / maxForce);
  let out = '';
  for (let i = 0; i <= 3; i++) {
    const force = maxForce * (1 - i / 3), yy = y(force);
    out += `<line x1="${L}" y1="${yy}" x2="${W - R}" y2="${yy}" stroke="#294454"/><text x="${L - 7}" y="${yy + 4}" fill="#7895a6" font-size="11" text-anchor="end">${fmt(force / 1000, 1)}kN</text>`;
  }
  const curve = Array.from({ length: 251 }, (_, i) => {
    const d = total * i / 250;
    return `${i ? 'L' : 'M'}${x(d).toFixed(1)},${y(pull(d, p)).toFixed(1)}`;
  }).join(' ');
  out += `<path d="${curve}" fill="none" stroke="#65ded0" stroke-width="3"/>`;
  out += `<text x="${L}" y="${H - 4}" fill="#7895a6" font-size="11">0 m</text><text x="${x(total / 2)}" y="${H - 4}" fill="#7895a6" font-size="11" text-anchor="middle">${fmt(total / 2, 2)} m</text><text x="${W - R}" y="${H - 4}" fill="#7895a6" font-size="11" text-anchor="end">${fmt(total, 2)} m · release</text>`;
  svg.innerHTML = out;
  svg.setAttribute('aria-label', `Bungee force starts at ${forceFmt(pull(0, p))} and changes over ${fmt(total, 2)} meters of launch travel`);
}

function calculate() {
  const p = {
    mass: val('mass'), brakeMass: val('brakeMass'), target: val('target'), length: val('length'), brake: val('brake'),
    rad: val('angle') * Math.PI / 180, start: val('start'), efficiency: val('efficiency') / 100,
    constantForce: val('constantForce'), thrust: val('thrust'), rolling: val('rolling'),
    cda: val('cda'), density: val('density'), forceCase: $('force-case').value, sets: bungeeSets()
  };
  $('target-alt').textContent = `${fmt(p.target * 2.23694, 1)} mph · ${fmt(p.target * 1.94384, 1)} kt`;
  const basicInvalid = [p.mass, p.brakeMass, p.target, p.length, p.brake, p.rad, p.start, p.efficiency,
    p.constantForce, p.thrust, p.rolling, p.cda, p.density].some(n => !Number.isFinite(n)) ||
    p.mass <= 0 || p.brakeMass <= 0 || p.length <= 0 || p.brake <= 0 || p.target < 0 || p.start < 0 ||
    p.rolling < 0 || p.cda < 0 || p.density < 0 || p.thrust < 0 || p.constantForce < 0 ||
    p.efficiency <= 0 || p.efficiency > 1 || Math.abs(p.rad) > Math.PI / 4;
  const setInvalid = mode === 'bungee' && p.sets.some(s =>
    ![s.count, s.natural, s.stretched].every(Number.isFinite) ||
    !Number.isInteger(s.count) || s.count < 1 || s.natural <= 0 || s.stretched <= s.natural
  );
  if (basicInvalid || setInvalid) {
    $('error').textContent = setInvalid ? 'Each set needs a whole cord count and stretched length greater than its positive unstretched length.' : 'Check masses, lengths, angle (±45°), and force inputs.';
    return;
  }
  $('error').textContent = '';
  const N = 500, dx = p.length / N;
  let v = p.start, x = 0, t = 0, stopped = false;
  let peakA = (pull(0, p) + p.thrust - resist(v, p)) / p.mass;
  let peakPull = pull(0, p);
  for (let i = 0; i < N; i++) {
    const f = pull(x + dx / 2, p);
    const a = (f + p.thrust - resist(v, p)) / p.mass;
    peakA = Math.max(peakA, a);
    peakPull = Math.max(peakPull, f);
    const next2 = v * v + 2 * a * dx;
    if (next2 <= 0) {
      x += a < 0 ? Math.min(dx, v * v / (-2 * a)) : 0;
      t += a < 0 && v > 0 ? v / (-a) : 0;
      v = 0;
      stopped = true;
      break;
    }
    const next = Math.sqrt(next2);
    t += 2 * dx / (v + next);
    x += dx;
    v = next;
  }
  const reached = !stopped && v >= p.target;
  const netBrake = v * v / (2 * p.brake);
  const gravity = p.brakeMass * G * Math.sin(p.rad);
  const roll = p.rolling * p.brakeMass * G * Math.cos(p.rad);
  const avgPull = mode === 'bungee' ? Array.from({ length: 100 }, (_, i) => pull(p.length + p.brake * (i + 0.5) / 100, p)).reduce((a, b) => a + b, 0) / 100 : 0;
  const brakeDemand = Math.max(0, p.brakeMass * netBrake + avgPull - gravity - roll);
  const energy = 0.5 * p.mass * (v * v - p.start * p.start);
  $('speed').innerHTML = `${fmt(v, 1)} <span>m/s</span>`;
  $('speed-sub').textContent = `${fmt(v * 2.23694, 1)} mph · ${fmt(v * 1.94384, 1)} kt at ${fmt(x, 1)} m`;
  $('status').textContent = stopped ? 'Stops on track' : reached ? 'Target met' : 'Below target';
  $('status').className = `status${reached ? '' : ' warn'}`;
  $('peak-g').innerHTML = `${fmt(Math.max(0, peakA / G), 2)} <span>g</span>`;
  $('peak-force').innerHTML = forceFmt(peakPull);
  $('pull-note').textContent = mode === 'bungee' ? 'Combined bungee pull' : 'Constant pull';
  $('launch-time').innerHTML = `${fmt(t, 2)} <span>s</span>`;
  $('brake-force').innerHTML = forceFmt(brakeDemand);
  $('brake-g').innerHTML = `${fmt(netBrake / G, 2)} <span>g</span>`;
  $('energy').innerHTML = `${fmt(energy / 1000, 2)} <span>kJ</span>`;
  $('force-panel').hidden = mode !== 'bungee';
  if (mode === 'bungee') drawForce(p);
  const notes = [];
  if (stopped) notes.push('<p class="warning">Stopped on launch track.</p>');
  if (mode === 'bungee') {
    const cords = p.sets.reduce((sum, s) => sum + s.count, 0);
    const spec = MIL[p.forceCase];
    const exponent = Math.log(spec.f75 / spec.f100) / Math.log(0.75);
    const stored = p.sets.reduce((sum, s) => sum + s.count * spec.f100 * s.natural * ((s.stretched - s.natural) / s.natural) ** (exponent + 1) / (exponent + 1), 0);
    const longestPull = Math.max(...p.sets.map(s => s.stretched - s.natural));
    const extrapolated = p.sets.some(s => s.stretched > 2 * s.natural);
    notes.push(`<p>${cords} cords · initial pull ${forceFmt(pull(0, p))} · loading energy ${fmt(stored / 1000, 2)} kJ · slack after ${fmt(longestPull, 2)} m.</p>`);
    notes.push(`<p>${p.forceCase} case: ${forceFmt(spec.f75)} at 75% stretch, ${forceFmt(spec.f100)} at 100%, per cord. Power-law fit between points; ${fmt(p.efficiency * 100, 0)}% unloading factor is assumed.</p>`);
    if (extrapolated) notes.push('<p class="warning">Some cords start beyond 100% extension. Force there is extrapolated beyond the quoted points.</p>');
  }
  notes.push(`<p>Braking: ${fmt(p.brakeMass, 1)} kg carriage over ${fmt(p.brake, 2)} m; engine thrust off. g is longitudinal acceleration / 9.80665 m/s².</p>`);
  $('details').innerHTML = notes.join('');
}

$('add-bungee').addEventListener('click', () => addBungeeSet({ count: 1, natural: 3.048, stretched: 6.096 }));
$('force-case').addEventListener('change', calculate);
$('bungee-list').addEventListener('click', e => {
  if (!e.target.classList.contains('remove-set')) return;
  if (document.querySelectorAll('.bungee-card').length <= 1) return;
  e.target.closest('.bungee-card').remove();
  renumberSets();
  calculate();
});
for (const choice of ['bungee', 'constant']) {
  $('mode-' + choice).addEventListener('click', () => {
    mode = choice;
    for (const c of ['bungee', 'constant']) {
      $('mode-' + c).classList.toggle('active', c === choice);
      $('mode-' + c).setAttribute('aria-pressed', c === choice);
      $(c + '-fields').hidden = c !== choice;
    }
    calculate();
  });
}
$('form').addEventListener('submit', e => e.preventDefault());
enhanceSliders(document);
addBungeeSet();
