const G = 9.80665;
const INCH = 0.0254;
const inches = meters => Math.round(meters / INCH * 100) / 100;
const $ = id => document.getElementById(id);
let mode = 'bungee';
let nextSetId = 1;
let restoringConfig = false;
let configReady = false;
let savedConfigurations = [];
const STORAGE_KEY = 'aircraft-launch-calculator-configs-v7';
const V6_STORAGE_KEY = 'aircraft-launch-calculator-configs-v6';
const PREVIOUS_STORAGE_KEY = 'aircraft-launch-calculator-configs-v5';
const V4_STORAGE_KEY = 'aircraft-launch-calculator-configs-v4';
const OLD_STORAGE_KEY = 'aircraft-launch-calculator-configs-v3';
const OLDER_STORAGE_KEY = 'aircraft-launch-calculator-configs-v2';
const LEGACY_STORAGE_KEY = 'aircraft-launch-calculator-configs-v1';
const FIELD_IDS = ['planeMass', 'brakeMass', 'target', 'total', 'angle', 'efficiency', 'constantForce', 'thrust', 'rolling', 'cda', 'density', 'force-case', 'brake-diameter', 'brake-count', 'brake-natural', 'brake-engage', 'brake-force-case'];
const BRAKE_DEFAULTS = { 'brake-diameter': '3/8', 'brake-count': 6, 'brake-natural': 40, 'brake-engage': 64, 'brake-force-case': 'low' };
const CURRENT_SETUP = {
  mode: 'bungee',
  fields: { stopMargin: 6, planeMass: 9.5, brakeMass: 2.5, target: 18, total: 164, angle: 8, efficiency: 100, constantForce: 30000, thrust: 91, rolling: 0.2, cda: 0, density: 1.225, 'force-case': 'mid', 'brake-diameter': '1/4', 'brake-count': 4, 'brake-natural': 16, 'brake-engage': 122, 'brake-force-case': 'mid' },
  sets: [{ diameter: '1/4', count: 4, natural: 295, stretched: 720 }]
};

const OPTIONAL_FIELDS = { stopMargin: 6 };
const sliderConfig = {
  stopMargin: [0, 48, 0.5],
  planeMass: [0.1, 100, 0.1], brakeMass: [0.1, 30, 0.1], target: [0, 40, 0.1], total: [1, 200, 0.01],
  angle: [-30, 30, 0.5],
  efficiency: [1, 100, 1], constantForce: [0, 10000, 100],
  thrust: [0, 1000, 10], rolling: [0, 0.2, 0.005],
  cda: [0, 10, 0.1], density: [0, 1.5, 0.025],
  'brake-count': [0, 30, 1], 'brake-natural': [1, 144, 1], 'brake-engage': [0, 160, 1]
};

function enhanceSliders(scope) {
  scope.querySelectorAll('input[type="number"]').forEach(number => {
    if (number.dataset.sliderReady) return;
    const config = number.dataset.range
      ? number.dataset.range.split(',').map(Number)
      : sliderConfig[number.id];
    if (!config) return;
    const [min, max, step] = config;
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

function addBungeeSet(data = { diameter: '3/8', count: 3, natural: 120, stretched: 240 }) {
  const id = nextSetId++;
  const card = document.createElement('div');
  card.className = 'bungee-card';
  card.dataset.setId = id;
  card.innerHTML = `<div class="bungee-header"><span>Bungee set <span class="set-number"></span></span><button type="button" class="remove-set" aria-label="Remove bungee set">Remove</button></div>
    <div class="field"><label for="diameter-${id}">Cord diameter</label><select id="diameter-${id}" class="diameter">${diameterOptions()}</select></div>
    <div class="field"><label for="count-${id}">Cord count</label><div class="unit"><input id="count-${id}" class="count" type="number" min="1" step="1" value="${data.count}" data-range="1,30,1"><span>cords</span></div></div>
    <div class="row"><div class="field"><label for="natural-${id}">Unstretched length</label><div class="unit"><input id="natural-${id}" class="natural" type="number" min="0" step="any" value="${data.natural}" data-range="1,480,1"><span>in</span></div></div>
    <div class="field"><label for="stretched-${id}">Stretched length</label><div class="unit"><input id="stretched-${id}" class="stretched" type="number" min="0" step="any" value="${data.stretched}" data-range="1,600,1"><span>in</span></div></div></div>`;
  card.querySelector('.diameter').value = data.diameter || '3/8';
  card.querySelector('.diameter').addEventListener('change', calculate);
  $('bungee-list').append(card);
  enhanceSliders(card);
  renumberSets();
  if (!restoringConfig) calculate();
}

function renumberSets() {
  [...document.querySelectorAll('.bungee-card')].forEach((card, i) => {
    card.querySelector('.set-number').textContent = i + 1;
    card.querySelector('.remove-set').disabled = document.querySelectorAll('.bungee-card').length === 1;
  });
}

function bungeeSets() {
  return [...document.querySelectorAll('.bungee-card')].map(card => ({
    diameter: card.querySelector('.diameter').value,
    count: Number(card.querySelector('.count').value),
    natural: Number(card.querySelector('.natural').value),
    stretched: Number(card.querySelector('.stretched').value)
  }));
}

function currentConfig() {
  return {
    mode,
    fields: Object.fromEntries([...FIELD_IDS, ...Object.keys(OPTIONAL_FIELDS)].map(id => [id, $(id).value])),
    sets: bungeeSets()
  };
}

function validConfig(config) {
  return config && (config.mode === 'bungee' || config.mode === 'constant') &&
    config.fields && FIELD_IDS.every(id => config.fields[id] !== undefined && config.fields[id] !== null) &&
    !!CORD_SPECS[config.fields['brake-diameter']] &&
    Array.isArray(config.sets) && config.sets.length > 0 && config.sets.every(set =>
      !!CORD_SPECS[set.diameter] &&
      Number.isInteger(Number(set.count)) && Number(set.count) > 0 &&
      Number.isFinite(Number(set.natural)) && Number(set.natural) > 0 &&
      Number.isFinite(Number(set.stretched)) && Number(set.stretched) > Number(set.natural));
}

function setMode(choice) {
  mode = choice;
  for (const c of ['bungee', 'constant']) {
    $('mode-' + c).classList.toggle('active', c === choice);
    $('mode-' + c).setAttribute('aria-pressed', c === choice);
    $(c + '-fields').hidden = c !== choice;
  }
}

function applyConfig(config) {
  if (!validConfig(config)) return false;
  restoringConfig = true;
  setMode(config.mode);
  for (const id of [...FIELD_IDS, ...Object.keys(OPTIONAL_FIELDS)]) {
    $(id).value = config.fields[id] ?? OPTIONAL_FIELDS[id];
    const slider = $(id).closest('.field')?.querySelector('.value-slider');
    if (slider) {
      if (Number($(id).value) > Number(slider.max)) slider.max = $(id).value;
      if (Number($(id).value) < Number(slider.min)) slider.min = $(id).value;
      slider.value = $(id).value;
    }
  }
  $('bungee-list').replaceChildren();
  for (const set of config.sets) addBungeeSet(set);
  restoringConfig = false;
  calculate();
  return true;
}

function configMessage(message) { $('config-hint').textContent = message; }

function persistConfigs() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ saved: savedConfigurations, draft: currentConfig() }));
    return true;
  } catch {
    configMessage('Browser storage is unavailable. Configurations will not persist.');
    return false;
  }
}

function renderSavedList(selectedName) {
  const list = $('saved-list');
  list.replaceChildren();
  for (const item of savedConfigurations) {
    const option = document.createElement('option');
    option.value = item.name;
    option.textContent = item.name;
    list.append(option);
  }
  if (selectedName && savedConfigurations.some(item => item.name === selectedName)) list.value = selectedName;
  const empty = savedConfigurations.length === 0;
  $('load-config').disabled = empty;
  $('delete-config').disabled = empty;
}

function convertLegacyConfig(config, lengthsInMeters) {
  if (!config?.fields || !Array.isArray(config.sets)) return null;
  const length = lengthsInMeters ? inches(Number(config.fields.length)) : Math.round(Number(config.fields.length) * 100) / 100;
  const brake = lengthsInMeters ? inches(Number(config.fields.brake)) : Math.round(Number(config.fields.brake) * 100) / 100;
  if (!Number.isFinite(length) || !Number.isFinite(brake)) return null;
  return {
    mode: config.mode,
    fields: { ...config.fields, ...BRAKE_DEFAULTS, length, total: Math.round((length + brake) * 100) / 100 },
    sets: lengthsInMeters ? config.sets.map(set => ({ ...set, natural: inches(Number(set.natural)), stretched: inches(Number(set.stretched)) })) : config.sets
  };
}

function useSpecifiedBrake(config) {
  if (!config?.fields) return null;
  return { ...config, fields: { ...config.fields, 'brake-natural': 40, 'brake-engage': 64, 'brake-force-case': 'low' } };
}

function withDiameters(config) {
  if (!config?.fields || !Array.isArray(config.sets)) return null;
  return { ...config,
    fields: { ...config.fields, 'brake-diameter': config.fields['brake-diameter'] || '3/8' },
    sets: config.sets.map(set => ({ ...set, diameter: set.diameter || '3/8' }))
  };
}

function withSeparateMasses(config) {
  if (!config?.fields) return config;
  if (config.fields.planeMass !== undefined) return config;
  const total = Number(config.fields.mass);
  const carriage = Number(config.fields.brakeMass);
  return { ...config, fields: { ...config.fields, planeMass: total - carriage } };
}

function withoutLocks(config) {
  if (!config) return config;
  const { energyLock, ...rest } = config;
  return { ...rest, sets: Array.isArray(config.sets) ? config.sets.map(({ locked, ...set }) => set) : config.sets };
}

function loadStoredConfigs() {
  let stored;
  let migratedBrake = false;
  try {
    stored = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (!stored) stored = JSON.parse(localStorage.getItem(V6_STORAGE_KEY));
    if (!stored) {
      const old = JSON.parse(localStorage.getItem(PREVIOUS_STORAGE_KEY));
      if (old) stored = {
        saved: Array.isArray(old.saved) ? old.saved.map(item => ({ name: item.name, config: withDiameters(item.config) })) : [],
        draft: withDiameters(old.draft)
      };
    }
    if (!stored) {
      const old = JSON.parse(localStorage.getItem(V4_STORAGE_KEY));
      if (old) stored = {
        saved: Array.isArray(old.saved) ? old.saved.map(item => ({ name: item.name, config: withDiameters(useSpecifiedBrake(item.config)) })) : [],
        draft: withDiameters(useSpecifiedBrake(old.draft))
      };
      if (old) migratedBrake = true;
    }
    if (!stored) {
      const old = JSON.parse(localStorage.getItem(OLD_STORAGE_KEY));
      if (old) stored = {
        saved: Array.isArray(old.saved) ? old.saved.map(item => ({ name: item.name, config: withDiameters({ ...item.config, fields: { ...item.config?.fields, ...BRAKE_DEFAULTS } }) })) : [],
        draft: old.draft ? withDiameters({ ...old.draft, fields: { ...old.draft.fields, ...BRAKE_DEFAULTS } }) : null
      };
    }
    if (!stored) {
      const old = JSON.parse(localStorage.getItem(OLDER_STORAGE_KEY));
      if (old) stored = {
        saved: Array.isArray(old.saved) ? old.saved.map(item => ({ name: item.name, config: withDiameters(convertLegacyConfig(item.config, false)) })) : [],
        draft: withDiameters(convertLegacyConfig(old.draft, false))
      };
    }
    if (!stored) {
      const old = JSON.parse(localStorage.getItem(LEGACY_STORAGE_KEY));
      if (old) stored = {
        saved: Array.isArray(old.saved) ? old.saved.map(item => ({ name: item.name, config: withDiameters(convertLegacyConfig(item.config, true)) })) : [],
        draft: withDiameters(convertLegacyConfig(old.draft, true))
      };
    }
  } catch { stored = null; }
  if (stored) stored = {
    saved: Array.isArray(stored.saved) ? stored.saved.map(item => ({ ...item, config: withoutLocks(withSeparateMasses(item.config)) })) : [],
    draft: withoutLocks(withSeparateMasses(stored.draft))
  };
  if (stored && Array.isArray(stored.saved)) {
    savedConfigurations = stored.saved.filter(item => typeof item.name === 'string' && validConfig(item.config));
  } else {
    savedConfigurations = [{ name: 'CUSS1 15FT QUAD', config: CURRENT_SETUP }];
  }
  renderSavedList(savedConfigurations[0]?.name);
  applyConfig(validConfig(stored?.draft) ? stored.draft : CURRENT_SETUP);
  configReady = true;
  persistConfigs();
  if (migratedBrake) configMessage('Braking cord changed to MIL-C ⅜″. Review saved setups.');
}

function val(id) { return Number($(id).value); }
function fmt(n, d = 1) { return Number.isFinite(n) ? new Intl.NumberFormat('en-US', { maximumFractionDigits: d }).format(n) : '—'; }

function forceFmt(n) { return n >= 1000 ? `${fmt(n / 1000, 1)} kN` : `${fmt(n, 0)} N`; }
function resist(v, p) { return p.mass * G * Math.sin(p.rad) + p.rolling * p.mass * G * Math.cos(p.rad) + 0.5 * p.density * p.cda * v * v; }
const LBF = 4.448221615;
const CORD_SPECS = {
  '1/4': { label: '¼″', low: [10, 16], mid: [14, 22], high: [18, 28] },
  '3/8': { label: '⅜″', low: [50, 90], mid: [75, 120], high: [100, 150] },
  '1/2': { label: '½″', low: [110, 175], mid: [150, 212.5], high: [190, 250] },
  '5/8': { label: '⅝″', low: [160, 250], mid: [210, 300], high: [260, 350] }
};
function diameterOptions() {
  return Object.entries(CORD_SPECS).map(([value, spec]) => `<option value="${value}">${spec.label}</option>`).join('');
}
function specFor(diameter, forceCase) {
  const points = CORD_SPECS[diameter]?.[forceCase];
  return points && { f75: points[0] * LBF, f100: points[1] * LBF };
}
function cordForce(extensionRatio, forceCase, diameter) {
  if (extensionRatio <= 0) return 0;
  const spec = specFor(diameter, forceCase);
  const exponent = Math.log(spec.f75 / spec.f100) / Math.log(0.75);
  return spec.f100 * extensionRatio ** exponent;
}
function pull(x, p) {
  if (mode === 'constant') return p.constantForce;
  return p.efficiency * p.sets.reduce((sum, set) => sum + set.count * cordForce((set.stretched - set.natural - x) / set.natural, p.forceCase, set.diameter), 0);
}
function brakePull(x, p) {
  const extension = Math.max(0, x - p.brakeEngage) / p.brakeNatural;
  return p.brakeCount * cordForce(extension, p.brakeForceCase, p.brakeDiameter);
}

function simulateRebound(firstStop, p, startTime) {
  const friction = p.rolling * p.brakeMass * G * Math.cos(p.rad);
  const springForce = x => (mode === 'bungee' ? pull(x, p) : 0) - brakePull(x, p) - p.brakeMass * G * Math.sin(p.rad);
  const result = { motion: [[startTime, firstStop]], minX: firstStop, hitEnd: false, hitStart: false, settled: false, limit: false, turns: 0, moved: false, finalTime: startTime, finalX: firstStop };
  let x = firstStop, time = startTime, direction = springForce(x) < -friction ? -1 : springForce(x) > friction ? 1 : 0;
  if (!direction) { result.settled = true; return result; }
  for (let turn = 0; turn < 300; turn++) {
    let energy = 0;
    let previousSpeed = 0;
    for (let i = 0; i < 5000; i++) {
      const step = Math.min(0.002, direction > 0 ? p.total - x : x);
      if (step <= 0) break;
      const delta = direction * step;
      const work = (springForce(x + delta / 2) - direction * friction) * delta;
      if (energy + work <= 0) {
        const fraction = work < 0 ? Math.min(1, energy / -work) : 0;
        const stoppingDistance = Math.abs(delta * fraction);
        if (previousSpeed > 0) time += 2 * stoppingDistance / previousSpeed;
        x += delta * fraction;
        result.motion.push([time, x]);
        result.finalTime = time;
        result.finalX = x;
        result.minX = Math.min(result.minX, x);
        result.turns++;
        break;
      }
      energy += work;
      const nextSpeed = Math.sqrt(2 * energy / p.brakeMass);
      time += 2 * step / (previousSpeed + nextSpeed);
      x += delta;
      previousSpeed = nextSpeed;
      result.moved = true;
      if (i % 40 === 0) result.motion.push([time, x]);
      result.finalTime = time;
      result.finalX = x;
      result.minX = Math.min(result.minX, x);
      if (x >= p.total - 1e-9) { result.motion.push([time, x]); result.hitEnd = true; return result; }
      if (x <= 1e-9) { result.motion.push([time, x]); result.hitStart = true; return result; }
    }
    direction = -direction;
    if (springForce(x) * direction <= friction) { result.settled = true; return result; }
  }
  result.limit = true;
  return result;
}

function drawForce(p, released) {
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
  out += `<text x="${L}" y="${H - 4}" fill="#7895a6" font-size="11">0 in</text><text x="${x(total / 2)}" y="${H - 4}" fill="#7895a6" font-size="11" text-anchor="middle">${fmt(total / (2 * INCH), 1)} in</text><text x="${W - R}" y="${H - 4}" fill="#7895a6" font-size="11" text-anchor="end">${fmt(total / INCH, 1)} in · ${released ? 'release' : 'rail end'}</text>`;
  svg.innerHTML = out;
  svg.setAttribute('aria-label', `Launch bungee force starts at ${forceFmt(pull(0, p))} and changes over ${fmt(total / INCH, 1)} inches of launch travel`);
}

function drawSpeed(profile, p, releaseSpeed, railEndSpeed, brakeStop, rebound, released) {
  const svg = $('speed-chart');
  const W = 760, H = 230, L = 54, R = 20, T = 19, B = 36;
  const railEnd = p.total;
  const maxSpeed = Math.max(1, ...profile.map(point => point[1])) * 1.1;
  const sx = distance => L + (W - L - R) * distance / railEnd;
  const sy = speed => T + (H - T - B) * (1 - speed / maxSpeed);
  const path = points => points.map(([distance, speed], i) =>
    `${i ? 'L' : 'M'}${sx(distance).toFixed(1)},${sy(speed).toFixed(1)}`).join(' ');
  const launch = profile.filter(point => !released || point[0] <= p.length);
  const braking = released ? profile.filter(point => point[0] >= p.length) : [];
  let out = '';
  for (let i = 0; i <= 3; i++) {
    const speed = maxSpeed * (1 - i / 3), yy = sy(speed);
    out += `<line x1="${L}" y1="${yy}" x2="${W - R}" y2="${yy}" stroke="#294454"/><text x="${L - 7}" y="${yy + 4}" fill="#7895a6" font-size="11" text-anchor="end">${fmt(speed, 1)}</text>`;
  }
  if (released) {
    out += `<rect x="${sx(p.length)}" y="${T}" width="${sx(railEnd) - sx(p.length)}" height="${H - T - B}" fill="#d8a45b" opacity="0.07"/>`;
    out += `<line x1="${sx(p.length)}" y1="${T}" x2="${sx(p.length)}" y2="${H - B}" stroke="#d8a45b" stroke-dasharray="5 5"/>`;
  }
  out += `<path d="${path(launch)}" fill="none" stroke="#65ded0" stroke-width="3" stroke-linejoin="round"/>`;
  if (released) out += `<path d="${path(braking)}" fill="none" stroke="#e3ad66" stroke-width="3" stroke-linejoin="round"/>`;
  if (released) out += `<circle cx="${sx(p.length)}" cy="${sy(releaseSpeed)}" r="4.5" fill="#e3ad66"/>`;
  if (railEndSpeed !== null) out += `<circle cx="${sx(railEnd)}" cy="${sy(railEndSpeed)}" r="4.5" fill="#e3ad66"/>`;
  if (brakeStop !== null) out += `<circle cx="${sx(brakeStop)}" cy="${sy(0)}" r="4" fill="#e3ad66"/>`;
  if (rebound?.settled) {
    out += `<circle cx="${sx(rebound.finalX)}" cy="${sy(0)}" r="5" fill="#c796f3"/>`;
    out += `<text x="${sx(rebound.finalX)}" y="${H - B - 12}" fill="#c796f3" font-size="11" text-anchor="middle">Settles ${fmt(rebound.finalX / INCH, 1)} in</text>`;
  }
  out += `<text x="${L}" y="${H - 5}" fill="#7895a6" font-size="11">0 in</text>`;
  if (released) out += `<text x="${sx(p.length)}" y="${T - 5}" fill="#d8a45b" font-size="11" text-anchor="middle">Release ${fmt(p.length / INCH, 1)} in</text>`;
  out += `<text x="${W - R}" y="${H - 5}" fill="#7895a6" font-size="11" text-anchor="end">Rail end ${fmt(railEnd / INCH, 1)} in</text>`;
  svg.innerHTML = out;
  svg.setAttribute('aria-label', `First forward pass: carriage speed versus distance. ${released ? `Release at ${fmt(p.length / INCH, 1)} inches at ${fmt(releaseSpeed, 1)} meters per second` : 'No release before rail end'}; ${railEndSpeed === null ? 'rail end not reached' : `${fmt(railEndSpeed, 1)} meters per second at rail end`}${brakeStop === null ? '' : `; first stop at ${fmt(brakeStop / INCH, 1)} inches`}${rebound?.settled ? `; settles at ${fmt(rebound.finalX / INCH, 1)} inches` : ''}.`);
}

function simulateLaunch(p, captureProfile = false) {
  const N = 1000, dx = p.total / N;
  let v = p.start, x = 0, t = 0, stopped = false, released = false;
  const speedProfile = captureProfile ? [[0, v]] : null;
  const loadedAccel = (distance, speed) => (pull(distance, p) + p.thrust - resist(speed, p) - brakePull(distance, p)) / p.mass;
  let peakA = loadedAccel(0, v);
  let peakPull = pull(0, p);
  for (let i = 0; i < N; i++) {
    const a0 = loadedAccel(x, v);
    if (a0 <= 0) { released = v > 0 && x > 0; stopped = !released; break; }
    const step = Math.min(dx, p.total - x);
    const midSpeed = Math.sqrt(Math.max(0, v * v + a0 * step));
    const aMid = loadedAccel(x + step / 2, midSpeed);
    const next2 = v * v + 2 * aMid * step;
    if (next2 <= 0) {
      x += aMid < 0 ? Math.min(step, v * v / (-2 * aMid)) : 0;
      t += aMid < 0 && v > 0 ? v / (-aMid) : 0;
      v = 0;
      stopped = true;
      if (captureProfile) speedProfile.push([x, 0]);
      break;
    }
    const next = Math.sqrt(next2);
    const aEnd = loadedAccel(x + step, next);
    if (aEnd <= 0) {
      const fraction = a0 / (a0 - aEnd);
      const releaseStep = step * fraction;
      const releaseMidSpeed = Math.sqrt(Math.max(0, v * v + a0 * releaseStep));
      const releaseAccel = loadedAccel(x + releaseStep / 2, releaseMidSpeed);
      const releaseSpeed = Math.sqrt(Math.max(0, v * v + 2 * releaseAccel * releaseStep));
      t += 2 * releaseStep / (v + releaseSpeed);
      x += releaseStep;
      v = releaseSpeed;
      if (captureProfile) speedProfile.push([x, v]);
      released = true;
      break;
    }
    t += 2 * step / (v + next);
    x += step;
    v = next;
    peakA = Math.max(peakA, a0, aMid);
    peakPull = Math.max(peakPull, pull(x, p));
    if (captureProfile) speedProfile.push([x, v]);
  }
  if (!released && !stopped) x = p.total;
  return { v, x, t, stopped, released, speedProfile, peakA, peakPull };
}

function stretchClass(e) { return e > 1.4 ? 'fail' : e > 1 ? 'over' : 'ok'; }
function stretchCell(e) {
  const c = stretchClass(e);
  return `<td class="${c === 'fail' ? 'hot-fail' : c === 'over' ? 'hot-over' : ''}">${fmt(e * 100, 0)}%</td>`;
}
const STATUS_TEXT = { ok: 'Within spec', over: 'Beyond force data', fail: 'Past 140%' };
function renderStretch(p, released, brakeStop) {
  const rows = [];
  let worst = 'ok';
  const rank = { ok: 0, over: 1, fail: 2 };
  const note = c => { if (rank[c] > rank[worst]) worst = c; return `<td><span class="pill ${c}">${STATUS_TEXT[c]}</span></td>`; };
  if (mode === 'bungee') p.sets.forEach((s, i) => {
    const e0 = (s.stretched - s.natural) / s.natural;
    const eR = Math.max(0, (s.stretched - s.natural - (released ? p.length : p.total)) / s.natural);
    const perCord = p.efficiency * cordForce(e0, p.forceCase, s.diameter);
    rows.push(`<tr><td>Launch ${i + 1} · ${s.count} × ${CORD_SPECS[s.diameter].label}</td>${stretchCell(e0)}${stretchCell(eR)}${stretchCell(e0)}<td>${forceFmt(perCord)}</td>${note(stretchClass(e0))}</tr>`);
  });
  if (p.brakeCount > 0) {
    const ext = x => Math.max(0, x - p.brakeEngage) / p.brakeNatural;
    const eR = released ? ext(p.length) : 0;
    const eM = ext(released ? (brakeStop ?? p.total) : p.length);
    const perCord = cordForce(eM, p.brakeForceCase, p.brakeDiameter);
    rows.push(`<tr><td>Braking · ${p.brakeCount} × ${CORD_SPECS[p.brakeDiameter].label}</td>${stretchCell(0)}${released ? stretchCell(eR) : '<td>—</td>'}${stretchCell(eM)}<td>${forceFmt(perCord)}</td>${note(stretchClass(eM))}</tr>`);
  }
  $('stretch-rows').innerHTML = rows.join('') || '<tr><td colspan="6">No cords in this model.</td></tr>';
  $('stretch-summary').className = `pill ${worst}`;
  $('stretch-summary').textContent = STATUS_TEXT[worst];
}

function calculate() {
  const totalInches = val('total');
  const p = {
    mass: val('planeMass') + val('brakeMass'), brakeMass: val('brakeMass'), target: val('target'), total: totalInches * INCH,
    rad: val('angle') * Math.PI / 180, start: 0, efficiency: val('efficiency') / 100,
    constantForce: val('constantForce'), thrust: val('thrust'), rolling: val('rolling'),
    cda: val('cda'), density: val('density'), forceCase: $('force-case').value,
    brakeDiameter: $('brake-diameter').value, brakeCount: val('brake-count'), brakeNatural: val('brake-natural') * INCH,
    brakeEngage: val('brake-engage') * INCH, brakeForceCase: $('brake-force-case').value,
    sets: bungeeSets().map(set => ({ diameter: set.diameter, count: set.count, natural: set.natural * INCH, stretched: set.stretched * INCH }))
  };
  $('target-alt').textContent = `${fmt(p.target * 2.23694, 1)} mph · ${fmt(p.target * 1.94384, 1)} kt`;
  const basicInvalid = [val('planeMass'), p.mass, p.brakeMass, p.target, p.total, p.rad, p.efficiency,
    p.constantForce, p.thrust, p.rolling, p.cda, p.density, p.brakeCount, p.brakeNatural,
    p.brakeEngage].some(n => !Number.isFinite(n)) ||
    val('planeMass') <= 0 || p.brakeMass <= 0 || p.total <= 0 || p.target < 0 ||
    p.rolling < 0 || p.cda < 0 || p.density < 0 || p.thrust < 0 || p.constantForce < 0 ||
    p.efficiency <= 0 || p.efficiency > 1 || Math.abs(p.rad) > Math.PI / 4 ||
    !Number.isInteger(p.brakeCount) || p.brakeCount < 0 || p.brakeNatural <= 0 ||
    p.brakeEngage < 0 || !specFor(p.brakeDiameter, p.brakeForceCase) || !['low', 'mid', 'high'].includes(p.forceCase);
  const setInvalid = mode === 'bungee' && p.sets.some(s =>
    ![s.count, s.natural, s.stretched].every(Number.isFinite) ||
    !Number.isInteger(s.count) || s.count < 1 || s.natural <= 0 || s.stretched <= s.natural || !CORD_SPECS[s.diameter]
  );
  if (basicInvalid || setInvalid) {
    $('error').textContent = setInvalid ? 'Each set needs a whole cord count and stretched length greater than its positive unstretched length.' :
      'Check masses, lengths, angle (±45°), and force inputs.';
    if (configReady && !restoringConfig) persistConfigs();
    return;
  }
  $('error').textContent = '';
  $('launch-mass').textContent = `${fmt(p.mass, 2)} kg`;
  const targetEnergy = 0.5 * p.mass * p.target * p.target;
  $('energy-target').value = fmt(targetEnergy / 1000, 3);
  const brakeRange = CORD_SPECS[p.brakeDiameter];
  $('brake-force-range').textContent = `${brakeRange.low[0]}–${brakeRange.high[0]} lb at 75% stretch; ${brakeRange.low[1]}–${brakeRange.high[1]} lb at 100%, per cord.`;
  const { v, x, t, stopped, released, speedProfile, peakA, peakPull } = simulateLaunch(p, true);
  p.length = released ? x : p.total;
  p.brake = p.total - p.length;
  $('calculated-brake').textContent = released ? `${fmt(p.brake / INCH, 2)} in` : '—';
  const inclineWork = p.mass * G * p.length * Math.sin(p.rad);
  const engineWork = p.thrust * p.length;
  const idealBungeeWork = Math.max(0, targetEnergy + inclineWork - engineWork);
  $('energy-incline').textContent = released ? `${fmt(inclineWork / 1000, 2)} kJ` : '—';
  $('energy-engine').textContent = released ? `${fmt(engineWork / 1000, 2)} kJ` : '—';
  $('energy-ideal').textContent = released ? `${fmt(idealBungeeWork / 1000, 2)} kJ` : '—';
  $('energy-average-force').textContent = released && p.length > 0 ? `${fmt(idealBungeeWork / p.length, 0)} N` : '—';
  const reached = released && v >= p.target;
  const exitSpeed = released ? v : null;
  const netBrake = released ? v * v / (2 * p.brake) : 0;
  const gravity = p.brakeMass * G * Math.sin(p.rad);
  const roll = p.rolling * p.brakeMass * G * Math.cos(p.rad);
  const avgPull = released && mode === 'bungee' ? Array.from({ length: 100 }, (_, i) => pull(p.length + p.brake * (i + 0.5) / 100, p)).reduce((a, b) => a + b, 0) / 100 : 0;
  const brakeDemand = released ? Math.max(0, p.brakeMass * netBrake + avgPull - gravity - roll) : null;
  let brakeSpeed = v, brakeStop = null, brakePeak = released ? brakePull(p.length, p) : 0, peakBrakeG = 0;
  let postTime = 0;
  const brakeSteps = 500, brakeDx = p.brake / brakeSteps;
  if (released) for (let i = 0; i < brakeSteps; i++) {
    const position = p.length + (i + 0.5) * brakeDx;
    const braking = brakePull(position, p);
    brakePeak = Math.max(brakePeak, braking);
    const main = mode === 'bungee' ? pull(position, p) : 0;
    const decel = (braking + gravity + roll - main) / p.brakeMass;
    peakBrakeG = Math.max(peakBrakeG, decel / G);
    const nextSquared = brakeSpeed * brakeSpeed - 2 * decel * brakeDx;
    if (nextSquared <= 0 && decel > 0) {
      const stoppingDistance = brakeSpeed * brakeSpeed / (2 * decel);
      brakeStop = p.length + i * brakeDx + stoppingDistance;
      postTime += 2 * stoppingDistance / brakeSpeed;
      brakeSpeed = 0;
      speedProfile.push([brakeStop, 0]);
      break;
    }
    const nextSpeed = Math.sqrt(Math.max(0, nextSquared));
    postTime += 2 * brakeDx / (brakeSpeed + nextSpeed);
    brakeSpeed = nextSpeed;
    const nextPosition = p.length + (i + 1) * brakeDx;
    speedProfile.push([nextPosition, brakeSpeed]);
  }
  const rebound = brakeStop !== null ? simulateRebound(brakeStop, p, postTime) : null;
  const railEndSpeed = stopped || brakeStop !== null ? null : brakeSpeed;
  if (railEndSpeed !== null && speedProfile.at(-1)[0] < p.total) speedProfile.push([p.total, railEndSpeed]);
  const energy = 0.5 * p.mass * (v * v - p.start * p.start);
  const energyDifference = energy - targetEnergy;
  $('energy-difference').textContent = released ? `${energyDifference >= 0 ? '+' : '−'}${fmt(Math.abs(energyDifference) / 1000, 2)} kJ vs target` : 'No release';
  $('energy-difference').classList.toggle('energy-short', !released || energyDifference < 0);
  $('speed').innerHTML = released ? `${fmt(exitSpeed, 1)} <span>m/s</span>` : '—';
  $('speed-sub').textContent = released ? `${fmt(exitSpeed * 2.23694, 1)} mph · ${fmt(exitSpeed * 1.94384, 1)} kt at ${fmt(x / INCH, 1)} in` : 'No deceleration-triggered release on rail';
  $('status').textContent = stopped ? 'Stops before release' : !released ? 'No release' : reached ? 'Target met' : 'Below target';
  $('status').className = `status${reached ? '' : ' warn'}`;
  $('actual-release').innerHTML = released ? `${fmt(p.length / INCH, 1)} <span>in</span>` : '—';
  $('release-offset').textContent = released ? 'First deceleration point' : 'No deceleration before rail end';
  $('peak-g').innerHTML = `${fmt(Math.max(0, peakA / G), 2)} <span>g</span>`;
  $('peak-force').innerHTML = forceFmt(peakPull);
  $('pull-note').textContent = mode === 'bungee' ? 'Launch cords only' : 'Constant pull';
  $('launch-time').innerHTML = `${fmt(t, 2)} <span>s</span>`;
  $('brake-force').innerHTML = released ? forceFmt(brakePeak) : '—';
  $('brake-g').innerHTML = released ? `${fmt(peakBrakeG, 2)} <span>g</span>` : '—';
  $('brake-stop').innerHTML = !released ? '—' : brakeStop === null ? 'Past track' : `${fmt(brakeStop / INCH, 1)} <span>in</span>`;
  $('brake-stop-note').textContent = !released ? 'No braking run' : brakeStop === null ? `${fmt(brakeSpeed, 1)} m/s at track end` : `${fmt((brakeStop - p.length) / INCH, 1)} in after release`;
  const marginIn = Number($('stopMargin').value) || 0;
  const leftIn = brakeStop === null ? null : (p.total - brakeStop) / INCH;
  if (released && brakeStop !== null) {
    $('brake-stop-note').textContent = `${fmt(leftIn, 1)} in rail left · ${fmt((brakeStop - p.length) / INCH, 1)} in after release`;
  }
  $('brake-stop-note').classList.toggle('energy-short', released && (brakeStop === null || leftIn < marginIn));
  $('force-basis').textContent = mode === 'bungee' ? `${p.forceCase === 'mid' ? 'Midpoint' : p.forceCase === 'low' ? 'Low' : 'High'} MIL-C-5651 spec force fit, not measured cord data` : 'Constant applied force';
  renderStretch(p, released, brakeStop);
  $('speed-release').textContent = released ? `${fmt(exitSpeed, 1)} m/s at ${fmt(p.length / INCH, 1)} in release` : 'No release before rail end';
  $('speed-rail-end').textContent = railEndSpeed === null ? 'Rail end not reached' : `${fmt(railEndSpeed, 1)} m/s at rail end`;
  drawSpeed(speedProfile, p, exitSpeed, railEndSpeed, brakeStop, rebound, released);
  $('energy').innerHTML = released ? `${fmt(energy / 1000, 2)} <span>kJ</span>` : '—';
  $('force-panel').hidden = mode !== 'bungee';
  if (mode === 'bungee') drawForce(p, released);
  const notes = [];
  if (stopped) notes.push('<p class="warning">Carriage stopped before reaching a deceleration-triggered release.</p>');
  else if (!released) notes.push('<p class="warning">Loaded carriage did not begin decelerating before rail end; no release is predicted.</p>');
  else notes.push(`<p>Release: ${fmt(p.length / INCH, 1)} in, where loaded-carriage acceleration first reaches zero. Available braking travel: ${fmt(p.brake / INCH, 1)} in.</p>`);
  if (mode === 'bungee') {
    const cords = p.sets.reduce((sum, s) => sum + s.count, 0);
    const stored = p.sets.reduce((sum, s) => {
      const spec = specFor(s.diameter, p.forceCase);
      const exponent = Math.log(spec.f75 / spec.f100) / Math.log(0.75);
      return sum + s.count * spec.f100 * s.natural * ((s.stretched - s.natural) / s.natural) ** (exponent + 1) / (exponent + 1);
    }, 0);
    const longestPull = Math.max(...p.sets.map(s => s.stretched - s.natural));
    const extrapolated = p.sets.some(s => s.stretched > 2 * s.natural);
    notes.push(`<p>${cords} cords (${p.sets.map(s => `${s.count} × ${CORD_SPECS[s.diameter].label}`).join(' + ')}) · initial pull ${forceFmt(pull(0, p))} · loading energy ${fmt(stored / 1000, 2)} kJ · slack after ${fmt(longestPull / INCH, 1)} in.</p>`);
    notes.push(`<p>${p.forceCase} case: ${p.sets.map(s => { const spec = specFor(s.diameter, p.forceCase); return `${CORD_SPECS[s.diameter].label}: ${forceFmt(spec.f75)} at 75%, ${forceFmt(spec.f100)} at 100%`; }).join('; ')} per cord. Power-law fit between points; ${fmt(p.efficiency * 100, 0)}% unloading factor is assumed.</p>`);
    if (extrapolated) notes.push('<p class="warning">Some cords start beyond 100% extension. Force there is extrapolated beyond the quoted points.</p>');
  }
  const brakeSpec = specFor(p.brakeDiameter, p.brakeForceCase);
  const releaseExtension = Math.max(0, p.length - p.brakeEngage) / p.brakeNatural;
  const endExtension = Math.max(0, p.total - p.brakeEngage) / p.brakeNatural;
  notes.push(`<p>Braking: ${p.brakeCount} MIL-C-5651 Type I ${CORD_SPECS[p.brakeDiameter].label} cords, ${fmt(p.brakeNatural / INCH, 1)} in unstretched, engage at ${fmt(p.brakeEngage / INCH, 1)} in. ${p.brakeForceCase} case: ${forceFmt(brakeSpec.f75)} at 75% stretch and ${forceFmt(brakeSpec.f100)} at 100%, per cord. Extension is ${released ? `${fmt(releaseExtension * 100, 1)}% at release and ` : ''}${fmt(endExtension * 100, 1)}% at rail end.</p>`);
  if (endExtension > 1) notes.push('<p class="warning">Braking cord exceeds 100% stretch before rail end; force is extrapolated beyond the specified force points.</p>');
  if (released && releaseExtension < 0.75) notes.push('<p class="warning">Braking cord is below 75% stretch at release; force there is extrapolated below the specified force points.</p>');
  if (released) notes.push(`<p>Required average brake force for this track: ${forceFmt(brakeDemand)}. Modelled stop: ${brakeStop === null ? 'not within track' : `${fmt(brakeStop / INCH, 1)} in from start`}. After release, carriage speed includes braking bungee pull opposed by any remaining launch bungee pull; aircraft thrust is off.</p>`);
  if (brakeStop !== null) notes.push(`<p>After the first stop, the carriage ${rebound.hitEnd ? 'reaches the rail end on a later pass' : rebound.hitStart ? 'reaches the launch end on its return' : rebound.limit ? `rebounds to ${fmt(rebound.minX / INCH, 1)} in and keeps oscillating through the modelled turns` : rebound.moved ? `rebounds to ${fmt(rebound.minX / INCH, 1)} in, then settles after ${rebound.turns} turn${rebound.turns === 1 ? '' : 's'}` : 'remains at the stop'}. The speed plot marks the settled position when one is predicted. With passive cords and no thrust after release, later passes cannot travel farther forward than the first stop. This assumes the same cord force curve in both directions and rolling resistance as the only motion loss. Cord hysteresis, impacts, and holdback contact are not modelled.</p>`);
  $('details').innerHTML = notes.join('');
  if (configReady && !restoringConfig) persistConfigs();
}

$('add-bungee').addEventListener('click', () => addBungeeSet({ diameter: '3/8', count: 1, natural: 120, stretched: 240 }));
$('force-case').addEventListener('change', calculate);
$('brake-diameter').addEventListener('change', calculate);
$('brake-force-case').addEventListener('change', calculate);
$('bungee-list').addEventListener('click', e => {
  if (!e.target.classList.contains('remove-set')) return;
  if (document.querySelectorAll('.bungee-card').length <= 1) return;
  e.target.closest('.bungee-card').remove();
  renumberSets();
  calculate();
});
for (const choice of ['bungee', 'constant']) {
  $('mode-' + choice).addEventListener('click', () => {
    setMode(choice);
    calculate();
  });
}
$('save-config').addEventListener('click', () => {
  const name = $('config-name').value.trim();
  if (!name) { configMessage('Enter a configuration name.'); $('config-name').focus(); return; }
  if ($('error').textContent) { configMessage('Fix the input error before saving.'); return; }
  const existing = savedConfigurations.findIndex(item => item.name.toLowerCase() === name.toLowerCase());
  const actualName = existing < 0 ? name : savedConfigurations[existing].name;
  const entry = { name: actualName, config: currentConfig() };
  if (existing < 0) savedConfigurations.push(entry);
  else savedConfigurations[existing] = entry;
  renderSavedList(actualName);
  if (persistConfigs()) configMessage(existing < 0 ? `Saved “${actualName}”.` : `Updated “${actualName}”.`);
});
$('load-config').addEventListener('click', () => {
  const entry = savedConfigurations.find(item => item.name === $('saved-list').value);
  if (!entry || !applyConfig(entry.config)) { configMessage('Could not load this configuration.'); return; }
  $('config-name').value = entry.name;
  configMessage(`Loaded “${entry.name}”.`);
});
$('delete-config').addEventListener('click', () => {
  const name = $('saved-list').value;
  savedConfigurations = savedConfigurations.filter(item => item.name !== name);
  renderSavedList();
  if (persistConfigs()) configMessage(`Deleted “${name}”.`);
});
$('form').addEventListener('submit', e => e.preventDefault());
enhanceSliders(document);
addBungeeSet();
loadStoredConfigs();
