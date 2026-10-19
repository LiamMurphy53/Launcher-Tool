const G = 9.80665;
const $ = id => document.getElementById(id);
let mode = 'bungee';
let nextSetId = 1;

const sliderConfig = {
  mass: [100, 10000, 10], target: [0, 100, 0.5], length: [1, 300, 1],
  brake: [1, 300, 1], angle: [-30, 30, 0.5], start: [0, 60, 0.5],
  efficiency: [1, 100, 1], constantForce: [0, 200000, 1000],
  thrust: [0, 100000, 500], rolling: [0, 0.2, 0.005],
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

function addBungeeSet(data = { count: 4, natural: 20, stretched: 45, stiffness: 500 }) {
  const id = nextSetId++;
  const card = document.createElement('div');
  card.className = 'bungee-card';
  card.dataset.setId = id;
  card.innerHTML = `<div class="bungee-header"><span>Bungee set <span class="set-number"></span></span><button type="button" class="remove-set" aria-label="Remove bungee set">Remove</button></div>
    <div class="row"><div class="field"><label for="count-${id}">Cord count</label><div class="unit"><input id="count-${id}" class="count" type="number" min="1" step="1" value="${data.count}" data-range="1,30,1"><span>cords</span></div></div>
    <div class="field"><label for="stiffness-${id}">Stiffness per cord</label><div class="unit"><input id="stiffness-${id}" class="stiffness" type="number" min="0" step="any" value="${data.stiffness}" data-range="0,10000,50"><span>N/m</span></div></div></div>
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
    stiffness: Number(card.querySelector('.stiffness').value),
    natural: Number(card.querySelector('.natural').value),
    stretched: Number(card.querySelector('.stretched').value)
  }));
}

function val(id) { return Number($(id).value); }
function fmt(n, d = 1) { return Number.isFinite(n) ? new Intl.NumberFormat('en-US', { maximumFractionDigits: d }).format(n) : '—'; }
function forceFmt(n) { return n >= 1000 ? `${fmt(n / 1000, 1)} kN` : `${fmt(n, 0)} N`; }
function resist(v, p) { return p.mass * G * Math.sin(p.rad) + p.rolling * p.mass * G * Math.cos(p.rad) + 0.5 * p.density * p.cda * v * v; }
function pull(x, p) {
  if (mode === 'constant') return p.constantForce;
  return p.efficiency * p.sets.reduce((sum, set) => sum + set.count * set.stiffness * Math.max(0, set.stretched - set.natural - x), 0);
}

function draw(points, length) {
  const svg = $('chart'), W = 760, H = 270, L = 46, R = 20, T = 12, B = 35;
  const plotW = W - L - R, plotH = H - T - B;
  const maxV = Math.max(1, ...points.map(p => p.v)) * 1.08;
  const maxA = Math.max(1, ...points.map(p => Math.abs(p.a))) * 1.12;
  const x = p => L + plotW * p.x / length;
  const yV = p => T + plotH * (1 - p.v / maxV);
  const yA = p => T + plotH * (0.5 - p.a / (2 * maxA));
  const path = fn => points.map((p, i) => `${i ? 'L' : 'M'}${x(p).toFixed(1)},${fn(p).toFixed(1)}`).join(' ');
  let out = '';
  for (let i = 0; i <= 4; i++) {
    const y = T + i * plotH / 4;
    out += `<line x1="${L}" y1="${y}" x2="${W - R}" y2="${y}" stroke="#294454"/><text x="${L - 8}" y="${y + 4}" fill="#7895a6" font-size="11" text-anchor="end">${fmt(maxV * (1 - i / 4), 0)}</text>`;
  }
  out += `<text x="${L}" y="${H - 7}" fill="#7895a6" font-size="11">0 m</text><text x="${W - R}" y="${H - 7}" fill="#7895a6" font-size="11" text-anchor="end">${fmt(length, 0)} m</text>`;
  out += `<line x1="${L}" y1="${T + plotH / 2}" x2="${W - R}" y2="${T + plotH / 2}" stroke="#8a765f" stroke-dasharray="4 5"/>`;
  out += `<path d="${path(yV)}" fill="none" stroke="#65ded0" stroke-width="3"/><path d="${path(yA)}" fill="none" stroke="#f5aa74" stroke-width="2.5"/>`;
  svg.innerHTML = out;
  svg.setAttribute('aria-label', `Speed reaches ${fmt(points.at(-1).v, 1)} meters per second after ${fmt(points.at(-1).x, 1)} meters`);
}

function calculate() {
  const p = {
    mass: val('mass'), target: val('target'), length: val('length'), brake: val('brake'),
    rad: val('angle') * Math.PI / 180, start: val('start'), efficiency: val('efficiency') / 100,
    constantForce: val('constantForce'), thrust: val('thrust'), rolling: val('rolling'),
    cda: val('cda'), density: val('density'), sets: bungeeSets()
  };
  $('target-alt').textContent = `${fmt(p.target * 2.23694, 1)} mph · ${fmt(p.target * 1.94384, 1)} kt`;
  const basicInvalid = [p.mass, p.target, p.length, p.brake, p.rad, p.start, p.efficiency,
    p.constantForce, p.thrust, p.rolling, p.cda, p.density].some(n => !Number.isFinite(n)) ||
    p.mass <= 0 || p.length <= 0 || p.brake <= 0 || p.target < 0 || p.start < 0 ||
    p.rolling < 0 || p.cda < 0 || p.density < 0 || p.thrust < 0 || p.constantForce < 0 ||
    p.efficiency <= 0 || p.efficiency > 1 || Math.abs(p.rad) > Math.PI / 4;
  const setInvalid = mode === 'bungee' && p.sets.some(s =>
    ![s.count, s.stiffness, s.natural, s.stretched].every(Number.isFinite) ||
    !Number.isInteger(s.count) || s.count < 1 || s.stiffness <= 0 ||
    s.natural < 0 || s.stretched <= s.natural
  );
  if (basicInvalid || setInvalid) {
    $('error').textContent = setInvalid ? 'Each set needs a whole cord count, positive stiffness, and stretched length greater than unstretched length.' : 'Check mass, lengths, angle (±45°), and force inputs.';
    return;
  }
  $('error').textContent = '';
  const N = 500, dx = p.length / N;
  let v = p.start, x = 0, t = 0, stopped = false;
  let peakA = (pull(0, p) + p.thrust - resist(v, p)) / p.mass;
  let peakPull = pull(0, p);
  const points = [{ x: 0, v, a: peakA }];
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
      points.push({ x, v, a });
      break;
    }
    const next = Math.sqrt(next2);
    t += 2 * dx / (v + next);
    x += dx;
    v = next;
    points.push({ x, v, a });
  }
  const reached = !stopped && v >= p.target;
  const netBrake = v * v / (2 * p.brake);
  const gravity = p.mass * G * Math.sin(p.rad);
  const roll = p.rolling * p.mass * G * Math.cos(p.rad);
  const avgDrag = 0.25 * p.density * p.cda * v * v;
  const brakeDemand = Math.max(0, p.mass * netBrake - gravity - roll - avgDrag);
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
  $('energy').innerHTML = `${fmt(energy / 1e6, 2)} <span>MJ</span>`;
  draw(points, p.length);
  const notes = [];
  if (stopped) notes.push('<p class="warning">Stopped on launch track.</p>');
  if (mode === 'bungee') {
    const cords = p.sets.reduce((sum, s) => sum + s.count, 0);
    const stored = p.sets.reduce((sum, s) => sum + 0.5 * s.count * s.stiffness * (s.stretched - s.natural) ** 2, 0);
    const longestPull = Math.max(...p.sets.map(s => s.stretched - s.natural));
    notes.push(`<p>${cords} cords in ${p.sets.length} set${p.sets.length === 1 ? '' : 's'} · stored energy ${fmt(stored / 1e6, 2)} MJ · effective initial pull ${forceFmt(pull(0, p))}.</p>`);
    notes.push(`<p>All cords slack after ${fmt(longestPull, 1)} m of travel. Force efficiency applies to pull, not stored energy.</p>`);
  }
  notes.push(`<p>Braking: constant deceleration over ${fmt(p.brake, 1)} m; engine thrust off. g is longitudinal acceleration / 9.80665 m/s².</p>`);
  $('details').innerHTML = notes.join('');
}

$('add-bungee').addEventListener('click', () => addBungeeSet({ count: 1, natural: 20, stretched: 45, stiffness: 500 }));
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
